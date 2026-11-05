// Tipos que reflejan los DTOs del backend (JSON en snake_case).

export type Rol = "ADMIN" | "OPERADOR" | "CALIDAD" | "SUPERVISOR";
export type EstadoLote = "DISPONIBLE" | "BLOQUEADO" | "EN_TRANSITO" | "ENTREGADO" | "DESCARTADO";
export type EstadoDespacho = "PENDIENTE" | "PREPARACION" | "EN_TRANSITO" | "ENTREGADO" | "CANCELADO";
export type ResultadoControl = "NORMAL" | "FUERA_RANGO";
export type TipoIncidencia = "TEMPERATURA" | "HUMEDAD" | "CALIDAD" | "LOGISTICA" | "OTRA";
export type PrioridadIncidencia = "BAJA" | "MEDIA" | "ALTA" | "CRITICA";
export type EstadoIncidencia = "ABIERTA" | "EN_PROCESO" | "RESUELTA" | "CERRADA";
export type TipoEvento =
  | "CREACION_LOTE"
  | "PREPARACION"
  | "CONTROL"
  | "SALIDA"
  | "CAMBIO_UBICACION"
  | "LLEGADA"
  | "BLOQUEO_LOTE"
  | "LIBERACION_LOTE"
  | "DESCARTE_LOTE"
  | "ENTREGA"
  | "OTRO";

export const ESTADOS_LOTE: EstadoLote[] = ["DISPONIBLE", "BLOQUEADO", "EN_TRANSITO", "ENTREGADO", "DESCARTADO"];
export const ESTADOS_DESPACHO: EstadoDespacho[] = ["PENDIENTE", "PREPARACION", "EN_TRANSITO", "ENTREGADO", "CANCELADO"];
export const TIPOS_INCIDENCIA: TipoIncidencia[] = ["TEMPERATURA", "HUMEDAD", "CALIDAD", "LOGISTICA", "OTRA"];
export const PRIORIDADES: PrioridadIncidencia[] = ["BAJA", "MEDIA", "ALTA", "CRITICA"];
export const ESTADOS_INCIDENCIA: EstadoIncidencia[] = ["ABIERTA", "EN_PROCESO", "RESUELTA", "CERRADA"];
export const TIPOS_EVENTO: TipoEvento[] = [
  "CREACION_LOTE", "PREPARACION", "CONTROL", "SALIDA", "CAMBIO_UBICACION", "LLEGADA",
  "BLOQUEO_LOTE", "LIBERACION_LOTE", "DESCARTE_LOTE", "ENTREGA", "OTRO",
];
export const ROLES: Rol[] = ["ADMIN", "OPERADOR", "CALIDAD", "SUPERVISOR"];

export interface Page<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
}

export interface Credenciales {
  token: string;
  tipo: string;
  id_usuario: number;
  username: string;
  rol: Rol;
  expira_en_segundos: number;
}

export interface Usuario {
  id_usuario: number;
  nombre: string;
  apellido: string;
  username: string;
  rol: Rol;
  activo: boolean;
  fecha_creacion: string;
}

export interface Producto {
  id_producto: number;
  nombre: string;
  categoria: string | null;
  descripcion: string | null;
  temperatura_min: number | null;
  temperatura_max: number | null;
  humedad_min: number | null;
  humedad_max: number | null;
  define_rango_temperatura: boolean;
  define_rango_humedad: boolean;
  activo: boolean;
  fecha_creacion: string;
}

export interface Lote {
  id_lote: number;
  codigo_lote: string;
  producto: Producto;
  fecha_produccion: string | null;
  fecha_vencimiento: string | null;
  vencido: boolean;
  cantidad: number;
  unidad: string | null;
  estado: EstadoLote;
  fecha_creacion: string;
}

export interface LoteResumen {
  id_lote: number;
  codigo_lote: string;
  producto: string;
  cantidad: number;
  unidad: string | null;
  estado: EstadoLote;
}

export interface Despacho {
  id_despacho: number;
  codigo: string;
  transportista: string | null;
  vehiculo: string | null;
  placa: string | null;
  destino: string;
  direccion_destino: string | null;
  contacto_destino: string | null;
  fecha_programada: string | null;
  fecha_salida: string | null;
  fecha_llegada: string | null;
  estado: EstadoDespacho;
  observacion: string | null;
  usuario: Usuario;
  fecha_creacion: string;
}

export interface DespachoItem {
  id_despacho_lote: number;
  id_despacho: number;
  lote: LoteResumen;
  cantidad: number;
}

export interface Control {
  id_control: number;
  id_despacho: number;
  codigo_despacho: string;
  id_lote: number;
  codigo_lote: string;
  fecha_hora: string;
  temperatura: number | null;
  humedad: number | null;
  resultado: ResultadoControl;
  motivo_desviacion: string | null;
  observacion: string | null;
  id_usuario: number;
  username: string;
}

export interface Evidencia {
  id_evidencia: number;
  id_incidencia: number;
  tipo: string;
  nombre_archivo: string;
  url: string | null;
  descripcion: string | null;
  fecha_creacion: string;
  id_usuario?: number;
  username: string;
  codigo_lote?: string;
}

export interface Incidencia {
  id_incidencia: number;
  id_control: number | null;
  id_lote: number;
  codigo_lote: string;
  id_despacho: number | null;
  codigo_despacho: string | null;
  tipo: TipoIncidencia;
  descripcion: string;
  prioridad: PrioridadIncidencia;
  estado: EstadoIncidencia;
  causa: string | null;
  accion: string | null;
  id_responsable: number | null;
  username_responsable: string | null;
  fecha_creacion: string;
  fecha_cierre: string | null;
  minutos_resolucion: number | null;
  evidencias: Evidencia[];
}

export interface IncidenciaResumen {
  id_incidencia: number;
  tipo: TipoIncidencia;
  prioridad: PrioridadIncidencia;
  estado: EstadoIncidencia;
  descripcion: string;
  id_lote: number;
  codigo_lote: string;
  id_despacho: number | null;
  fecha_creacion: string;
  evidencias: number;
}

export interface Evento {
  id_evento: number;
  id_lote: number | null;
  codigo_lote: string | null;
  id_despacho: number | null;
  codigo_despacho: string | null;
  tipo: TipoEvento;
  descripcion: string | null;
  ubicacion: string | null;
  fecha_hora: string;
  id_usuario: number;
  username: string;
}

export interface TimelineItem {
  fecha: string;
  tipo: TipoEvento | string;
  actor: string;
  descripcion: string | null;
}

export interface DespachoRef {
  id_despacho: number;
  codigo: string;
  estado: EstadoDespacho;
  destino: string;
  cantidad: number;
  fecha_programada: string | null;
  fecha_salida: string | null;
  fecha_llegada: string | null;
}

export interface TrazabilidadLote {
  id_lote: number;
  codigo_lote: string;
  producto: Producto;
  cantidad: number;
  unidad: string | null;
  estado: EstadoLote;
  fecha_produccion: string | null;
  fecha_vencimiento: string | null;
  vencido: boolean;
  despachos: DespachoRef[];
  controles: Control[];
  incidencias: IncidenciaResumen[];
  evidencias: Evidencia[];
  timeline: TimelineItem[];
}

export interface TrazabilidadDespacho {
  id_despacho: number;
  codigo: string;
  transportista: string | null;
  vehiculo: string | null;
  placa: string | null;
  destino: string;
  estado: EstadoDespacho;
  fecha_programada: string | null;
  fecha_salida: string | null;
  fecha_llegada: string | null;
  responsable: string | null;
  lotes: LoteResumen[];
  controles: Control[];
  incidencias: IncidenciaResumen[];
  evidencias: Evidencia[];
  timeline: TimelineItem[];
}

export interface Dashboard {
  cumplimiento: {
    controles: number;
    en_rango: number;
    fuera_de_rango: number;
    porcentaje_en_rango: number;
    despachos: number;
    despachos_sin_incidencias: number;
    desviaciones_en_despachos_activos: number;
    desde: string | null;
    hasta: string | null;
  };
  lotes: {
    total: number;
    disponibles: number;
    bloqueados: number;
    en_transito: number;
    entregados: number;
    descartados: number;
    por_vencer: number;
  };
  incidencias: {
    total: number;
    abiertas: number;
    en_proceso: number;
    resueltas: number;
    cerradas: number;
    criticas: number;
    altas: number;
    promedio_minutos_resolucion: number;
  };
  despachos_por_estado: { estado: EstadoDespacho; total: number }[];
  cumplimiento_por_producto: {
    id_producto: number;
    nombre: string;
    controles: number;
    desviaciones: number;
    porcentaje_en_rango: number;
  }[];
  incidencias_abiertas: IncidenciaResumen[];
  ultima_incidencia_resuelta: IncidenciaResumen[];
  eventos_recientes: TimelineItem[];
}

// ---------------------------------------------------------------------------
// Comprobantes electrónicos (SUNAT)
// ---------------------------------------------------------------------------
/** Catálogo 01 de SUNAT: 01 factura, 03 boleta, 09 guía de remisión remitente. */
export type TipoComprobante = '01' | '03' | '09';
export type EstadoSunat = 'PENDIENTE' | 'ACEPTADO' | 'OBSERVADO' | 'RECHAZADO' | 'ERROR' | 'NO_ENVIADO';

export interface EmisorSunat {
  ruc: string;
  razon_social: string;
  nombre_comercial: string | null;
  direccion: string;
  distrito: string;
  provincia: string;
  departamento: string;
  ubigeo: string;
  entorno: string;
  prueba: boolean;
  serie_factura: string;
  serie_boleta: string;
  serie_guia: string;
}

export interface ComprobanteResumen {
  id_comprobante: number;
  tipo: TipoComprobante;
  serie: string;
  correlativo: number;
  numero: string;
  fecha_emision: string;
  cliente_tipo_doc: string;
  cliente_num_doc: string;
  cliente_nombre: string;
  moneda: string;
  total: number;
  estado_sunat: EstadoSunat;
  codigo_respuesta: string | null;
  id_despacho: number | null;
  codigo_despacho: string | null;
}

export interface ComprobanteItem {
  orden: number;
  codigo: string | null;
  descripcion: string;
  unidad: string;
  cantidad: number;
  valor_unitario: number;
  precio_unitario: number;
  valor_venta: number;
  igv: number;
  total: number;
}

export interface Traslado {
  motivo: string;
  descripcion_motivo: string | null;
  modalidad: '01' | '02';
  fecha_traslado: string;
  peso_kg: number;
  transportista_ruc: string | null;
  transportista_nombre: string | null;
  conductor_dni: string | null;
  conductor_nombres: string | null;
  conductor_apellidos: string | null;
  conductor_licencia: string | null;
  placa: string | null;
  partida_ubigeo: string;
  partida_direccion: string;
  llegada_ubigeo: string;
  llegada_direccion: string;
}

export interface Comprobante {
  id_comprobante: number;
  tipo: TipoComprobante;
  serie: string;
  correlativo: number;
  numero: string;
  fecha_emision: string;
  moneda: string;
  cliente_tipo_doc: string;
  cliente_num_doc: string;
  cliente_nombre: string;
  cliente_direccion: string | null;
  op_gravada: number;
  igv: number;
  total: number;
  monto_en_letras: string | null;
  id_despacho: number | null;
  codigo_despacho: string | null;
  traslado: Traslado | null;
  observacion: string | null;
  entorno: string;
  estado_sunat: EstadoSunat;
  codigo_respuesta: string | null;
  descripcion_respuesta: string | null;
  observaciones_sunat: string[];
  hash: string | null;
  tiene_xml: boolean;
  tiene_cdr: boolean;
  fecha_envio: string | null;
  username: string | null;
  fecha_creacion: string;
  items: ComprobanteItem[];
  emisor: EmisorSunat;
}
