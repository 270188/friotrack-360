// Códigos de lote y despacho: interpretación de lecturas del escáner y generación de QR / Code 128 para etiquetas.
import qrcode from 'qrcode-generator';

export type TipoCodigo = 'lote' | 'despacho';

export interface Lectura {
  codigo: string;
  /** null cuando el texto no dice si es lote o despacho: se busca en ambos. */
  tipo: TipoCodigo | null;
}

/** Deduce el tipo por el prefijo habitual (LOT-…, DSP-…). */
export function tipoPorPrefijo(codigo: string): TipoCodigo | null {
  if (/^LOT[-_ ]/i.test(codigo)) return 'lote';
  if (/^(DSP|DES)[-_ ]/i.test(codigo)) return 'despacho';
  return null;
}

/**
 * Convierte lo que leyó la cámara o una pistola lectora en un código.
 * Acepta el código tal cual ("LOT-2026-0001") o la URL que llevan las etiquetas
 * (".../escanear?tipo=lote&codigo=LOT-2026-0001").
 */
export function interpretarLectura(texto: string): Lectura | null {
  const limpio = texto.replace(/[\u0000-\u001f]/g, '').trim();
  if (!limpio) return null;

  if (/^https?:\/\//i.test(limpio)) {
    try {
      const url = new URL(limpio);
      const codigo = url.searchParams.get('codigo')?.trim();
      if (codigo) {
        const t = url.searchParams.get('tipo');
        return { codigo, tipo: t === 'lote' || t === 'despacho' ? t : tipoPorPrefijo(codigo) };
      }
    } catch {
      /* no es una URL válida: se trata como texto */
    }
    return null;
  }
  return { codigo: limpio, tipo: tipoPorPrefijo(limpio) };
}

/** Contenido del QR de una etiqueta: abre el escáner del sistema y resuelve el código, también desde la cámara nativa del celular. */
export function urlEtiqueta(tipo: TipoCodigo, codigo: string, origen = location.origin): string {
  return `${origen}/escanear?tipo=${tipo}&codigo=${encodeURIComponent(codigo)}`;
}

// ---------------------------------------------------------------------------
// QR
// ---------------------------------------------------------------------------
export interface Qr {
  /** Módulos por lado, sin margen. */
  tam: number;
  /** Trazado SVG de los módulos oscuros, en unidades de módulo. */
  d: string;
  oscuro(fila: number, col: number): boolean;
}

export function generarQr(texto: string): Qr {
  const qr = qrcode(0, 'M');
  qr.addData(texto, 'Byte');
  qr.make();
  const tam = qr.getModuleCount();
  let d = '';
  for (let f = 0; f < tam; f++) {
    for (let c = 0; c < tam; c++) {
      if (!qr.isDark(f, c)) continue;
      // agrupa módulos oscuros contiguos de la fila en un solo rectángulo
      let fin = c;
      while (fin + 1 < tam && qr.isDark(f, fin + 1)) fin++;
      d += `M${c} ${f}h${fin - c + 1}v1h-${fin - c + 1}z`;
      c = fin;
    }
  }
  return { tam, d, oscuro: (f, c) => qr.isDark(f, c) };
}

// ---------------------------------------------------------------------------
// Code 128 (subconjunto B: ASCII 32-126), para pistolas lectoras 1D
// ---------------------------------------------------------------------------
const PATRONES = [
  '212222', '222122', '222221', '121223', '121322', '131222', '122213', '122312', '132212', '221213',
  '221312', '231212', '112232', '122132', '122231', '113222', '123122', '123221', '223211', '221132',
  '221231', '213212', '223112', '312131', '311222', '321122', '321221', '312212', '322112', '322211',
  '212123', '212321', '232121', '111323', '131123', '131321', '112313', '132113', '132311', '211313',
  '231113', '231311', '112133', '112331', '132131', '113123', '113321', '133121', '313121', '211331',
  '231131', '213113', '213311', '213131', '311123', '311321', '331121', '312113', '312311', '332111',
  '314111', '221411', '431111', '111224', '111422', '121124', '121421', '141122', '141221', '112214',
  '112412', '122114', '122411', '142112', '142211', '241211', '221114', '413111', '241112', '134111',
  '111242', '121142', '121241', '114212', '124112', '124211', '411212', '421112', '421211', '212141',
  '214121', '412121', '111143', '111341', '131141', '114113', '114311', '411113', '411311', '113141',
  '114131', '311141', '411131', '211412', '211214', '211232', '2331112',
];
const INICIO_B = 104;
const PARADA = 106;

export function code128Admite(texto: string): boolean {
  return texto.length > 0 && /^[\x20-\x7e]+$/.test(texto);
}

/**
 * Anchos de barras y espacios (alternando, empieza en barra) en módulos, sin zona muda.
 * Lanza error si el texto tiene caracteres fuera de ASCII imprimible.
 */
export function code128(texto: string): number[] {
  if (!code128Admite(texto)) throw new Error('Code 128 B solo admite ASCII imprimible');
  const valores = [INICIO_B, ...[...texto].map((ch) => ch.charCodeAt(0) - 32)];
  const control = valores.reduce((s, v, i) => s + v * (i === 0 ? 1 : i), 0) % 103;
  return [...valores, control, PARADA].flatMap((v) => [...PATRONES[v]].map(Number));
}

/** Rectángulos de las barras para dibujarlas en SVG (x y ancho en módulos). */
export function barrasCode128(texto: string): { barras: { x: number; w: number }[]; ancho: number } {
  const anchos = code128(texto);
  const barras: { x: number; w: number }[] = [];
  let x = 0;
  anchos.forEach((w, i) => {
    if (i % 2 === 0) barras.push({ x, w });
    x += w;
  });
  return { barras, ancho: x };
}
