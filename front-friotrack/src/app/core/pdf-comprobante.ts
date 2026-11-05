// Representación impresa (PDF A4) de facturas, boletas y guías de remisión, generada en el navegador.
import type { jsPDF as JsPDF } from 'jspdf';
import { generarQr } from './codigos';
import { fecha, fechaHora } from './format';
import { DOCUMENTOS, MOTIVOS, TIPOS, textoEstado, textoQr } from './sunat';
import type { Comprobante } from './types';

type Rgb = [number, number, number];
const TINTA: Rgb = [11, 37, 51];
const TEXTO: Rgb = [40, 58, 66];
const GRIS: Rgb = [107, 133, 144];
const HIELO: Rgb = [234, 245, 247];
const LINEA: Rgb = [200, 214, 219];
const ALERTA: Rgb = [217, 80, 43];

const M = 14; // margen
const ANCHO = 210;
const ALTO = 297;
const UTIL = ANCHO - 2 * M;

/** jsPDF usa WinAnsi con las fuentes estándar: se reemplazan espacios especiales que no existen ahí. */
const t = (s: string | number | null | undefined) =>
  String(s ?? '').replace(/[   ]/g, ' ').replace(/[‘’]/g, "'").replace(/[“”]/g, '"');

const soles = (n: number) => n.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const cant = (n: number) => n.toLocaleString('es-PE', { maximumFractionDigits: 3 });

export async function pdfComprobante(c: Comprobante, generadoPor: string): Promise<Blob> {
  const { jsPDF, GState } = await import('jspdf');
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  doc.setProperties({ title: `${TIPOS[c.tipo].nombre} ${c.numero}`, subject: c.emisor.razon_social, creator: generadoPor });
  const esGuia = c.tipo === '09';

  let y = cabecera(doc, c);

  if (c.emisor.prueba) {
    doc.setFillColor(255, 241, 236);
    doc.setDrawColor(...ALERTA);
    doc.setLineWidth(0.3);
    doc.roundedRect(M, y, UTIL, 9, 1.5, 1.5, 'FD');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(...ALERTA);
    doc.text(t('DOCUMENTO DE PRUEBA – emitido en el entorno de pruebas (beta) de SUNAT. No tiene valor tributario.'), ANCHO / 2, y + 5.8, { align: 'center' });
    y += 13;
  }

  y = esGuia ? datosGuia(doc, c, y) : datosVenta(doc, c, y);
  y = tablaItems(doc, c, y + 4);
  if (!esGuia) y = totales(doc, c, y + 2);

  if (c.observacion) {
    y = asegurar(doc, y, 14);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(...GRIS);
    doc.text('OBSERVACIONES', M, y + 4);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...TEXTO);
    const lineas = doc.splitTextToSize(t(c.observacion), UTIL) as string[];
    doc.text(lineas, M, y + 8.5);
    y += 8 + lineas.length * 3.8;
  }

  pie(doc, c, asegurar(doc, y + 4, 40));

  const paginas = doc.getNumberOfPages();
  for (let p = 1; p <= paginas; p++) {
    doc.setPage(p);
    if (c.emisor.prueba) marcaDeAgua(doc, new GState({ opacity: 0.07 }));
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...GRIS);
    doc.text(t(`${c.emisor.razon_social} · ${TIPOS[c.tipo].nombre} ${c.numero}`), M, ALTO - 8);
    doc.text(t(`Página ${p} de ${paginas} · Generado con ${generadoPor}`), ANCHO - M, ALTO - 8, { align: 'right' });
  }
  return doc.output('blob');
}

// ---------------------------------------------------------------------------
function cabecera(doc: JsPDF, c: Comprobante): number {
  const e = c.emisor;
  const anchoCaja = 68;
  const xCaja = ANCHO - M - anchoCaja;
  const top = M;

  doc.setTextColor(...TINTA);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  const nombre = doc.splitTextToSize(t(e.nombre_comercial || e.razon_social), xCaja - M - 6) as string[];
  doc.text(nombre, M, top + 7);
  let y = top + 7 + (nombre.length - 1) * 6.5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...TEXTO);
  if (e.nombre_comercial && e.nombre_comercial !== e.razon_social) {
    y += 5;
    doc.text(t(e.razon_social), M, y);
  }
  // Dirección sin repetir distrito / provincia / departamento que ya aparecen (p. ej. "PIURA - PERU").
  const dir = [e.direccion, e.distrito, e.provincia, e.departamento]
    .filter((x) => x && x !== '-')
    .reduce((acc: string[], x) => (acc.some((y) => y.toUpperCase().includes(x.toUpperCase())) ? acc : [...acc, x]), [])
    .join(' – ');
  if (dir) {
    const d = doc.splitTextToSize(t(dir), xCaja - M - 6) as string[];
    doc.text(d, M, y + 4.5);
    y += 4.5 + (d.length - 1) * 3.6;
  }

  doc.setDrawColor(...TINTA);
  doc.setLineWidth(0.5);
  doc.roundedRect(xCaja, top, anchoCaja, 30, 2, 2, 'S');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...TINTA);
  doc.text(t(`R.U.C. N° ${e.ruc}`), xCaja + anchoCaja / 2, top + 7.5, { align: 'center' });
  doc.setFillColor(...TINTA);
  doc.rect(xCaja, top + 10.5, anchoCaja, 9, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(c.tipo === '09' ? 7.6 : 9.5);
  doc.text(t(TIPOS[c.tipo].nombre.toUpperCase()), xCaja + anchoCaja / 2, top + 16.2, { align: 'center' });
  doc.setTextColor(...TINTA);
  doc.setFontSize(13);
  doc.text(t(c.numero), xCaja + anchoCaja / 2, top + 26.5, { align: 'center' });

  return Math.max(y, top + 30) + 6;
}

function campo(doc: JsPDF, etiqueta: string, valor: string, x: number, y: number, ancho: number): number {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(...GRIS);
  doc.text(t(etiqueta.toUpperCase()), x, y);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...TEXTO);
  const l = doc.splitTextToSize(t(valor || '—'), ancho) as string[];
  doc.text(l, x, y + 4.2);
  return y + 4.2 + l.length * 3.9 + 1.8;
}

function datosVenta(doc: JsPDF, c: Comprobante, y: number): number {
  const col = M + 4;
  const der = M + UTIL * 0.64;
  let a = y + 5.5;
  a = campo(doc, 'Señor(es)', c.cliente_nombre, col, a, der - col - 6);
  a = campo(doc, DOCUMENTOS[c.cliente_tipo_doc] ?? 'Documento', c.cliente_num_doc, col, a, der - col - 6);
  if (c.cliente_direccion) a = campo(doc, 'Dirección', c.cliente_direccion, col, a, der - col - 6);
  let b = y + 5.5;
  b = campo(doc, 'Fecha de emisión', fechaHora(c.fecha_emision), der, b, ANCHO - M - der - 4);
  b = campo(doc, 'Moneda', 'Soles (PEN)', der, b, ANCHO - M - der - 4);
  if (c.tipo === '01') b = campo(doc, 'Forma de pago', 'Contado', der, b, ANCHO - M - der - 4);
  const fin = Math.max(a, b) + 1;
  doc.setDrawColor(...LINEA);
  doc.setLineWidth(0.3);
  doc.roundedRect(M, y, UTIL, fin - y, 1.5, 1.5, 'S');
  return fin;
}

function datosGuia(doc: JsPDF, c: Comprobante, y: number): number {
  const tr = c.traslado;
  const col = M + 4;
  const mitad = M + UTIL / 2;
  const anchoCol = UTIL / 2 - 8;
  const inicio = y;
  let a = y + 5.5;
  a = campo(doc, 'Destinatario', c.cliente_nombre, col, a, anchoCol);
  a = campo(doc, DOCUMENTOS[c.cliente_tipo_doc] ?? 'Documento', c.cliente_num_doc, col, a, anchoCol);
  a = campo(doc, 'Motivo de traslado', tr ? MOTIVOS[tr.motivo] ?? tr.descripcion_motivo ?? tr.motivo : '—', col, a, anchoCol);
  a = campo(doc, 'Punto de partida', tr ? `${tr.partida_direccion} (ubigeo ${tr.partida_ubigeo})` : '—', col, a, anchoCol);
  a = campo(doc, 'Punto de llegada', tr ? `${tr.llegada_direccion} (ubigeo ${tr.llegada_ubigeo})` : '—', col, a, anchoCol);
  let b = y + 5.5;
  b = campo(doc, 'Fecha de emisión', fechaHora(c.fecha_emision), mitad, b, anchoCol);
  b = campo(doc, 'Inicio del traslado', tr ? fecha(tr.fecha_traslado) : '—', mitad, b, anchoCol);
  b = campo(doc, 'Peso bruto total', tr ? `${cant(tr.peso_kg)} KGM` : '—', mitad, b, anchoCol);
  if (tr?.modalidad === '01') {
    b = campo(doc, 'Modalidad', 'Transporte público', mitad, b, anchoCol);
    b = campo(doc, 'Transportista', `${tr.transportista_nombre ?? ''} · RUC ${tr.transportista_ruc ?? ''}`, mitad, b, anchoCol);
  } else if (tr) {
    b = campo(doc, 'Modalidad', 'Transporte privado', mitad, b, anchoCol);
    b = campo(doc, 'Conductor', `${tr.conductor_nombres ?? ''} ${tr.conductor_apellidos ?? ''} · DNI ${tr.conductor_dni ?? ''} · Licencia ${tr.conductor_licencia ?? ''}`, mitad, b, anchoCol);
    b = campo(doc, 'Vehículo (placa)', tr.placa ?? '—', mitad, b, anchoCol);
  }
  if (c.codigo_despacho) b = campo(doc, 'Despacho', c.codigo_despacho, mitad, b, anchoCol);
  const fin = Math.max(a, b) + 1;
  doc.setDrawColor(...LINEA);
  doc.setLineWidth(0.3);
  doc.roundedRect(M, inicio, UTIL, fin - inicio, 1.5, 1.5, 'S');
  return fin;
}

interface Columna {
  titulo: string;
  ancho: number;
  alin?: 'left' | 'right' | 'center';
  valor: (i: Comprobante['items'][number]) => string;
}

function tablaItems(doc: JsPDF, c: Comprobante, y: number): number {
  const cols: Columna[] = [
    { titulo: 'N°', ancho: 8, alin: 'center', valor: (i) => String(i.orden) },
    { titulo: 'Cant.', ancho: 18, alin: 'right', valor: (i) => cant(i.cantidad) },
    { titulo: 'Unid.', ancho: 13, alin: 'center', valor: (i) => i.unidad },
    { titulo: 'Código', ancho: 28, valor: (i) => i.codigo ?? '' },
    { titulo: 'Descripción', ancho: 0, valor: (i) => i.descripcion },
  ];
  if (c.tipo !== '09') {
    cols.push({ titulo: 'P. unit.', ancho: 22, alin: 'right', valor: (i) => soles(i.precio_unitario) });
    cols.push({ titulo: 'Importe', ancho: 24, alin: 'right', valor: (i) => soles(i.total) });
  }
  const fijo = cols.reduce((s, col) => s + col.ancho, 0);
  cols.find((col) => col.ancho === 0)!.ancho = UTIL - fijo;

  const encabezado = (yy: number) => {
    doc.setFillColor(...HIELO);
    doc.rect(M, yy, UTIL, 7, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(...TINTA);
    let x = M;
    for (const col of cols) {
      doc.text(t(col.titulo.toUpperCase()), posX(x, col), yy + 4.7, { align: col.alin ?? 'left' });
      x += col.ancho;
    }
    return yy + 7;
  };

  y = encabezado(y);
  doc.setFontSize(8.5);
  for (const item of c.items) {
    doc.setFont('helvetica', 'normal');
    const celdas = cols.map((col) => doc.splitTextToSize(t(col.valor(item)), col.ancho - 3) as string[]);
    const alto = Math.max(...celdas.map((l) => l.length)) * 3.8 + 3;
    if (y + alto > ALTO - 22) {
      doc.addPage();
      y = encabezado(M);
      doc.setFontSize(8.5);
    }
    let x = M;
    doc.setTextColor(...TEXTO);
    cols.forEach((col, k) => {
      doc.text(celdas[k], posX(x, col), y + 4.3, { align: col.alin ?? 'left' });
      x += col.ancho;
    });
    y += alto;
    doc.setDrawColor(...LINEA);
    doc.setLineWidth(0.2);
    doc.line(M, y, M + UTIL, y);
  }
  return y;
}

function posX(x: number, col: Columna): number {
  if (col.alin === 'right') return x + col.ancho - 1.5;
  if (col.alin === 'center') return x + col.ancho / 2;
  return x + 1.5;
}

function totales(doc: JsPDF, c: Comprobante, y: number): number {
  y = asegurar(doc, y, 26);
  const x = ANCHO - M - 72;
  const filas: [string, string, boolean][] = [
    ['Op. gravada', `S/ ${soles(c.op_gravada)}`, false],
    ['IGV (18 %)', `S/ ${soles(c.igv)}`, false],
    ['Importe total', `S/ ${soles(c.total)}`, true],
  ];
  let yy = y + 5;
  for (const [k, v, fuerte] of filas) {
    if (fuerte) {
      doc.setFillColor(...TINTA);
      doc.rect(x, yy - 4.3, 72, 6.6, 'F');
      doc.setTextColor(255, 255, 255);
    } else {
      doc.setTextColor(...TEXTO);
    }
    doc.setFont('helvetica', fuerte ? 'bold' : 'normal');
    doc.setFontSize(fuerte ? 10 : 9);
    doc.text(t(k), x + 2.5, yy);
    doc.text(t(v), x + 70, yy, { align: 'right' });
    yy += 6.6;
  }
  if (c.monto_en_letras) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(...TEXTO);
    const l = doc.splitTextToSize(t(c.monto_en_letras), x - M - 6) as string[];
    doc.text(l, M, y + 5);
  }
  return yy;
}

function pie(doc: JsPDF, c: Comprobante, y: number): void {
  const lado = 30;
  const qr = generarQr(textoQr(c));
  const s = lado / (qr.tam + 2);
  doc.setFillColor(255, 255, 255);
  doc.rect(M, y, lado, lado, 'F');
  doc.setFillColor(0, 0, 0);
  for (let f = 0; f < qr.tam; f++) {
    for (let col = 0; col < qr.tam; col++) {
      if (!qr.oscuro(f, col)) continue;
      let fin = col;
      while (fin + 1 < qr.tam && qr.oscuro(f, fin + 1)) fin++;
      doc.rect(M + (col + 1) * s, y + (f + 1) * s, (fin - col + 1) * s + 0.02, s + 0.02, 'F');
      col = fin;
    }
  }

  const x = M + lado + 5;
  const ancho = UTIL - lado - 5;
  let yy = y + 4;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(...TINTA);
  doc.text(t(`Representación impresa de la ${TIPOS[c.tipo].nombre.toLowerCase()}`), x, yy);
  yy += 4.5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.8);
  doc.setTextColor(...TEXTO);
  if (c.hash) {
    doc.text(t(`Resumen (hash): ${c.hash}`), x, yy);
    yy += 4.2;
  }
  const estado = `${textoEstado(c.estado_sunat, c.emisor.prueba)}${c.codigo_respuesta ? ` · código ${c.codigo_respuesta}` : ''}${c.descripcion_respuesta ? `: ${c.descripcion_respuesta}` : ''}`;
  const le = doc.splitTextToSize(t(estado), ancho) as string[];
  doc.setTextColor(...(c.estado_sunat === 'RECHAZADO' || c.estado_sunat === 'ERROR' ? ALERTA : TEXTO));
  doc.text(le, x, yy);
  yy += le.length * 3.6 + 0.6;
  doc.setTextColor(...TEXTO);
  for (const o of c.observaciones_sunat) {
    const lo = doc.splitTextToSize(t(`Observación SUNAT: ${o}`), ancho) as string[];
    doc.text(lo, x, yy);
    yy += lo.length * 3.6;
  }
  if (c.emisor.prueba) {
    doc.setTextColor(...GRIS);
    doc.text(t('Comprobante de prueba: no sustenta operaciones ni gastos ante SUNAT.'), x, Math.max(yy + 1, y + lado - 1));
  }
}

function marcaDeAgua(doc: JsPDF, transparencia: unknown): void {
  doc.saveGraphicsState();
  doc.setGState(transparencia);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(54);
  doc.setTextColor(...ALERTA);
  doc.text('DOCUMENTO DE PRUEBA', ANCHO / 2, ALTO / 2 + 10, { align: 'center', angle: 35 });
  doc.setFontSize(26);
  doc.text('SIN VALOR TRIBUTARIO', ANCHO / 2 + 10, ALTO / 2 + 28, { align: 'center', angle: 35 });
  doc.restoreGraphicsState();
}

/** Si no hay espacio para "alto" mm, pasa a una página nueva. */
function asegurar(doc: JsPDF, y: number, alto: number): number {
  if (y + alto <= ALTO - 16) return y;
  doc.addPage();
  return M;
}
