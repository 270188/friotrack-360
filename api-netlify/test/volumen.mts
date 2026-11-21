// Mide los listados con los 20 000 datos de prueba cargados (no es parte de npm test).
import fs from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import bcrypt from "bcryptjs";
const RAIZ = new URL("../../", import.meta.url).pathname;
const pg = new PGlite();
await pg.exec(fs.readFileSync(RAIZ + "Friotrack/src/main/resources/db/postgres/esquema.sql", "utf8"));
await pg.query("INSERT INTO usuario (nombre, apellido, username, password_hash, rol) VALUES ('Administrador','Sistema','admin',$1,'ADMIN')", [bcrypt.hashSync("admin123", 10)]);
for (const s of JSON.parse(fs.readFileSync(process.argv[2], "utf8"))) await pg.query(s);
const srv = new PGLiteSocketServer({ db: pg, port: 54330, host: "127.0.0.1" });
await srv.start();
Object.assign(process.env, { DATABASE_URL: "postgres://postgres:postgres@127.0.0.1:54330/postgres", DB_POOL_MAX: "1", APP_JWT_SECRET: "x".repeat(40) });
const { manejar } = await import("../src/app.ts");
const login = await (await manejar(new Request("https://a/api/auth/login", { method: "POST", body: JSON.stringify({ username: "admin", password: "admin123" }) }))).json();
for (const ruta of ["/api/dashboard", "/api/lote?page=0&size=15&sort=idLote,desc", "/api/despacho?page=3&size=15&sort=idDespacho,desc&q=lima",
  "/api/evento?page=0&size=25&sort=fechaHora,desc", "/api/comprobante?page=0&size=15&sort=idComprobante,desc", "/api/incidencia?estado=ABIERTA",
  "/api/trazabilidad/lote/1990", "/api/trazabilidad/despacho/980", "/api/control/fuera-de-rango", "/api/despacho/estado/EN_TRANSITO",
  "/api/comprobante/3", "/api/usuario?page=0&size=20&sort=idUsuario,asc"]) {
  const t = performance.now();
  const r = await manejar(new Request("https://a" + ruta, { headers: { authorization: "Bearer " + login.token } }));
  const j = await r.json();
  const n = Array.isArray(j) ? `${j.length} filas` : j.page ? `${j.content.length}/${j.page.total_elements}` : Object.keys(j).length + " campos";
  console.log(r.status, (performance.now() - t).toFixed(0).padStart(5) + " ms", ruta, n, r.status >= 400 ? JSON.stringify(j) : "");
}
const { reiniciarPool } = await import("../src/db.ts");
await reiniciarPool(); await srv.stop(); await pg.close();
