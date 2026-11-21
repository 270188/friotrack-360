// Piezas comunes de la API: errores con el mismo formato que el backend Spring Boot,
// respuestas JSON, hora de Lima, paginación y validación de datos de entrada.

// ------------------------------------------------------------------ errores

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public campos: Record<string, string> | null = null,
    public headers: Record<string, string> = {},
  ) {
    super(message);
  }
}
/** 404: recurso inexistente. */
export const noEncontrado = (recurso: string, id?: unknown) =>
  new HttpError(404, id === undefined ? recurso : `${recurso} con id ${id} no encontrado`);
/** 422: regla de negocio incumplida. */
export const reglaNegocio = (mensaje: string) => new HttpError(422, mensaje);
/** 409: conflicto (duplicado). */
export const conflicto = (mensaje: string) => new HttpError(409, mensaje);
/** 400: solicitud mal formada. */
export const solicitudInvalida = (mensaje: string) => new HttpError(400, mensaje);

const FRASES: Record<number, string> = {
  400: "Bad Request",
  401: "Unauthorized",
  403: "Forbidden",
  404: "Not Found",
  405: "Method Not Allowed",
  409: "Conflict",
  415: "Unsupported Media Type",
  422: "Unprocessable Entity",
  500: "Internal Server Error",
};

/** Cuerpo de error idéntico a ApiErrorDto del backend Java (en snake_case). */
export function cuerpoError(status: number, mensaje: string, ruta: string, campos: Record<string, string> | null = null) {
  return { timestamp: ahoraLima(true), status, error: FRASES[status] ?? "Error", mensaje, ruta, campos };
}

// ------------------------------------------------------------------ respuestas

export type Respuesta = { status: number; body?: unknown; headers?: Record<string, string>; binario?: Uint8Array };
export const ok = (body: unknown): Respuesta => ({ status: 200, body });
export const creado = (body: unknown): Respuesta => ({ status: 201, body });
export const sinContenido = (): Respuesta => ({ status: 204 });
export const archivo = (nombre: string, tipo: string, datos: Uint8Array): Respuesta => ({
  status: 200,
  binario: datos,
  headers: { "content-type": tipo, "content-disposition": `attachment; filename="${nombre}"` },
});

// ------------------------------------------------------------------ fechas (hora de Lima, UTC-5 sin horario de verano)

const OFFSET_LIMA_MS = 5 * 60 * 60 * 1000;
/** Fecha y hora actual de Lima, "YYYY-MM-DDTHH:mm:ss" (con milisegundos si se pide). */
export function ahoraLima(conMilisegundos = false): string {
  const iso = new Date(Date.now() - OFFSET_LIMA_MS).toISOString();
  return conMilisegundos ? iso.slice(0, 23) : iso.slice(0, 19);
}
/** Fecha actual de Lima, "YYYY-MM-DD". */
export const hoyLima = () => ahoraLima().slice(0, 10);
/** Suma días a una fecha "YYYY-MM-DD". */
export function sumarDias(fecha: string, dias: number): string {
  const d = new Date(fecha + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}
/** Minutos completos entre dos fechas "YYYY-MM-DDTHH:mm:ss" (como Duration.toMinutes()). */
export function minutosEntre(desde: string, hasta: string): number {
  const ms = Date.parse(hasta + "Z") - Date.parse(desde + "Z");
  return Math.trunc(ms / 60000);
}

// ------------------------------------------------------------------ parámetros de consulta

export class Query {
  constructor(private p: URLSearchParams) {}
  texto(n: string): string | null {
    const v = this.p.get(n);
    return v === null || v.trim() === "" ? null : v;
  }
  /** Número entero opcional (Long en Java). */
  entero(n: string): number | null {
    const v = this.texto(n);
    if (v === null) return null;
    if (!/^-?\d+$/.test(v.trim())) throw solicitudInvalida(`Valor invalido para '${n}': ${v}. Se esperaba Long`);
    return Number(v);
  }
  enumeracion<T extends string>(n: string, valores: readonly T[]): T | null {
    const v = this.texto(n);
    if (v === null) return null;
    if (!valores.includes(v as T)) {
      throw solicitudInvalida(`Valor invalido para '${n}': ${v}. Se esperaba uno de [${valores.join(", ")}]`);
    }
    return v as T;
  }
  booleano(n: string): boolean | null {
    const v = this.texto(n);
    if (v === null) return null;
    if (v === "true") return true;
    if (v === "false") return false;
    throw solicitudInvalida(`Valor invalido para '${n}': ${v}. Se esperaba Boolean`);
  }
  fecha(n: string): string | null {
    const v = this.texto(n);
    if (v === null) return null;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(v) || Number.isNaN(Date.parse(v))) {
      throw solicitudInvalida(`Valor invalido para '${n}': ${v}. Se esperaba LocalDate`);
    }
    return v;
  }
  fechaHora(n: string, obligatorio = false): string | null {
    const v = this.texto(n);
    if (v === null) {
      if (obligatorio) throw solicitudInvalida(`Falta el parametro obligatorio '${n}'`);
      return null;
    }
    const f = normalizarFechaHora(v);
    if (!f) throw solicitudInvalida(`Valor invalido para '${n}': ${v}. Se esperaba LocalDateTime`);
    return f;
  }
  todos(n: string): string[] {
    return this.p.getAll(n);
  }
}

/** Acepta "YYYY-MM-DDTHH:mm[:ss[.fff]]" y devuelve "YYYY-MM-DDTHH:mm:ss[.fff]"; null si no es válida. */
export function normalizarFechaHora(v: string): string | null {
  const m = /^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2})(:\d{2})?(\.\d{1,9})?$/.exec(v.trim());
  if (!m) return null;
  const s = `${m[1]}T${m[2]}${m[3] ?? ":00"}${m[4] ? m[4].slice(0, 4) : ""}`;
  return Number.isNaN(Date.parse(s + "Z")) ? null : s;
}

// ------------------------------------------------------------------ paginación (Pageable de Spring)

export type Paginacion = { page: number; size: number; orden: string };

/**
 * Lee page, size y sort ("propiedad,asc|desc", se puede repetir) como Spring Data.
 * columnas traduce cada propiedad Java a una expresión SQL segura.
 */
export function paginacion(q: Query, columnas: Record<string, string>, ordenPorDefecto: string, sizePorDefecto = 20): Paginacion {
  const page = Math.max(0, Number.parseInt(q.texto("page") ?? "0", 10) || 0);
  let size = Number.parseInt(q.texto("size") ?? String(sizePorDefecto), 10);
  if (!Number.isFinite(size) || size < 1) size = sizePorDefecto;
  size = Math.min(size, 2000);
  const partes: string[] = [];
  for (const s of q.todos("sort")) {
    const [prop, dir] = s.split(",").map((x) => x.trim());
    const col = columnas[prop];
    if (!col) throw solicitudInvalida(`No se puede ordenar por '${prop}'`);
    partes.push(`${col} ${dir?.toLowerCase() === "desc" ? "DESC" : "ASC"}`);
  }
  return { page, size, orden: partes.length ? partes.join(", ") : ordenPorDefecto };
}

/** Página con la forma de PagedModel de Spring (los nombres en snake_case, como el backend Java). */
export function pagina<T>(content: T[], total: number, p: Paginacion) {
  return {
    content,
    page: { size: p.size, number: p.page, total_elements: total, total_pages: Math.ceil(total / p.size) },
  };
}

// ------------------------------------------------------------------ validación del cuerpo JSON

export type Cuerpo = Record<string, unknown>;

/** Valida campos y acumula errores por campo (en snake_case), como @Valid en Spring. */
export class Validador {
  campos: Record<string, string> = {};
  constructor(public datos: Cuerpo, private prefijo = "") {}

  private error(campo: string, mensaje: string) {
    const k = this.prefijo + campo;
    if (!(k in this.campos)) this.campos[k] = mensaje;
  }
  private crudo(campo: string): unknown {
    return this.datos[campo];
  }

  /** Texto opcional; obligatorio=true equivale a @NotBlank. */
  texto(campo: string, op: { obligatorio?: boolean; max?: number; min?: number; patron?: RegExp; mensajePatron?: string } = {}): string | null {
    const v = this.crudo(campo);
    if (v === undefined || v === null) {
      if (op.obligatorio) this.error(campo, "no debe estar vacío");
      return null;
    }
    if (typeof v !== "string") throw cuerpoInvalido();
    if (op.obligatorio && v.trim() === "") {
      this.error(campo, "no debe estar vacío");
      return v;
    }
    if ((op.max !== undefined && v.length > op.max) || (op.min !== undefined && v.length < op.min)) {
      this.error(campo, `el tamaño debe estar entre ${op.min ?? 0} y ${op.max ?? 2147483647}`);
    }
    if (op.patron && !op.patron.test(v)) this.error(campo, op.mensajePatron ?? "no coincide con el patrón requerido");
    return v;
  }

  /** Número decimal opcional; obligatorio=true equivale a @NotNull. */
  numero(campo: string, op: { obligatorio?: boolean; min?: number; minExclusivoMensaje?: string; max?: number; enteros?: number; decimales?: number; mensajeMin?: string } = {}): number | null {
    const v = this.crudo(campo);
    if (v === undefined || v === null || v === "") {
      if (op.obligatorio) this.error(campo, "no debe ser nulo");
      return null;
    }
    const n = typeof v === "number" ? v : typeof v === "string" && /^-?\d+(\.\d+)?$/.test(v.trim()) ? Number(v) : NaN;
    if (!Number.isFinite(n)) throw cuerpoInvalido();
    if (op.min !== undefined && n < op.min) this.error(campo, op.mensajeMin ?? `debe ser mayor que o igual a ${op.min}`);
    if (op.max !== undefined && n > op.max) this.error(campo, `debe ser menor que o igual a ${op.max}`);
    if (op.enteros !== undefined || op.decimales !== undefined) {
      const [ent, dec = ""] = Math.abs(n).toString().split(".");
      if ((op.enteros !== undefined && ent.replace(/^0+(?=\d)/, "").length > op.enteros) || (op.decimales !== undefined && dec.length > op.decimales)) {
        this.error(campo, `valor numérico fuera de rango (se esperaba <${op.enteros ?? "?"} dígitos>.<${op.decimales ?? "?"} dígitos>)`);
      }
    }
    return n;
  }

  /** Identificador (Long). */
  id(campo: string, obligatorio = false): number | null {
    const v = this.crudo(campo);
    if (v === undefined || v === null || v === "") {
      if (obligatorio) this.error(campo, "no debe ser nulo");
      return null;
    }
    const n = typeof v === "number" ? v : typeof v === "string" && /^\d+$/.test(v) ? Number(v) : NaN;
    if (!Number.isInteger(n)) throw cuerpoInvalido();
    return n;
  }

  booleano(campo: string): boolean | null {
    const v = this.crudo(campo);
    if (v === undefined || v === null) return null;
    if (typeof v !== "boolean") throw cuerpoInvalido();
    return v;
  }

  /** Valor de una enumeración; un valor desconocido es un cuerpo inválido (como Jackson). */
  enumeracion<T extends string>(campo: string, valores: readonly T[], obligatorio = false): T | null {
    const v = this.crudo(campo);
    if (v === undefined || v === null || v === "") {
      if (obligatorio) this.error(campo, "no debe ser nulo");
      return null;
    }
    if (typeof v !== "string" || !valores.includes(v as T)) throw cuerpoInvalido();
    return v as T;
  }

  fecha(campo: string, obligatorio = false): string | null {
    const v = this.crudo(campo);
    if (v === undefined || v === null || v === "") {
      if (obligatorio) this.error(campo, "no debe ser nulo");
      return null;
    }
    if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v) || Number.isNaN(Date.parse(v))) throw cuerpoInvalido();
    return v;
  }

  fechaHora(campo: string): string | null {
    const v = this.crudo(campo);
    if (v === undefined || v === null || v === "") return null;
    const f = typeof v === "string" ? normalizarFechaHora(v) : null;
    if (!f) throw cuerpoInvalido();
    return f;
  }

  lista(campo: string, op: { noVacia?: boolean; mensajeVacia?: string; max?: number } = {}): Cuerpo[] {
    const v = this.crudo(campo);
    if (v === undefined || v === null) {
      if (op.noVacia) this.error(campo, op.mensajeVacia ?? "no debe estar vacío");
      return [];
    }
    if (!Array.isArray(v) || v.some((x) => typeof x !== "object" || x === null || Array.isArray(x))) throw cuerpoInvalido();
    if (op.noVacia && v.length === 0) this.error(campo, op.mensajeVacia ?? "no debe estar vacío");
    if (op.max !== undefined && v.length > op.max) this.error(campo, `el tamaño debe estar entre 0 y ${op.max}`);
    return v as Cuerpo[];
  }

  /** Validador para un elemento anidado (por ejemplo items[0]). */
  hijo(datos: Cuerpo, prefijo: string): Validador {
    const v = new Validador(datos, this.prefijo + prefijo);
    v.campos = this.campos;
    return v;
  }

  /** Lanza 400 con el detalle por campo si hubo errores. */
  verificar() {
    if (Object.keys(this.campos).length) throw new HttpError(400, "Datos invalidos en la solicitud", this.campos);
  }
}

export const cuerpoInvalido = () => solicitudInvalida("Cuerpo de la solicitud invalido o valor de enum desconocido");

/** Texto vacío → null; si no, recortado. */
export const vacioANull = (s: string | null | undefined) => (s === null || s === undefined || s.trim() === "" ? null : s.trim());
export const vacio = (s: string | null | undefined) => s === null || s === undefined || s.trim() === "";
