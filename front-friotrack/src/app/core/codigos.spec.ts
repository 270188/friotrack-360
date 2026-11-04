import { BarcodeFormat, BinaryBitmap, DecodeHintType, HybridBinarizer, MultiFormatReader, RGBLuminanceSource } from '@zxing/library';
import { barrasCode128, code128, generarQr, interpretarLectura, tipoPorPrefijo, urlEtiqueta } from './codigos';

/** Decodifica una imagen en escala de grises (0 = negro, 255 = blanco) con el mismo lector que usa la cámara. */
function decodificar(lum: Uint8ClampedArray, w: number, h: number, formato: BarcodeFormat): string {
  const lector = new MultiFormatReader();
  lector.setHints(new Map<DecodeHintType, unknown>([[DecodeHintType.POSSIBLE_FORMATS, [formato]], [DecodeHintType.TRY_HARDER, true]]));
  return lector.decode(new BinaryBitmap(new HybridBinarizer(new RGBLuminanceSource(lum, w, h)))).getText();
}

function imagenQr(texto: string, escala = 4, margen = 4) {
  const qr = generarQr(texto);
  const lado = (qr.tam + margen * 2) * escala;
  const lum = new Uint8ClampedArray(lado * lado).fill(255);
  for (let y = 0; y < lado; y++)
    for (let x = 0; x < lado; x++) {
      const f = Math.floor(y / escala) - margen;
      const c = Math.floor(x / escala) - margen;
      if (f >= 0 && c >= 0 && f < qr.tam && c < qr.tam && qr.oscuro(f, c)) lum[y * lado + x] = 0;
    }
  return { lum, lado };
}

function imagenCode128(texto: string, escala = 2, alto = 40) {
  const { barras, ancho } = barrasCode128(texto);
  const w = (ancho + 20) * escala;
  const lum = new Uint8ClampedArray(w * alto).fill(255);
  for (const b of barras)
    for (let x = (b.x + 10) * escala; x < (b.x + 10 + b.w) * escala; x++) for (let y = 0; y < alto; y++) lum[y * w + x] = 0;
  return { lum, w, h: alto };
}

describe('interpretarLectura', () => {
  it('reconoce códigos de lote y despacho por prefijo', () => {
    expect(interpretarLectura('LOT-2026-0001')).toEqual({ codigo: 'LOT-2026-0001', tipo: 'lote' });
    expect(interpretarLectura('  dsp-2026-0002\r\n')).toEqual({ codigo: 'dsp-2026-0002', tipo: 'despacho' });
    expect(interpretarLectura('ABC123')).toEqual({ codigo: 'ABC123', tipo: null });
    expect(tipoPorPrefijo('LOTE')).toBeNull();
  });
  it('lee la URL de una etiqueta', () => {
    const url = urlEtiqueta('despacho', 'DSP 01/A', 'https://polar.example');
    expect(url).toBe('https://polar.example/escanear?tipo=despacho&codigo=DSP%2001%2FA');
    expect(interpretarLectura(url)).toEqual({ codigo: 'DSP 01/A', tipo: 'despacho' });
    expect(interpretarLectura('https://x.dev/escanear?codigo=LOT-9')).toEqual({ codigo: 'LOT-9', tipo: 'lote' });
  });
  it('descarta lecturas vacías y URLs ajenas', () => {
    expect(interpretarLectura('   ')).toBeNull();
    expect(interpretarLectura('https://otra-web.com/promo')).toBeNull();
  });
});

describe('QR', () => {
  it('genera un QR que el lector decodifica con el mismo texto', () => {
    const texto = urlEtiqueta('lote', 'LOT-2026-0001', 'https://polar-piura-sac.vercel.app');
    const { lum, lado } = imagenQr(texto);
    expect(decodificar(lum, lado, lado, BarcodeFormat.QR_CODE)).toBe(texto);
  });
  it('el trazado SVG cubre exactamente los módulos oscuros', () => {
    const qr = generarQr('LOT-1');
    let oscuros = 0;
    for (let f = 0; f < qr.tam; f++) for (let c = 0; c < qr.tam; c++) if (qr.oscuro(f, c)) oscuros++;
    const area = [...qr.d.matchAll(/h(\d+)/g)].reduce((s, m) => s + Number(m[1]), 0);
    expect(area).toBe(oscuros);
  });
});

describe('Code 128', () => {
  it('cada símbolo mide 11 módulos y la parada 13', () => {
    const anchos = code128('LOT-2026-0001');
    const total = anchos.reduce((a, b) => a + b, 0);
    expect(total).toBe(11 * (1 + 13 + 1) + 13);
  });
  it.each(['LOT-2026-0001', 'DSP-2026-0099', 'Lote a/b 7'])('el lector decodifica "%s"', (texto) => {
    const { lum, w, h } = imagenCode128(texto);
    expect(decodificar(lum, w, h, BarcodeFormat.CODE_128)).toBe(texto);
  });
  it('rechaza caracteres fuera de ASCII', () => {
    expect(() => code128('LOTE-Ñ')).toThrow();
  });
});
