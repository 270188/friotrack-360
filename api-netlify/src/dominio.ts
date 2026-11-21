// Consultas y conversiones a DTO compartidas por varios módulos (equivalen a las entidades y *Dto.java).
import { ahoraLima, hoyLima, minutosEntre } from "./core.ts";
import type { Db, Fila } from "./db.ts";
import { usuarioDto, type Usuario } from "./auth.ts";

// ------------------------------------------------------------------ enumeraciones

export const ESTADOS_LOTE = ["DISPONIBLE", "BLOQUEADO", "EN_TRANSITO", "ENTREGADO", "DESCARTADO"] as const;
export const ESTADOS_DESPACHO = ["PENDIENTE", "PREPARACION", "EN_TRANSITO", "ENTREGADO", "CANCELADO"] as const;
export const TIPOS_EVENTO = ["CREACION_LOTE", "PREPARACION", "CONTROL", "SALIDA", "CAMBIO_UBICACION", "LLEGADA",
  "BLOQUEO_LOTE", "LIBERACION_LOTE", "DESCARTE_LOTE", "ENTREGA", "OTRO"] as const;
export const TIPOS_INCIDENCIA = ["TEMPERATURA", "HUMEDAD", "CALIDAD", "LOGISTICA", "OTRA"] as const;
export const PRIORIDADES = ["BAJA", "MEDIA", "ALTA", "CRITICA"] as const;
export const ESTADOS_INCIDENCIA = ["ABIERTA", "EN_PROCESO", "RESUELTA", "CERRADA"] as const;
export type TipoEvento = (typeof TIPOS_EVENTO)[number];

/** Orden de prioridad de mayor a menor (CRITICA primero). */
export const ORDEN_PRIORIDAD = "CASE i.prioridad WHEN 'CRITICA' THEN 4 WHEN 'ALTA' THEN 3 WHEN 'MEDIA' THEN 2 ELSE 1 END DESC";

export const esTerminal = (estadoDespacho: string) => estadoDespacho === "ENTREGADO" || estadoDespacho === "CANCELADO";

/** BigDecimal.toString() de Java para mostrar en textos: 10.40 → "10.40" según la escala de la columna. */
export const decimal = (n: number | null | undefined, escala: number) => (n === null || n === undefined ? "null" : n.toFixed(escala));

// ------------------------------------------------------------------ producto

export function productoDto(p: Fila) {
  return {
    id_producto: p.id_producto,
    nombre: p.nombre,
    categoria: p.categoria,
    descripcion: p.descripcion,
    temperatura_min: p.temperatura_min,
    temperatura_max: p.temperatura_max,
    humedad_min: p.humedad_min,
    humedad_max: p.humedad_max,
    define_rango_temperatura: p.temperatura_min !== null && p.temperatura_max !== null,
    define_rango_humedad: p.humedad_min !== null && p.humedad_max !== null,
    activo: p.activo,
    fecha_creacion: p.fecha_creacion,
  };
}

// ------------------------------------------------------------------ lote

/** Lote con su producto (columnas del producto con prefijo p_). */
export const SQL_LOTE = `
  SELECT l.*, p.id_producto AS p_id_producto, p.nombre AS p_nombre, p.categoria AS p_categoria, p.descripcion AS p_descripcion,
         p.temperatura_min AS p_temperatura_min, p.temperatura_max AS p_temperatura_max, p.humedad_min AS p_humedad_min,
         p.humedad_max AS p_humedad_max, p.activo AS p_activo, p.fecha_creacion AS p_fecha_creacion
  FROM lote l JOIN producto p ON p.id_producto = l.id_producto`;

const productoDeFila = (f: Fila) =>
  productoDto(Object.fromEntries(Object.entries(f).filter(([k]) => k.startsWith("p_")).map(([k, v]) => [k.slice(2), v])));

export const vencido = (fechaVencimiento: string | null) => fechaVencimiento !== null && fechaVencimiento < hoyLima();

export function loteDto(l: Fila) {
  return {
    id_lote: l.id_lote,
    codigo_lote: l.codigo_lote,
    producto: productoDeFila(l),
    fecha_produccion: l.fecha_produccion,
    fecha_vencimiento: l.fecha_vencimiento,
    vencido: vencido(l.fecha_vencimiento),
    cantidad: l.cantidad,
    unidad: l.unidad,
    estado: l.estado,
    fecha_creacion: l.fecha_creacion,
  };
}

/** LoteDto.Resumen; espera la columna producto_nombre. */
export const loteResumen = (l: Fila) => ({
  id_lote: l.id_lote,
  codigo_lote: l.codigo_lote,
  producto: l.producto_nombre,
  cantidad: l.cantidad,
  unidad: l.unidad,
  estado: l.estado,
});

export async function lotePorId(db: Db, id: number) {
  return db.uno(`${SQL_LOTE} WHERE l.id_lote = $1`, [id]);
}

// ------------------------------------------------------------------ despacho

/** Despacho con su usuario (columnas u_*). */
export const SQL_DESPACHO = `
  SELECT d.*, u.id_usuario AS u_id_usuario, u.nombre AS u_nombre, u.apellido AS u_apellido, u.username AS u_username,
         u.rol AS u_rol, u.activo AS u_activo, u.fecha_creacion AS u_fecha_creacion
  FROM despacho d JOIN usuario u ON u.id_usuario = d.id_usuario`;

export function despachoDto(d: Fila) {
  return {
    id_despacho: d.id_despacho,
    codigo: d.codigo,
    transportista: d.transportista,
    vehiculo: d.vehiculo,
    placa: d.placa,
    destino: d.destino,
    direccion_destino: d.direccion_destino,
    contacto_destino: d.contacto_destino,
    fecha_programada: d.fecha_programada,
    fecha_salida: d.fecha_salida,
    fecha_llegada: d.fecha_llegada,
    estado: d.estado,
    observacion: d.observacion,
    usuario: usuarioDto(Object.fromEntries(Object.entries(d).filter(([k]) => k.startsWith("u_")).map(([k, v]) => [k.slice(2), v]))),
    fecha_creacion: d.fecha_creacion,
  };
}

export async function despachoPorId(db: Db, id: number) {
  return db.uno(`${SQL_DESPACHO} WHERE d.id_despacho = $1`, [id]);
}

// ------------------------------------------------------------------ control y evaluación de rangos (EvaluadorRango)

export function fueraDeRango(valor: number | null, min: number | null, max: number | null): boolean {
  if (valor === null || valor === undefined) return false;
  if (min !== null && min !== undefined && valor < min) return true;
  return max !== null && max !== undefined && valor > max;
}

export function evaluar(temperatura: number | null, humedad: number | null, p: Fila): "NORMAL" | "FUERA_RANGO" {
  return fueraDeRango(temperatura, p.temperatura_min, p.temperatura_max) || fueraDeRango(humedad, p.humedad_min, p.humedad_max)
    ? "FUERA_RANGO"
    : "NORMAL";
}

/** Motivo de la desviación (null si la lectura es NORMAL). c debe traer los límites del producto. */
export function motivo(c: Fila): string | null {
  if (c.resultado !== "FUERA_RANGO") return null;
  const partes: string[] = [];
  if (fueraDeRango(c.temperatura, c.temperatura_min, c.temperatura_max)) {
    partes.push(`temperatura ${decimal(c.temperatura, 2)} °C fuera de ${decimal(c.temperatura_min, 2)}-${decimal(c.temperatura_max, 2)} °C`);
  }
  if (fueraDeRango(c.humedad, c.humedad_min, c.humedad_max)) {
    partes.push(`humedad ${decimal(c.humedad, 2)} % fuera de ${decimal(c.humedad_min, 2)}-${decimal(c.humedad_max, 2)} %`);
  }
  return partes.join("; ");
}

export const SQL_CONTROL = `
  SELECT c.*, d.codigo AS codigo_despacho, l.codigo_lote, u.username,
         p.temperatura_min, p.temperatura_max, p.humedad_min, p.humedad_max
  FROM control c
  JOIN despacho d ON d.id_despacho = c.id_despacho
  JOIN lote l ON l.id_lote = c.id_lote
  JOIN producto p ON p.id_producto = l.id_producto
  JOIN usuario u ON u.id_usuario = c.id_usuario`;

export function controlDto(c: Fila) {
  return {
    id_control: c.id_control,
    id_despacho: c.id_despacho,
    codigo_despacho: c.codigo_despacho,
    id_lote: c.id_lote,
    codigo_lote: c.codigo_lote,
    fecha_hora: c.fecha_hora,
    temperatura: c.temperatura,
    humedad: c.humedad,
    resultado: c.resultado,
    motivo_desviacion: motivo(c),
    observacion: c.observacion,
    id_usuario: c.id_usuario,
    username: c.username,
  };
}

// ------------------------------------------------------------------ incidencia y evidencia

export const SQL_INCIDENCIA = `
  SELECT i.*, l.codigo_lote, d.codigo AS codigo_despacho, r.username AS username_responsable
  FROM incidencia i
  JOIN lote l ON l.id_lote = i.id_lote
  LEFT JOIN despacho d ON d.id_despacho = i.id_despacho
  LEFT JOIN usuario r ON r.id_usuario = i.responsable`;

export const SQL_EVIDENCIA = `
  SELECT e.*, u.username, l.codigo_lote
  FROM evidencia e
  JOIN usuario u ON u.id_usuario = e.id_usuario
  JOIN incidencia i ON i.id_incidencia = e.id_incidencia
  JOIN lote l ON l.id_lote = i.id_lote`;

export const evidenciaDto = (e: Fila) => ({
  id_evidencia: e.id_evidencia,
  id_incidencia: e.id_incidencia,
  tipo: e.tipo,
  nombre_archivo: e.nombre_archivo,
  url: e.url,
  descripcion: e.descripcion,
  fecha_creacion: e.fecha_creacion,
  id_usuario: e.id_usuario,
  username: e.username,
});

export const evidenciaResumen = (e: Fila) => ({
  id_evidencia: e.id_evidencia,
  id_incidencia: e.id_incidencia,
  codigo_lote: e.codigo_lote,
  tipo: e.tipo,
  nombre_archivo: e.nombre_archivo,
  url: e.url,
  descripcion: e.descripcion,
  fecha_creacion: e.fecha_creacion,
  username: e.username,
});

export function incidenciaDto(i: Fila, evidencias: unknown[]) {
  return {
    id_incidencia: i.id_incidencia,
    id_control: i.id_control,
    id_lote: i.id_lote,
    codigo_lote: i.codigo_lote,
    id_despacho: i.id_despacho,
    codigo_despacho: i.codigo_despacho,
    tipo: i.tipo,
    descripcion: i.descripcion,
    prioridad: i.prioridad,
    estado: i.estado,
    causa: i.causa,
    accion: i.accion,
    id_responsable: i.responsable,
    username_responsable: i.username_responsable,
    fecha_creacion: i.fecha_creacion,
    fecha_cierre: i.fecha_cierre,
    minutos_resolucion: i.fecha_cierre ? minutosEntre(i.fecha_creacion, i.fecha_cierre) : null,
    evidencias,
  };
}

/** IncidenciaDto.Resumen; espera la columna evidencias (conteo). */
export const incidenciaResumen = (i: Fila) => ({
  id_incidencia: i.id_incidencia,
  tipo: i.tipo,
  prioridad: i.prioridad,
  estado: i.estado,
  descripcion: i.descripcion,
  id_lote: i.id_lote,
  codigo_lote: i.codigo_lote,
  id_despacho: i.id_despacho,
  fecha_creacion: i.fecha_creacion,
  evidencias: i.evidencias ?? 0,
});

/** Resumen de incidencias con su número de evidencias. where usa el alias i. */
export async function resumenIncidencias(db: Db, where: string, params: unknown[], orden: string) {
  const filas = await db.q(
    `SELECT i.*, l.codigo_lote, (SELECT COUNT(*) FROM evidencia e WHERE e.id_incidencia = i.id_incidencia) AS evidencias
     FROM incidencia i JOIN lote l ON l.id_lote = i.id_lote WHERE ${where} ORDER BY ${orden}`,
    params,
  );
  return filas.map(incidenciaResumen);
}

/** IncidenciaDto.Response con sus evidencias. */
export async function incidenciaConEvidencias(db: Db, id: number) {
  const i = await db.uno(`${SQL_INCIDENCIA} WHERE i.id_incidencia = $1`, [id]);
  if (!i) return null;
  const ev = await db.q(`${SQL_EVIDENCIA} WHERE e.id_incidencia = $1 ORDER BY e.fecha_creacion ASC, e.id_evidencia ASC`, [id]);
  return incidenciaDto(i, ev.map(evidenciaDto));
}

// ------------------------------------------------------------------ eventos

export const SQL_EVENTO = `
  SELECT e.*, l.codigo_lote, d.codigo AS codigo_despacho, u.username
  FROM evento e
  LEFT JOIN lote l ON l.id_lote = e.id_lote
  LEFT JOIN despacho d ON d.id_despacho = e.id_despacho
  JOIN usuario u ON u.id_usuario = e.id_usuario`;

export const eventoDto = (e: Fila) => ({
  id_evento: e.id_evento,
  id_lote: e.id_lote,
  codigo_lote: e.codigo_lote,
  id_despacho: e.id_despacho,
  codigo_despacho: e.codigo_despacho,
  tipo: e.tipo,
  descripcion: e.descripcion,
  ubicacion: e.ubicacion,
  fecha_hora: e.fecha_hora,
  id_usuario: e.id_usuario,
  username: e.username,
});

export const timeline = (e: Fila) => ({ fecha: e.fecha_hora, tipo: e.tipo, actor: e.username, descripcion: e.descripcion });

/** EventoService.registrar: deja constancia inmutable de una acción. */
export async function registrarEvento(
  db: Db,
  tipo: TipoEvento,
  idLote: number | null,
  idDespacho: number | null,
  usuario: Usuario | Fila,
  descripcion: string,
  ubicacion: string | null = null,
) {
  await db.q(
    `INSERT INTO evento (id_lote, id_despacho, tipo, descripcion, ubicacion, fecha_hora, id_usuario)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [idLote, idDespacho, tipo, descripcion, ubicacion, ahoraLima(true), usuario.id_usuario],
  );
}
