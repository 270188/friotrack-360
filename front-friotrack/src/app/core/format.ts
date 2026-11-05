// Formato de fechas, números y etiquetas legibles para los enums del backend.

type Fecha = string | number[] | null | undefined;

/** Acepta ISO ("2026-10-12T18:09:00") o el arreglo [y,m,d,h,mi,s] que Jackson usa si los timestamps no están deshabilitados. */
export function aDate(v: Fecha): Date | null {
  if (!v) return null;
  if (Array.isArray(v)) {
    const [y, m = 1, d = 1, h = 0, mi = 0, s = 0] = v;
    return new Date(y, m - 1, d, h, mi, s);
  }
  // Fechas sin hora: se interpretan en hora local, no en UTC.
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) {
    const [y, m, d] = v.split("-").map(Number);
    return new Date(y, m - 1, d);
  }
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
}

const fmtFecha = new Intl.DateTimeFormat("es-PE", { day: "2-digit", month: "short", year: "numeric" });
const fmtFechaHora = new Intl.DateTimeFormat("es-PE", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});
const fmtHora = new Intl.DateTimeFormat("es-PE", { hour: "2-digit", minute: "2-digit" });

export const fecha = (v: Fecha) => {
  const d = aDate(v);
  return d ? fmtFecha.format(d) : "—";
};
export const fechaHora = (v: Fecha) => {
  const d = aDate(v);
  return d ? fmtFechaHora.format(d) : "—";
};
export const hora = (v: Fecha) => {
  const d = aDate(v);
  return d ? fmtHora.format(d) : "—";
};

export function num(v: number | null | undefined, dec = 2) {
  if (v === null || v === undefined || Number.isNaN(Number(v))) return "—";
  return Number(v).toLocaleString("es-PE", { minimumFractionDigits: 0, maximumFractionDigits: dec });
}

/** Importe con dos decimales fijos: 5.9 -> "5.90". */
export function dinero(v: number | null | undefined) {
  if (v === null || v === undefined || Number.isNaN(Number(v))) return "—";
  return Number(v).toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function rango(min: number | null | undefined, max: number | null | undefined, unidad: string) {
  if (min == null && max == null) return "Sin rango";
  if (min == null) return `≤ ${num(max)} ${unidad}`;
  if (max == null) return `≥ ${num(min)} ${unidad}`;
  return `${num(min)} a ${num(max)} ${unidad}`;
}

/** Convierte un enum del backend en texto: "EN_TRANSITO" → "En tránsito". */
const ETIQUETAS: Record<string, string> = {
  EN_TRANSITO: "En tránsito",
  EN_PROCESO: "En proceso",
  PREPARACION: "Preparación",
  FUERA_RANGO: "Fuera de rango",
  CREACION_LOTE: "Creación de lote",
  CAMBIO_UBICACION: "Cambio de ubicación",
  BLOQUEO_LOTE: "Bloqueo de lote",
  LIBERACION_LOTE: "Liberación de lote",
  DESCARTE_LOTE: "Descarte de lote",
  CRITICA: "Crítica",
  LOGISTICA: "Logística",
  OTRA: "Otra",
  OTRO: "Otro",
  ADMIN: "Administrador",
  OPERADOR: "Operador",
  CALIDAD: "Calidad",
  SUPERVISOR: "Supervisor",
  ACEPTADO: "Aceptado",
  OBSERVADO: "Aceptado con observaciones",
  RECHAZADO: "Rechazado",
  ERROR: "No enviado (error)",
  NO_ENVIADO: "No enviado a SUNAT",
};
export function etiqueta(v: string | null | undefined) {
  if (!v) return "—";
  if (ETIQUETAS[v]) return ETIQUETAS[v];
  const t = v.replace(/_/g, " ").toLowerCase();
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/** Valor para <input type="datetime-local"> a partir de una fecha. */
export function aInputFechaHora(d: Date = new Date()) {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}
export function aInputFecha(d: Date = new Date()) {
  return aInputFechaHora(d).slice(0, 10);
}

/** Envía cadenas vacías como null para que el backend no reciba "" en campos opcionales. */
export function limpiar<T extends Record<string, unknown>>(o: T): T {
  const r: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(o)) r[k] = v === "" ? null : v;
  return r as T;
}

export function numOrNull(v: string): number | null {
  if (v === "" || v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
