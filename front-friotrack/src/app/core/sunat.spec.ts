import { calcularLinea, calcularTotales, textoQr, tipoPorRuta, unidadSunat } from './sunat';
import type { Comprobante } from './types';

describe('importes de comprobantes', () => {
  // Mismos casos que la prueba del backend (DocumentoSunat.lineaGravada).
  it('calcula cada línea a partir del precio con IGV', () => {
    expect(calcularLinea(3, 5.9)).toEqual({ total: 17.7, valorVenta: 15, igv: 2.7 });
    expect(calcularLinea(2.5, 18.5)).toEqual({ total: 46.25, valorVenta: 39.19, igv: 7.06 });
  });
  it('suma op. gravada, IGV y total', () => {
    expect(calcularTotales([{ cantidad: 3, precio: 5.9 }, { cantidad: 2.5, precio: 18.5 }])).toEqual({ gravada: 54.19, igv: 9.76, total: 63.95 });
  });
  it('ignora filas incompletas', () => {
    expect(calcularTotales([{ cantidad: 0, precio: 10 }, { cantidad: 1, precio: NaN }])).toEqual({ gravada: 0, igv: 0, total: 0 });
  });
});

describe('catálogos', () => {
  it('convierte la unidad del lote a la de SUNAT', () => {
    expect(unidadSunat('kg')).toBe('KGM');
    expect(unidadSunat('Litros')).toBe('LTR');
    expect(unidadSunat('und')).toBe('NIU');
    expect(unidadSunat(null)).toBe('NIU');
  });
  it('resuelve el tipo desde la ruta', () => {
    expect(tipoPorRuta('factura')).toBe('01');
    expect(tipoPorRuta('guia')).toBe('09');
    expect(tipoPorRuta('otro')).toBeNull();
  });
});

describe('QR de la representación impresa', () => {
  const base = {
    emisor: { ruc: '20000000001' },
    tipo: '01',
    serie: 'FPP1',
    correlativo: 7,
    igv: 9.76,
    total: 63.95,
    fecha_emision: '2026-11-04T19:30:00',
    cliente_tipo_doc: '6',
    cliente_num_doc: '20100070970',
    hash: 'abc=',
  } as unknown as Comprobante;
  it('sigue el formato RUC|TIPO|SERIE|NÚMERO|IGV|TOTAL|FECHA|TIPO DOC|NÚM DOC|HASH|', () => {
    expect(textoQr(base)).toBe('20000000001|01|FPP1|7|9.76|63.95|2026-11-04|6|20100070970|abc=|');
  });
});
