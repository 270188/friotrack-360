// /api/comprobante (ComprobanteController + ComprobanteService): facturas, boletas y guías de remisión.
import { ahoraLima, archivo, creado, hoyLima, noEncontrado, ok, pagina, paginacion, reglaNegocio, vacio, vacioANull,
  Validador, type Cuerpo } from "../core.ts";
import { enTransaccion, type Db, type Fila } from "../db.ts";
import { registrarEvento } from "../dominio.ts";
import { idDe, type Router } from "../router.ts";
import type { Usuario } from "../auth.ts";
import { dec, sumar, texto, aNumero, type Dec } from "../sunat/decimal.ts";
import { BOLETA, FACTURA, GUIA_REMISION, lineaGravada, montoEnLetras, unidadSunat, type Emisor, type Linea } from "../sunat/documento.ts";
import { xmlGuia, xmlVenta } from "../sunat/xml.ts";
import { firmar } from "../sunat/firma.ts";
import { enviar, URL_BETA } from "../sunat/cliente.ts";

const MOTIVOS: Record<string, string> = {
  "01": "VENTA",
  "02": "COMPRA",
  "04": "TRASLADO ENTRE ESTABLECIMIENTOS DE LA MISMA EMPRESA",
  "13": "OTROS",
};

// ------------------------------------------------------------------ configuración del emisor (SunatProperties)

const env = (n: string, d: string | null) => (process.env[n] && process.env[n]!.trim() ? process.env[n]!.trim() : d);
export function configSunat() {
  const entorno = env("SUNAT_ENTORNO", "BETA")!.toUpperCase();
  return {
    entorno,
    prueba: entorno !== "PRODUCCION",
    url: env("SUNAT_URL", URL_BETA)!,
    emisor: {
      ruc: env("SUNAT_RUC", "20000000001")!,
      razonSocial: env("SUNAT_RAZON_SOCIAL", "EMPRESA DE PRUEBA S.A.C.")!,
      nombreComercial: env("SUNAT_NOMBRE_COMERCIAL", null) as string,
      ubigeo: env("SUNAT_UBIGEO", "150101")!,
      departamento: env("SUNAT_DEPARTAMENTO", "LIMA")!,
      provincia: env("SUNAT_PROVINCIA", "LIMA")!,
      distrito: env("SUNAT_DISTRITO", "LIMA")!,
      direccion: env("SUNAT_DIRECCION", "-")!,
      usuarioSol: env("SUNAT_USUARIO_SOL", "MODDATOS")!,
      claveSol: env("SUNAT_CLAVE_SOL", "moddatos")!,
    } as Emisor,
    serieFactura: env("SUNAT_SERIE_FACTURA", "F001")!.toUpperCase(),
    serieBoleta: env("SUNAT_SERIE_BOLETA", "B001")!.toUpperCase(),
    serieGuia: env("SUNAT_SERIE_GUIA", "T001")!.toUpperCase(),
  };
}

function emisorDto() {
  const c = configSunat();
  const e = c.emisor;
  return {
    ruc: e.ruc, razon_social: e.razonSocial, nombre_comercial: e.nombreComercial, direccion: e.direccion, distrito: e.distrito,
    provincia: e.provincia, departamento: e.departamento, ubigeo: e.ubigeo, entorno: c.entorno, prueba: c.prueba,
    serie_factura: c.serieFactura, serie_boleta: c.serieBoleta, serie_guia: c.serieGuia,
  };
}

// ------------------------------------------------------------------ datos de traslado (formato java.util.Properties)

const CAMPOS_TRASLADO = ["motivo", "descripcionMotivo", "modalidad", "fechaTraslado", "pesoKg", "transportistaRuc", "transportistaNombre",
  "conductorDni", "conductorNombres", "conductorApellidos", "conductorLicencia", "placa", "partidaUbigeo", "partidaDireccion",
  "llegadaUbigeo", "llegadaDireccion"] as const;
type Traslado = Partial<Record<(typeof CAMPOS_TRASLADO)[number], string | null>>;

function escaparPropiedad(s: string, esClave: boolean): string {
  let r = "";
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    const c = ch.charCodeAt(0);
    if (ch === "\\") r += "\\\\";
    else if (ch === "\t") r += "\\t";
    else if (ch === "\n") r += "\\n";
    else if (ch === "\r") r += "\\r";
    else if (ch === "\f") r += "\\f";
    else if ("=:#!".includes(ch)) r += "\\" + ch;
    else if (ch === " " && (i === 0 || esClave)) r += "\\ ";
    else if (c < 0x20 || c > 0x7e) r += "\\u" + c.toString(16).toUpperCase().padStart(4, "0");
    else r += ch;
  }
  return r;
}

function serializarTraslado(t: Traslado): string {
  const lineas = [`#${new Date().toUTCString()}`];
  for (const k of CAMPOS_TRASLADO) {
    const v = t[k];
    if (v !== null && v !== undefined && v.trim() !== "") lineas.push(`${escaparPropiedad(k, true)}=${escaparPropiedad(v, false)}`);
  }
  return lineas.join("\n") + "\n";
}

function leerTraslado(textoProp: string | null) {
  if (!textoProp || !textoProp.trim()) return null;
  const p: Record<string, string> = {};
  const lineas = textoProp.replace(/\r\n?/g, "\n").split("\n");
  for (let i = 0; i < lineas.length; i++) {
    let l = lineas[i].replace(/^[ \t\f]+/, "");
    if (!l || l.startsWith("#") || l.startsWith("!")) continue;
    while (/(^|[^\\])(\\\\)*\\$/.test(l) && i + 1 < lineas.length) l = l.slice(0, -1) + lineas[++i].replace(/^[ \t\f]+/, "");
    const m = /^((?:\\.|[^=:\s\\])*)\s*[=:]?\s*(.*)$/.exec(l);
    if (!m) continue;
    const des = (s: string) => s.replace(/\\(u[0-9a-fA-F]{4}|.)/g, (_x, e: string) =>
      e.length === 5 ? String.fromCharCode(parseInt(e.slice(1), 16)) : ({ t: "\t", n: "\n", r: "\r", f: "\f" } as Record<string, string>)[e] ?? e);
    p[des(m[1])] = des(m[2]);
  }
  const s = (k: string) => p[k] ?? null;
  return {
    motivo: s("motivo"), descripcion_motivo: s("descripcionMotivo"), modalidad: s("modalidad"), fecha_traslado: s("fechaTraslado"),
    peso_kg: s("pesoKg") === null ? null : Number(s("pesoKg")), transportista_ruc: s("transportistaRuc"),
    transportista_nombre: s("transportistaNombre"), conductor_dni: s("conductorDni"), conductor_nombres: s("conductorNombres"),
    conductor_apellidos: s("conductorApellidos"), conductor_licencia: s("conductorLicencia"), placa: s("placa"),
    partida_ubigeo: s("partidaUbigeo"), partida_direccion: s("partidaDireccion"), llegada_ubigeo: s("llegadaUbigeo"),
    llegada_direccion: s("llegadaDireccion"),
  };
}

// ------------------------------------------------------------------ DTO

const SQL_COMPROBANTE = `
  SELECT c.*, d.codigo AS codigo_despacho, u.username
  FROM comprobante c LEFT JOIN despacho d ON d.id_despacho = c.id_despacho JOIN usuario u ON u.id_usuario = c.id_usuario`;

const resumenDto = (c: Fila) => ({
  id_comprobante: c.id_comprobante, tipo: c.tipo, serie: c.serie, correlativo: c.correlativo, numero: `${c.serie}-${c.correlativo}`,
  fecha_emision: c.fecha_emision, cliente_tipo_doc: c.cliente_tipo_doc, cliente_num_doc: c.cliente_num_doc,
  cliente_nombre: c.cliente_nombre, moneda: c.moneda, total: c.total, estado_sunat: c.estado_sunat,
  codigo_respuesta: c.codigo_respuesta, id_despacho: c.id_despacho, codigo_despacho: c.codigo_despacho,
});

async function detalle(db: Db, id: number) {
  const c = await db.uno(`${SQL_COMPROBANTE} WHERE c.id_comprobante = $1`, [id]);
  if (!c) throw noEncontrado("Comprobante", id);
  const items = await db.q("SELECT * FROM comprobante_item WHERE id_comprobante = $1 ORDER BY orden ASC, id_item ASC", [id]);
  return {
    id_comprobante: c.id_comprobante, tipo: c.tipo, serie: c.serie, correlativo: c.correlativo, numero: `${c.serie}-${c.correlativo}`,
    fecha_emision: c.fecha_emision, moneda: c.moneda, cliente_tipo_doc: c.cliente_tipo_doc, cliente_num_doc: c.cliente_num_doc,
    cliente_nombre: c.cliente_nombre, cliente_direccion: c.cliente_direccion, op_gravada: c.op_gravada, igv: c.igv, total: c.total,
    monto_en_letras: c.tipo === GUIA_REMISION ? null : montoEnLetras(c.total),
    id_despacho: c.id_despacho, codigo_despacho: c.codigo_despacho, traslado: leerTraslado(c.datos_traslado),
    observacion: c.observacion, entorno: c.entorno, estado_sunat: c.estado_sunat, codigo_respuesta: c.codigo_respuesta,
    descripcion_respuesta: c.descripcion_respuesta,
    observaciones_sunat: c.observaciones_sunat ? String(c.observaciones_sunat).split("\n").filter((s) => s.trim()) : [],
    hash: c.hash, tiene_xml: c.xml_firmado !== null, tiene_cdr: c.cdr_base64 !== null, fecha_envio: c.fecha_envio,
    username: c.username, fecha_creacion: c.fecha_creacion,
    items: items.map((i) => ({
      orden: i.orden, codigo: i.codigo, descripcion: i.descripcion, unidad: i.unidad, cantidad: i.cantidad,
      valor_unitario: i.valor_unitario, precio_unitario: i.precio_unitario, valor_venta: i.valor_venta, igv: i.igv,
      total: aNumero(sumar(dec(i.valor_venta), dec(i.igv))),
    })),
    emisor: emisorDto(),
  };
}

// ------------------------------------------------------------------ apoyo

const nombreTipo = (t: string) => (t === "01" ? "Factura" : t === "03" ? "Boleta" : t === "09" ? "Guía de remisión" : "Comprobante");
const nombreArchivo = (c: { tipo: string; serie: string; correlativo: number }) =>
  `${configSunat().emisor.ruc}-${c.tipo}-${c.serie}-${c.correlativo}`;

function validarDocumento(tipo: string, numero: string) {
  if (tipo === "1" && numero.length !== 8) throw reglaNegocio("El DNI debe tener 8 dígitos");
  if (tipo === "6" && numero.length !== 11) throw reglaNegocio("El RUC debe tener 11 dígitos");
}

function leerItems(v: Validador, conPrecio: boolean) {
  const lista = v.lista("items", { noVacia: true, mensajeVacia: "Agrega al menos un item", max: 50 });
  return lista.map((it, k) => {
    const h = v.hijo(it, `items[${k}].`);
    return {
      codigo: h.texto("codigo", { max: 50 }),
      descripcion: h.texto("descripcion", { obligatorio: true, max: 500 })!,
      unidad: h.texto("unidad", { max: 20 }),
      cantidad: h.numero("cantidad", { obligatorio: true, min: 0.001, enteros: 9, decimales: 3, mensajeMin: "La cantidad debe ser mayor a 0" }),
      precio_unitario: conPrecio
        ? h.numero("precio_unitario", { min: 0.01, enteros: 9, decimales: 2, mensajeMin: "El precio debe ser mayor a 0" })
        : null,
    };
  });
}

const DOC = /^(\d{8}|\d{11})$/;

async function despachoExiste(db: Db, id: number | null) {
  if (id === null) return null;
  const d = await db.uno("SELECT id_despacho, codigo FROM despacho WHERE id_despacho = $1", [id]);
  if (!d) throw noEncontrado("Despacho", id);
  return d;
}

/**
 * Inserta el comprobante con el siguiente correlativo de su serie. El bloqueo por serie evita que dos
 * emisiones simultáneas tomen el mismo número (se libera al terminar la transacción).
 */
async function insertarComprobante(db: Db, datos: Record<string, unknown>) {
  const cols = Object.keys(datos);
  await db.q("SELECT pg_advisory_xact_lock(hashtext($1))", [`comprobante:${datos.tipo}:${datos.serie}`]);
  const correlativo = Number(await db.valor("SELECT COALESCE(MAX(correlativo), 0) + 1 FROM comprobante WHERE tipo = $1 AND serie = $2",
    [datos.tipo, datos.serie]));
  const fila = await db.uno(
    `INSERT INTO comprobante (${cols.join(", ")}, correlativo) VALUES (${cols.map((_, i) => `$${i + 1}`).join(", ")}, $${cols.length + 1})
     RETURNING id_comprobante, correlativo`,
    [...cols.map((c) => datos[c]), correlativo]);
  return fila!;
}

async function guardarItems(db: Db, idComprobante: number, items: Record<string, unknown>[]) {
  for (const [k, it] of items.entries()) {
    await db.q(
      `INSERT INTO comprobante_item (id_comprobante, orden, codigo, descripcion, unidad, cantidad, valor_unitario, precio_unitario, valor_venta, igv)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [idComprobante, k + 1, it.codigo, it.descripcion, it.unidad, it.cantidad, it.valor_unitario ?? 0, it.precio_unitario ?? 0,
        it.valor_venta ?? 0, it.igv ?? 0]);
  }
}

/** Envía a SUNAT y guarda la respuesta (fuera de la transacción de emisión: el número ya quedó reservado). */
async function enviarYGuardar(db: Db, c: { id: number; tipo: string; serie: string; correlativo: number }, xml: string) {
  const cfg = configSunat();
  const r = await enviar(cfg.emisor, nombreArchivo(c), xml, cfg.url);
  await db.q(
    `UPDATE comprobante SET fecha_envio = $2, estado_sunat = $3, codigo_respuesta = $4, descripcion_respuesta = $5,
            observaciones_sunat = $6, cdr_base64 = COALESCE($7, cdr_base64) WHERE id_comprobante = $1`,
    [c.id, ahoraLima(), r.estado, r.codigo, r.descripcion && r.descripcion.length > 4000 ? r.descripcion.slice(0, 4000) : r.descripcion,
      r.observaciones.length ? r.observaciones.join("\n") : null, r.cdrZip ? Buffer.from(r.cdrZip).toString("base64") : null]);
}

async function eventoComprobante(db: Db, idComprobante: number, actor: Usuario) {
  const c = await db.uno(`${SQL_COMPROBANTE} WHERE c.id_comprobante = $1`, [idComprobante]);
  if (!c || c.id_despacho === null) return;
  await registrarEvento(db, "OTRO", null, c.id_despacho, actor,
    `${nombreTipo(c.tipo)} ${c.serie}-${c.correlativo} emitida para el despacho ${c.codigo_despacho} (SUNAT: ${c.estado_sunat})`);
}

// ------------------------------------------------------------------ rutas

const COLUMNAS: Record<string, string> = {
  idComprobante: "c.id_comprobante", fechaEmision: "c.fecha_emision", correlativo: "c.correlativo", total: "c.total",
  tipo: "c.tipo", serie: "c.serie", clienteNombre: "c.cliente_nombre",
};

export function rutasComprobantes(r: Router) {
  r.get("/api/comprobante", async (ctx) => {
    const tipo = ctx.query.texto("tipo")?.trim() || null;
    const q = ctx.query.texto("q")?.trim() || null;
    const p = paginacion(ctx.query, COLUMNAS, "c.id_comprobante DESC");
    const where = `($1::text IS NULL OR c.tipo = $1)
      AND ($2::text IS NULL OR LOWER(c.cliente_nombre) LIKE '%' || LOWER($2) || '%' OR c.cliente_num_doc LIKE '%' || $2 || '%'
           OR LOWER(c.serie || '-' || c.correlativo::text) LIKE '%' || LOWER($2) || '%')`;
    const total = Number(await ctx.db.valor(`SELECT COUNT(*) FROM comprobante c WHERE ${where}`, [tipo, q]));
    const filas = await ctx.db.q(`${SQL_COMPROBANTE} WHERE ${where} ORDER BY ${p.orden} LIMIT $3 OFFSET $4`, [tipo, q, p.size, p.page * p.size]);
    return ok(pagina(filas.map(resumenDto), total, p));
  });
  r.get("/api/comprobante/emisor", async () => ok(emisorDto()));
  r.get("/api/comprobante/despacho/:idDespacho", async (ctx) =>
    ok((await ctx.db.q(`${SQL_COMPROBANTE} WHERE c.id_despacho = $1 ORDER BY c.fecha_emision DESC`, [idDe(ctx, "idDespacho")])).map(resumenDto)));
  r.get("/api/comprobante/:id", async (ctx) => ok(await detalle(ctx.db, idDe(ctx))));
  r.get("/api/comprobante/:id/xml", async (ctx) => {
    const c = await ctx.db.uno("SELECT tipo, serie, correlativo, xml_firmado FROM comprobante WHERE id_comprobante = $1", [idDe(ctx)]);
    if (!c) throw noEncontrado("Comprobante", idDe(ctx));
    if (c.xml_firmado === null) throw noEncontrado(`El comprobante ${c.serie}-${c.correlativo} no tiene XML`);
    return archivo(`${nombreArchivo(c as any)}.xml`, "application/xml", new TextEncoder().encode(c.xml_firmado));
  });
  r.get("/api/comprobante/:id/cdr", async (ctx) => {
    const c = await ctx.db.uno("SELECT tipo, serie, correlativo, cdr_base64 FROM comprobante WHERE id_comprobante = $1", [idDe(ctx)]);
    if (!c) throw noEncontrado("Comprobante", idDe(ctx));
    if (c.cdr_base64 === null) throw noEncontrado(`El comprobante ${c.serie}-${c.correlativo} no tiene constancia de recepción (CDR)`);
    return archivo(`R-${nombreArchivo(c as any)}.zip`, "application/zip", new Uint8Array(Buffer.from(c.cdr_base64, "base64")));
  });

  // ---------------------------------------------------------------- factura y boleta
  r.post("/api/comprobante/venta", async (ctx) => {
    const body = await ctx.body();
    const v = new Validador(body);
    const tipo = v.texto("tipo", { obligatorio: true, patron: /^(01|03)$/, mensajePatron: "tipo debe ser 01 (factura) o 03 (boleta)" })!;
    const tdoc = v.texto("cliente_tipo_doc", { obligatorio: true, patron: /^(1|6)$/, mensajePatron: "Tipo de documento: 1 (DNI) o 6 (RUC)" })!;
    const ndoc = v.texto("cliente_num_doc", { obligatorio: true, patron: DOC, mensajePatron: "DNI de 8 digitos o RUC de 11" })!;
    const nombre = v.texto("cliente_nombre", { obligatorio: true, max: 200 })!;
    const direccion = v.texto("cliente_direccion", { max: 255 });
    const idDespacho = v.id("id_despacho");
    const observacion = v.texto("observacion", { max: 500 });
    const items = leerItems(v, true);
    v.verificar();
    const factura = tipo === FACTURA;
    if (factura && !(tdoc === "6" && ndoc.length === 11)) throw reglaNegocio("La factura requiere el RUC (11 dígitos) del cliente");
    validarDocumento(tdoc, ndoc);
    for (const i of items) if (i.precio_unitario === null) throw reglaNegocio(`Indica el precio de "${i.descripcion}"`);

    const cfg = configSunat();
    const actor = ctx.yo();
    const ahora = ahoraLima();
    const lineas: Linea[] = items.map((i) =>
      lineaGravada(vacioANull(i.codigo), i.descripcion.trim(), unidadSunat(i.unidad), dec(i.cantidad!), dec(i.precio_unitario!)));
    let gravada: Dec = dec(0), igv: Dec = dec(0);
    for (const l of lineas) { gravada = sumar(gravada, l.valorVenta); igv = sumar(igv, l.igv); }
    const total = sumar(gravada, igv);
    const serie = factura ? cfg.serieFactura : cfg.serieBoleta;

    // 1. Se reserva el número, se firma y se guarda (transacción corta).
    const emitido = await enTransaccion(async (tx) => {
      await despachoExiste(tx, idDespacho);
      const fila = await insertarComprobante(tx, {
        tipo, serie, fecha_emision: ahora, moneda: "PEN", cliente_tipo_doc: tdoc, cliente_num_doc: ndoc, cliente_nombre: nombre.trim(),
        cliente_direccion: vacioANull(direccion), op_gravada: texto(gravada), igv: texto(igv), total: texto(total), id_despacho: idDespacho,
        observacion: vacioANull(observacion), entorno: cfg.entorno, estado_sunat: "PENDIENTE", id_usuario: actor.id_usuario,
        fecha_creacion: ahora,
      });
      const firmado = firmar(xmlVenta(cfg.emisor, {
        tipo, serie, correlativo: fila.correlativo, fecha: ahora.slice(0, 10), hora: ahora.slice(11, 19), moneda: "PEN",
        cliente: { tipoDoc: tdoc, numDoc: ndoc, nombre: nombre.trim(), direccion: vacioANull(direccion) }, lineas, gravada, igv, total,
      }));
      await tx.q("UPDATE comprobante SET xml_firmado = $2, hash = $3 WHERE id_comprobante = $1", [fila.id_comprobante, firmado.xml, firmado.hash]);
      await guardarItems(tx, fila.id_comprobante, lineas.map((l) => ({
        codigo: l.codigo, descripcion: l.descripcion, unidad: l.unidad, cantidad: texto(l.cantidad), valor_unitario: texto(l.valorUnitario),
        precio_unitario: texto(l.precioUnitario), valor_venta: texto(l.valorVenta), igv: texto(l.igv),
      })));
      return { id: fila.id_comprobante as number, correlativo: fila.correlativo as number, xml: firmado.xml };
    });
    // 2. Se envía a SUNAT y se guarda la respuesta; 3. queda el evento en la trazabilidad del despacho.
    await enTransaccion(async (tx) => {
      await enviarYGuardar(tx, { id: emitido.id, tipo, serie, correlativo: emitido.correlativo }, emitido.xml);
      await eventoComprobante(tx, emitido.id, actor);
    });
    return creado(await detalle(ctx.db, emitido.id));
  }, true);

  r.post("/api/comprobante/:id/reenviar", async (ctx) => {
    const id = idDe(ctx);
    const c = await ctx.db.uno("SELECT * FROM comprobante WHERE id_comprobante = $1", [id]);
    if (!c) throw noEncontrado("Comprobante", id);
    if (c.tipo === GUIA_REMISION) throw reglaNegocio("SUNAT no tiene entorno de pruebas para la guía de remisión: no se envía");
    if (c.estado_sunat !== "ERROR" && c.estado_sunat !== "PENDIENTE") {
      throw reglaNegocio("Solo se reenvían comprobantes que no llegaron a SUNAT (estado ERROR o PENDIENTE)");
    }
    await enTransaccion((tx) => enviarYGuardar(tx, { id, tipo: c.tipo, serie: c.serie, correlativo: c.correlativo }, c.xml_firmado));
    return ok(await detalle(ctx.db, id));
  }, true);

  // ---------------------------------------------------------------- guía de remisión
  r.post("/api/comprobante/guia", async (ctx) => {
    const v = new Validador(await ctx.body());
    const tdoc = v.texto("cliente_tipo_doc", { obligatorio: true, patron: /^(1|6)$/, mensajePatron: "Tipo de documento: 1 (DNI) o 6 (RUC)" })!;
    const ndoc = v.texto("cliente_num_doc", { obligatorio: true, patron: DOC, mensajePatron: "DNI de 8 digitos o RUC de 11" })!;
    const nombre = v.texto("cliente_nombre", { obligatorio: true, max: 200 })!;
    const idDespacho = v.id("id_despacho");
    const motivo = v.texto("motivo", { obligatorio: true, patron: /^(01|02|04|13)$/, mensajePatron: "Motivo: 01 venta, 02 compra, 04 traslado entre establecimientos, 13 otros" })!;
    const modalidad = v.texto("modalidad", { obligatorio: true, patron: /^(01|02)$/, mensajePatron: "Modalidad: 01 transporte publico, 02 transporte privado" })!;
    const fechaTraslado = v.fecha("fecha_traslado", true);
    const pesoKg = v.numero("peso_kg", { obligatorio: true, min: 0.001, enteros: 9, decimales: 3, mensajeMin: "El peso debe ser mayor a 0" });
    const tRuc = v.texto("transportista_ruc", { patron: /^(|\d{11})$/, mensajePatron: "RUC del transportista de 11 digitos" });
    const tNombre = v.texto("transportista_nombre", { max: 200 });
    const cDni = v.texto("conductor_dni", { patron: /^(|\d{8})$/, mensajePatron: "DNI del conductor de 8 digitos" });
    const cNombres = v.texto("conductor_nombres", { max: 100 });
    const cApellidos = v.texto("conductor_apellidos", { max: 100 });
    const cLicencia = v.texto("conductor_licencia", { max: 20 });
    const placa = v.texto("placa", { max: 10 });
    const pUbigeo = v.texto("partida_ubigeo", { obligatorio: true, patron: /^\d{6}$/, mensajePatron: "Ubigeo de 6 digitos" })!;
    const pDir = v.texto("partida_direccion", { obligatorio: true, max: 200 })!;
    const lUbigeo = v.texto("llegada_ubigeo", { obligatorio: true, patron: /^\d{6}$/, mensajePatron: "Ubigeo de 6 digitos" })!;
    const lDir = v.texto("llegada_direccion", { obligatorio: true, max: 200 })!;
    const observacion = v.texto("observacion", { max: 500 });
    const items = leerItems(v, false);
    v.verificar();
    validarDocumento(tdoc, ndoc);
    const publico = modalidad === "01";
    if (publico && (vacio(tRuc) || vacio(tNombre))) throw reglaNegocio("En transporte público indica el RUC y la razón social del transportista");
    if (!publico && (vacio(cDni) || vacio(cNombres) || vacio(cApellidos) || vacio(cLicencia) || vacio(placa))) {
      throw reglaNegocio("En transporte privado indica el conductor (DNI, nombres, apellidos, licencia) y la placa");
    }
    if (fechaTraslado! < hoyLima()) throw reglaNegocio("La fecha de inicio del traslado no puede ser anterior a hoy");

    const cfg = configSunat();
    const actor = ctx.yo();
    const ahora = ahoraLima();
    const t: Traslado = {
      motivo, descripcionMotivo: MOTIVOS[motivo], modalidad, fechaTraslado, pesoKg: texto(dec(pesoKg!)),
      transportistaRuc: vacioANull(tRuc), transportistaNombre: vacioANull(tNombre), conductorDni: vacioANull(cDni),
      conductorNombres: vacioANull(cNombres), conductorApellidos: vacioANull(cApellidos), conductorLicencia: vacioANull(cLicencia),
      placa: vacioANull(placa), partidaUbigeo: pUbigeo, partidaDireccion: pDir.trim(), llegadaUbigeo: lUbigeo, llegadaDireccion: lDir.trim(),
    };
    const lineas = items.map((i) => ({ codigo: vacioANull(i.codigo), descripcion: i.descripcion.trim(), unidad: unidadSunat(i.unidad), cantidad: dec(i.cantidad!) }));
    const descripcion = cfg.prueba
      ? "SUNAT no ofrece entorno de pruebas para la guía de remisión electrónica: el XML se generó y firmó en el formato oficial, pero no se envió."
      : "El envío de guías a SUNAT (API REST con credenciales GRE) no está implementado.";
    const id = await enTransaccion(async (tx) => {
      await despachoExiste(tx, idDespacho);
      const fila = await insertarComprobante(tx, {
        tipo: GUIA_REMISION, serie: cfg.serieGuia, fecha_emision: ahora, moneda: "PEN", cliente_tipo_doc: tdoc, cliente_num_doc: ndoc,
        cliente_nombre: nombre.trim(), cliente_direccion: lDir.trim(), id_despacho: idDespacho, observacion: vacioANull(observacion),
        datos_traslado: serializarTraslado(t), entorno: cfg.entorno, estado_sunat: "NO_ENVIADO", descripcion_respuesta: descripcion,
        id_usuario: actor.id_usuario, fecha_creacion: ahora,
      });
      const firmado = firmar(xmlGuia(cfg.emisor, {
        serie: cfg.serieGuia, correlativo: fila.correlativo, fecha: ahora.slice(0, 10), hora: ahora.slice(11, 19),
        destinatario: { tipoDoc: tdoc, numDoc: ndoc, nombre: nombre.trim(), direccion: null }, motivo, descripcionMotivo: MOTIVOS[motivo] ?? null,
        pesoKg: dec(pesoKg!), modalidad, fechaTraslado: fechaTraslado!,
        transportista: publico ? { tipoDoc: "6", numDoc: t.transportistaRuc!, nombre: t.transportistaNombre!, direccion: null } : null,
        conductor: publico ? null : { tipoDoc: "1", numDoc: t.conductorDni!, nombres: t.conductorNombres!, apellidos: t.conductorApellidos!, licencia: t.conductorLicencia! },
        placa: t.placa ?? null, partida: { ubigeo: pUbigeo, linea: pDir.trim() }, llegada: { ubigeo: lUbigeo, linea: lDir.trim() },
        lineas, observacion: vacioANull(observacion),
      }));
      await tx.q("UPDATE comprobante SET xml_firmado = $2, hash = $3 WHERE id_comprobante = $1", [fila.id_comprobante, firmado.xml, firmado.hash]);
      await guardarItems(tx, fila.id_comprobante, lineas.map((l) => ({ codigo: l.codigo, descripcion: l.descripcion, unidad: l.unidad, cantidad: texto(l.cantidad) })));
      await eventoComprobante(tx, fila.id_comprobante, actor);
      return fila.id_comprobante as number;
    });
    return creado(await detalle(ctx.db, id));
  }, true);
}

export { BOLETA };
