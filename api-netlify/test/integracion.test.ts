// Pruebas de integración: levanta PostgreSQL en memoria (PGlite) con el esquema real y datos de prueba,
// y recorre la API como lo hace el frontend Angular.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import bcrypt from "bcryptjs";

const RAIZ = new URL("../../", import.meta.url).pathname;
const PUERTO = 54329;
let servidor: PGLiteSocketServer;
let pg: PGlite;
let manejar: (r: Request) => Promise<Response>;
let tokenAdmin = "";

before(async () => {
  pg = new PGlite();
  await pg.exec(fs.readFileSync(RAIZ + "Friotrack/src/main/resources/db/postgres/esquema.sql", "utf8"));
  await pg.query(
    "INSERT INTO usuario (nombre, apellido, username, password_hash, rol) VALUES ('Administrador', 'Sistema', 'admin', $1, 'ADMIN')",
    [bcrypt.hashSync("admin123", 10)],
  );
  const semilla = process.env.SEMILLA;
  if (semilla && fs.existsSync(semilla)) {
    for (const s of JSON.parse(fs.readFileSync(semilla, "utf8")) as string[]) await pg.query(s);
  }
  servidor = new PGLiteSocketServer({ db: pg, port: PUERTO, host: "127.0.0.1" });
  await servidor.start();
  process.env.DATABASE_URL = `postgres://postgres:postgres@127.0.0.1:${PUERTO}/postgres`;
  process.env.DB_POOL_MAX = "1";
  process.env.APP_JWT_SECRET = "clave-de-pruebas-de-al-menos-32-caracteres-123";
  process.env.APP_CORS_ORIGINS = "https://friotrack-360.vercel.app";
  process.env.SUNAT_URL = "http://127.0.0.1:1/billService"; // sin red: el envío debe quedar en ERROR
  process.env.SUNAT_RUC = "20000000001";
  process.env.SUNAT_SERIE_FACTURA = "FFT1";
  process.env.SUNAT_SERIE_BOLETA = "BFT1";
  process.env.SUNAT_SERIE_GUIA = "TFT1";
  ({ manejar } = await import("../src/app.ts"));
});

after(async () => {
  const { reiniciarPool } = await import("../src/db.ts");
  await reiniciarPool();
  await servidor.stop();
  await pg.close();
});

async function api(metodo: string, ruta: string, cuerpo?: unknown, token = tokenAdmin, extra: Record<string, string> = {}) {
  const headers: Record<string, string> = { ...extra };
  if (token) headers.authorization = `Bearer ${token}`;
  if (cuerpo !== undefined) headers["content-type"] = "application/json";
  const r = await manejar(new Request("https://api.test" + ruta, { method: metodo, headers, body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo) }));
  const t = r.status === 204 ? "" : await r.text();
  let json: any = null;
  try { json = t ? JSON.parse(t) : null; } catch { json = t; }
  return { status: r.status, json, headers: r.headers };
}

test("login, perfil y errores de autenticación", async () => {
  const mal = await api("POST", "/api/auth/login", { username: "admin", password: "x" }, "");
  assert.equal(mal.status, 422);
  assert.equal(mal.json.mensaje, "Usuario o contrasena incorrectos");
  const r = await api("POST", "/api/auth/login", { username: "admin", password: "admin123" }, "");
  assert.equal(r.status, 200);
  assert.equal(r.json.tipo, "Bearer");
  assert.equal(r.json.rol, "ADMIN");
  assert.equal(r.json.expira_en_segundos, 7200);
  tokenAdmin = r.json.token;
  const yo = await api("GET", "/api/auth/me");
  assert.equal(yo.json.username, "admin");
  assert.equal(yo.json.password_hash, undefined);
  const sin = await api("GET", "/api/lote", undefined, "");
  assert.equal(sin.status, 401);
  assert.equal(sin.json.mensaje, "Credenciales invalidas o token ausente");
  assert.equal((await api("GET", "/api/no-existe")).status, 404);
  assert.equal((await api("DELETE", "/api/dashboard")).status, 405);
});

test("CORS: preflight permitido y origen ajeno rechazado", async () => {
  const pre = await manejar(new Request("https://api.test/api/lote", {
    method: "OPTIONS", headers: { origin: "https://friotrack-360.vercel.app", "access-control-request-method": "GET" },
  }));
  assert.equal(pre.status, 200);
  assert.equal(pre.headers.get("access-control-allow-origin"), "https://friotrack-360.vercel.app");
  const r = await api("GET", "/api/auth/me", undefined, tokenAdmin, { origin: "https://friotrack-360.vercel.app" });
  assert.equal(r.headers.get("access-control-allow-origin"), "https://friotrack-360.vercel.app");
  const ajeno = await api("GET", "/api/auth/me", undefined, tokenAdmin, { origin: "https://otro.com" });
  assert.equal(ajeno.status, 403);
});

test("flujo completo: producto, lote, despacho, control fuera de rango e incidencia", async () => {
  const p = await api("POST", "/api/producto", { nombre: "Yogurt test", categoria: "Lácteos", temperatura_min: 2, temperatura_max: 6 });
  assert.equal(p.status, 201, JSON.stringify(p.json));
  assert.equal(p.json.define_rango_temperatura, true);
  const rangoMal = await api("POST", "/api/producto", { nombre: "X", temperatura_min: 9, temperatura_max: 2 });
  assert.equal(rangoMal.status, 422);
  const sinNombre = await api("POST", "/api/producto", { categoria: "x" });
  assert.equal(sinNombre.status, 400);
  assert.ok(sinNombre.json.campos.nombre);

  const l = await api("POST", "/api/lote", { id_producto: p.json.id_producto, codigo_lote: "LOT-T-1", cantidad: 100, fecha_vencimiento: "2099-01-01" });
  assert.equal(l.status, 201, JSON.stringify(l.json));
  assert.equal(l.json.producto.nombre, "Yogurt test");
  assert.equal(l.json.unidad, "UNIDAD");
  assert.equal(l.json.vencido, false);
  assert.equal((await api("POST", "/api/lote", { id_producto: p.json.id_producto, codigo_lote: "LOT-T-1", cantidad: 1 })).status, 409);

  const d = await api("POST", "/api/despacho", { codigo: "DSP-T-1", destino: "Lima", fecha_programada: "2026-12-01T08:00" });
  assert.equal(d.status, 201, JSON.stringify(d.json));
  assert.equal(d.json.estado, "PENDIENTE");
  assert.equal(d.json.usuario.username, "admin");
  const it = await api("POST", `/api/despacho/${d.json.id_despacho}/lotes`, { id_lote: l.json.id_lote, cantidad: 60 });
  assert.equal(it.status, 201, JSON.stringify(it.json));
  assert.equal(it.json.lote.producto, "Yogurt test");
  const exceso = await api("POST", `/api/despacho/${d.json.id_despacho}/lotes`, { id_lote: l.json.id_lote, cantidad: 60 });
  assert.equal(exceso.status, 409);
  assert.equal((await api("GET", `/api/despacho/${d.json.id_despacho}`)).json.estado, "PREPARACION");

  const sal = await api("PATCH", `/api/despacho/${d.json.id_despacho}/estado`, { estado: "EN_TRANSITO" });
  assert.equal(sal.status, 200, JSON.stringify(sal.json));
  assert.ok(sal.json.fecha_salida);
  assert.equal((await api("GET", `/api/lote/${l.json.id_lote}`)).json.estado, "EN_TRANSITO");

  const c = await api("POST", "/api/control", { id_despacho: d.json.id_despacho, id_lote: l.json.id_lote, temperatura: 10.4 });
  assert.equal(c.status, 201, JSON.stringify(c.json));
  assert.equal(c.json.resultado, "FUERA_RANGO");
  assert.equal(c.json.motivo_desviacion, "temperatura 10.40 °C fuera de 2.00-6.00 °C");

  const inc = await api("GET", `/api/incidencia?idDespacho=${d.json.id_despacho}`);
  assert.equal(inc.json.length, 1);
  assert.equal(inc.json[0].tipo, "TEMPERATURA");
  assert.equal(inc.json[0].prioridad, "ALTA");
  const idInc = inc.json[0].id_incidencia;
  const ev = await api("POST", `/api/incidencia/${idInc}/evidencias`, { tipo: "FOTO", nombre_archivo: "foto.jpg" });
  assert.equal(ev.status, 201, JSON.stringify(ev.json));
  const sinCausa = await api("PATCH", `/api/incidencia/${idInc}/estado`, { estado: "RESUELTA" });
  assert.equal(sinCausa.status, 422);
  const res = await api("PATCH", `/api/incidencia/${idInc}/estado`, { estado: "RESUELTA", causa: "Puerta abierta", accion: "Se cerró" });
  assert.equal(res.status, 200, JSON.stringify(res.json));
  assert.equal(res.json.evidencias.length, 1);
  assert.equal(typeof res.json.minutos_resolucion, "number");

  const ent = await api("PATCH", `/api/despacho/${d.json.id_despacho}/estado`, { estado: "ENTREGADO" });
  assert.equal(ent.status, 200);
  const tr = await api("GET", `/api/trazabilidad/lote/${l.json.id_lote}`);
  assert.equal(tr.status, 200);
  assert.equal(tr.json.estado, "ENTREGADO");
  assert.equal(tr.json.despachos[0].codigo, "DSP-T-1");
  assert.equal(tr.json.controles.length, 1);
  assert.equal(tr.json.evidencias.length, 1);
  assert.deepEqual(tr.json.timeline.map((t: any) => t.tipo).slice(0, 4), ["CREACION_LOTE", "PREPARACION", "SALIDA", "CONTROL"]);
  const td = await api("GET", `/api/trazabilidad/despacho/${d.json.id_despacho}`);
  assert.equal(td.json.responsable, "admin");
  assert.equal(td.json.lotes[0].producto, "Yogurt test");
});

test("roles: CALIDAD no crea productos y OPERADOR no bloquea lotes", async () => {
  for (const [u, rol] of [["cal", "CALIDAD"], ["ope", "OPERADOR"]]) {
    const r = await api("POST", "/api/usuario", { nombre: "N", apellido: "A", username: u, password: "clave1234", rol });
    assert.equal(r.status, 201, JSON.stringify(r.json));
  }
  const tCal = (await api("POST", "/api/auth/login", { username: "cal", password: "clave1234" }, "")).json.token;
  const tOpe = (await api("POST", "/api/auth/login", { username: "ope", password: "clave1234" }, "")).json.token;
  assert.equal((await api("POST", "/api/producto", { nombre: "X" }, tCal)).status, 403);
  assert.equal((await api("PATCH", "/api/lote/1/bloquear", {}, tOpe)).status, 403);
  assert.equal((await api("GET", "/api/usuario/activos", undefined, tOpe)).status, 200);
  assert.equal((await api("POST", "/api/usuario", { nombre: "x" }, tOpe)).status, 403);
  const cambio = await api("PATCH", "/api/auth/password", { password_actual: "clave1234", password_nuevo: "clave1234" }, tCal);
  assert.equal(cambio.status, 422);
  assert.equal(cambio.json.mensaje, "La nueva contraseña debe ser distinta de la actual");
  assert.equal((await api("PATCH", "/api/auth/password", { password_actual: "clave1234", password_nuevo: "nueva12345" }, tCal)).status, 200);
});

test("listados paginados con los parámetros del frontend", async () => {
  const lotes = await api("GET", "/api/lote?q=LOT&page=0&size=15&sort=idLote,desc");
  assert.equal(lotes.status, 200);
  assert.ok(lotes.json.page.total_elements >= 1);
  const desp = await api("GET", "/api/despacho?q=&estado=&page=0&size=15&sort=idDespacho,desc");
  assert.equal(desp.status, 200, JSON.stringify(desp.json));
  const prod = await api("GET", "/api/producto?q=yog&activo=true&page=0&size=15&sort=nombre,asc");
  assert.equal(prod.json.content[0].nombre, "Yogurt test");
  const evs = await api("GET", "/api/evento?tipo=&desde=2026-01-01T00:00:00&hasta=2099-12-31T23:59:59&page=0&size=25&sort=fechaHora,desc");
  assert.equal(evs.status, 200, JSON.stringify(evs.json));
  assert.ok(evs.json.content.length > 0);
  const usu = await api("GET", "/api/usuario?page=0&size=20&sort=idUsuario,asc");
  assert.equal(usu.json.content[0].username, "admin");
  const dash = await api("GET", "/api/dashboard");
  assert.equal(dash.status, 200, JSON.stringify(dash.json));
  assert.equal(dash.json.despachos_por_estado.length, 5);
  assert.ok(dash.json.cumplimiento.controles >= 1);
  const abiertas = await api("GET", "/api/incidencia?estado=ABIERTA&prioridad=");
  assert.equal(abiertas.status, 200);
  assert.equal((await api("GET", "/api/lote?estado=XYZ")).status, 400);
  assert.equal((await api("GET", "/api/lote/codigo/NO-EXISTE")).status, 404);
});

test("comprobantes: factura firmada, envío sin red y guía de remisión", async () => {
  const { verificar } = await import("../src/sunat/firma.ts");
  const em = await api("GET", "/api/comprobante/emisor");
  assert.equal(em.json.serie_factura, "FFT1");
  const sinRuc = await api("POST", "/api/comprobante/venta", {
    tipo: "01", cliente_tipo_doc: "1", cliente_num_doc: "12345678", cliente_nombre: "Juan",
    items: [{ descripcion: "Yogurt", cantidad: 1, precio_unitario: 5.9 }],
  });
  assert.equal(sinRuc.status, 422);
  const f = await api("POST", "/api/comprobante/venta", {
    tipo: "01", cliente_tipo_doc: "6", cliente_num_doc: "20100070970", cliente_nombre: "SUPERMERCADOS PERUANOS S.A.",
    id_despacho: 1, items: [{ codigo: "P001", descripcion: "Yogurt natural 1L", unidad: "und", cantidad: 3, precio_unitario: 5.9 },
      { descripcion: "Queso fresco", unidad: "kg", cantidad: 2.5, precio_unitario: 18.5 }],
  });
  assert.equal(f.status, 201, JSON.stringify(f.json));
  assert.equal(f.json.numero, "FFT1-1");
  assert.equal(f.json.op_gravada, 54.19);
  assert.equal(f.json.igv, 9.76);
  assert.equal(f.json.total, 63.95);
  assert.equal(f.json.monto_en_letras, "SON SESENTA Y TRES CON 95/100 SOLES");
  assert.equal(f.json.items[1].unidad, "KGM");
  assert.equal(f.json.items[0].valor_unitario, 5);
  assert.equal(f.json.estado_sunat, "ERROR");
  assert.equal(f.json.tiene_xml, true);
  assert.ok(f.json.hash.length > 20);
  const xml = await manejar(new Request(`https://api.test/api/comprobante/${f.json.id_comprobante}/xml`, { headers: { authorization: `Bearer ${tokenAdmin}` } }));
  assert.equal(xml.status, 200);
  assert.match(xml.headers.get("content-disposition")!, /20000000001-01-FFT1-1\.xml/);
  const texto = await xml.text();
  assert.ok(texto.includes('<ds:Signature Id="SignSUNAT"'));
  assert.ok(texto.includes("<cbc:PriceAmount currencyID=\"PEN\">15.677966</cbc:PriceAmount>"));
  assert.equal(verificar(texto), true, "la firma debe validar");
  const otra = await api("POST", "/api/comprobante/venta", {
    tipo: "03", cliente_tipo_doc: "1", cliente_num_doc: "12345678", cliente_nombre: "Juan",
    items: [{ descripcion: "Yogurt", cantidad: 1, precio_unitario: 25 }],
  });
  assert.equal(otra.json.numero, "BFT1-1");
  const re = await api("POST", `/api/comprobante/${f.json.id_comprobante}/reenviar`);
  assert.equal(re.status, 200);
  const g = await api("POST", "/api/comprobante/guia", {
    cliente_tipo_doc: "6", cliente_num_doc: "20100070970", cliente_nombre: "SUPERMERCADOS PERUANOS S.A.", motivo: "01", modalidad: "02",
    fecha_traslado: "2099-01-01", peso_kg: 120.5, conductor_dni: "45678912", conductor_nombres: "Carlos", conductor_apellidos: "Quispe",
    conductor_licencia: "Q45678912", placa: "ABC-123", partida_ubigeo: "150101", partida_direccion: "Av. Lima 123",
    llegada_ubigeo: "200101", llegada_direccion: "Av. Grau 456, Piura: tienda #2", items: [{ descripcion: "Yogurt", cantidad: 10 }],
  });
  assert.equal(g.status, 201, JSON.stringify(g.json));
  assert.equal(g.json.estado_sunat, "NO_ENVIADO");
  assert.equal(g.json.traslado.llegada_direccion, "Av. Grau 456, Piura: tienda #2");
  assert.equal(g.json.traslado.peso_kg, 120.5);
  assert.equal(g.json.monto_en_letras, null);
  assert.equal((await api("POST", `/api/comprobante/${g.json.id_comprobante}/reenviar`)).status, 422);
  const lista = await api("GET", "/api/comprobante?tipo=&q=FFT1&page=0&size=15&sort=idComprobante,desc");
  assert.equal(lista.json.content[0].numero, "FFT1-1");
  const porDesp = await api("GET", "/api/comprobante/despacho/1");
  assert.equal(porDesp.json.length, 1);
});
