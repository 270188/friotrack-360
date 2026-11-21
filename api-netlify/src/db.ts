// Conexión a PostgreSQL (Neon) con node-postgres. Una instancia de la función reutiliza el pool entre llamadas.
import pg from "pg";

// Los tipos se devuelven como los serializaba Jackson en el backend Java:
// TIMESTAMP → "YYYY-MM-DDTHH:mm:ss[.fff]" (hora local de Lima, sin zona), DATE → "YYYY-MM-DD",
// NUMERIC y BIGINT → número.
pg.types.setTypeParser(1114, (v: string) => {
  const [f, h] = v.split(" ");
  const [hms, frac] = h.split(".");
  return frac ? `${f}T${hms}.${frac.slice(0, 3)}` : `${f}T${hms}`;
});
pg.types.setTypeParser(1082, (v: string) => v);
pg.types.setTypeParser(1700, (v: string) => Number(v));
pg.types.setTypeParser(20, (v: string) => Number(v));

export type Fila = Record<string, any>;

/** Ejecuta SQL; en transacción si se usa dentro de enTransaccion(). */
export interface Db {
  q(sql: string, params?: unknown[]): Promise<Fila[]>;
  uno(sql: string, params?: unknown[]): Promise<Fila | null>;
  valor<T = unknown>(sql: string, params?: unknown[]): Promise<T>;
}

let pool: pg.Pool | null = null;

function obtenerPool(): pg.Pool {
  if (pool) return pool;
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("Falta la variable de entorno DATABASE_URL");
  const local = /@(localhost|127\.0\.0\.1)[:/]/.test(url);
  pool = new pg.Pool({
    connectionString: url,
    max: Number(process.env.DB_POOL_MAX ?? 3),
    idleTimeoutMillis: 20_000,
    connectionTimeoutMillis: 15_000,
    ssl: local ? undefined : { rejectUnauthorized: true },
  });
  return pool;
}

function envolver(c: pg.Pool | pg.PoolClient): Db {
  const q = async (sql: string, params: unknown[] = []) => (await c.query(sql, params)).rows as Fila[];
  return {
    q,
    uno: async (sql, params) => (await q(sql, params))[0] ?? null,
    valor: async (sql, params) => {
      const f = (await q(sql, params))[0];
      return (f ? Object.values(f)[0] : null) as any;
    },
  };
}

/** Consultas sueltas (lecturas). */
export const db = (): Db => envolver(obtenerPool());

/** Ejecuta fn dentro de una transacción: COMMIT si termina bien, ROLLBACK si lanza un error. */
export async function enTransaccion<T>(fn: (tx: Db) => Promise<T>): Promise<T> {
  const cliente = await obtenerPool().connect();
  try {
    await cliente.query("BEGIN");
    const r = await fn(envolver(cliente));
    await cliente.query("COMMIT");
    return r;
  } catch (e) {
    await cliente.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    cliente.release();
  }
}

/** Solo para pruebas: reemplaza la URL y reinicia el pool. */
export async function reiniciarPool() {
  if (pool) await pool.end().catch(() => {});
  pool = null;
}
