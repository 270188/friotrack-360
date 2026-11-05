// Utilidades de comprobantes electrónicos: nombres, cálculo de importes (igual que el backend) y QR de SUNAT.
import type { Comprobante, EstadoSunat, TipoComprobante } from './types';

export const TIPOS: Record<TipoComprobante, { nombre: string; ruta: string; corto: string }> = {
  '01': { nombre: 'Factura electrónica', ruta: 'factura', corto: 'Factura' },
  '03': { nombre: 'Boleta de venta electrónica', ruta: 'boleta', corto: 'Boleta' },
  '09': { nombre: 'Guía de remisión remitente electrónica', ruta: 'guia', corto: 'Guía de remisión' },
};

export function tipoPorRuta(ruta: string | null | undefined): TipoComprobante | null {
  const t = (Object.keys(TIPOS) as TipoComprobante[]).find((k) => TIPOS[k].ruta === ruta);
  return t ?? null;
}

/** Catálogo 03 (unidades de medida) — las más usadas. */
export const UNIDADES = [
  { codigo: 'NIU', nombre: 'Unidad' },
  { codigo: 'KGM', nombre: 'Kilogramo' },
  { codigo: 'LTR', nombre: 'Litro' },
  { codigo: 'BX', nombre: 'Caja' },
  { codigo: 'PK', nombre: 'Paquete' },
  { codigo: 'ZZ', nombre: 'Servicio' },
];

/** Catálogo 20: motivos de traslado admitidos en el formulario. */
export const MOTIVOS: Record<string, string> = {
  '01': 'Venta',
  '02': 'Compra',
  '04': 'Traslado entre establecimientos de la misma empresa',
  '13': 'Otros',
};

export const DOCUMENTOS: Record<string, string> = { '6': 'RUC', '1': 'DNI', '0': 'Otro' };

/** Unidad SUNAT a partir de la unidad libre de un lote ("kg", "und"...). Mismo criterio que el backend. */
export function unidadSunat(u: string | null | undefined): string {
  const v = (u ?? '').trim().toLowerCase();
  if (['kg', 'kgs', 'kilo', 'kilos', 'kilogramo', 'kilogramos', 'kgm'].includes(v)) return 'KGM';
  if (['l', 'lt', 'lts', 'litro', 'litros', 'ltr'].includes(v)) return 'LTR';
  if (['caja', 'cajas', 'cj', 'bx'].includes(v)) return 'BX';
  if (['paquete', 'paquetes', 'pk'].includes(v)) return 'PK';
  return 'NIU';
}

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/** Igual que DocumentoSunat.lineaGravada: el precio incluye IGV. */
export function calcularLinea(cantidad: number, precioConIgv: number) {
  const total = r2(cantidad * precioConIgv);
  const valorVenta = r2(total / 1.18);
  return { total, valorVenta, igv: r2(total - valorVenta) };
}

export function calcularTotales(items: { cantidad: number; precio: number }[]) {
  let gravada = 0;
  let igv = 0;
  for (const i of items) {
    if (!(i.cantidad > 0) || !(i.precio > 0)) continue;
    const l = calcularLinea(i.cantidad, i.precio);
    gravada = r2(gravada + l.valorVenta);
    igv = r2(igv + l.igv);
  }
  return { gravada, igv, total: r2(gravada + igv) };
}

/** Texto del QR de la representación impresa (formato de SUNAT). */
export function textoQr(c: Comprobante): string {
  const f = c.fecha_emision.slice(0, 10);
  if (c.tipo === '09') return [c.emisor.ruc, c.tipo, c.serie, c.correlativo, f, c.cliente_tipo_doc, c.cliente_num_doc, c.hash ?? ''].join('|') + '|';
  return [c.emisor.ruc, c.tipo, c.serie, c.correlativo, c.igv.toFixed(2), c.total.toFixed(2), f, c.cliente_tipo_doc, c.cliente_num_doc, c.hash ?? ''].join('|') + '|';
}

export function nombreArchivo(c: Comprobante): string {
  return `${c.emisor.ruc}-${c.tipo}-${c.serie}-${c.correlativo}`;
}

/** Resumen legible del estado ante SUNAT. */
export function textoEstado(e: EstadoSunat, prueba: boolean): string {
  const entorno = prueba ? 'SUNAT (entorno de pruebas)' : 'SUNAT';
  switch (e) {
    case 'ACEPTADO': return `Aceptado por ${entorno}`;
    case 'OBSERVADO': return `Aceptado con observaciones por ${entorno}`;
    case 'RECHAZADO': return `Rechazado por ${entorno}`;
    case 'ERROR': return `No llegó a ${entorno}`;
    case 'NO_ENVIADO': return 'No enviado a SUNAT';
    default: return 'Pendiente de envío';
  }
}

/** Guarda un archivo en el equipo del usuario. */
export function guardarArchivo(datos: Blob, nombre: string): void {
  const url = URL.createObjectURL(datos);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
