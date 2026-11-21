// Datos de los comprobantes (DocumentoSunat.java) y monto en letras (MontoEnLetras.java).
import { dec, dividir, escala, multiplicar, restar, sumar, texto, type Dec } from "./decimal.ts";

export const FACTURA = "01";
export const BOLETA = "03";
export const GUIA_REMISION = "09";
const UNO_MAS_IGV = dec("1.18");

export type Emisor = {
  ruc: string; razonSocial: string; nombreComercial: string; ubigeo: string; departamento: string; provincia: string;
  distrito: string; direccion: string; usuarioSol: string; claveSol: string;
};
export type Cliente = { tipoDoc: string; numDoc: string; nombre: string; direccion: string | null };
export type Linea = {
  codigo: string | null; descripcion: string; unidad: string; cantidad: Dec; valorUnitario: Dec; precioUnitario: Dec;
  valorVenta: Dec; igv: Dec;
};
export type Venta = {
  tipo: string; serie: string; correlativo: number; fecha: string; hora: string; moneda: string; cliente: Cliente;
  lineas: Linea[]; gravada: Dec; igv: Dec; total: Dec;
};
export type Direccion = { ubigeo: string; linea: string };
export type Conductor = { tipoDoc: string; numDoc: string; nombres: string; apellidos: string; licencia: string };
export type LineaGuia = { codigo: string | null; descripcion: string; unidad: string; cantidad: Dec };
export type Guia = {
  serie: string; correlativo: number; fecha: string; hora: string; destinatario: Cliente; motivo: string;
  descripcionMotivo: string | null; pesoKg: Dec; modalidad: string; fechaTraslado: string; transportista: Cliente | null;
  conductor: Conductor | null; placa: string | null; partida: Direccion; llegada: Direccion; lineas: LineaGuia[];
  observacion: string | null;
};

/**
 * Línea gravada a partir del precio unitario con IGV:
 * valor unitario = precio / 1.18 ; total = cantidad × precio ; valor de venta = total / 1.18 ; IGV = total − valor de venta.
 */
export function lineaGravada(codigo: string | null, descripcion: string, unidad: string, cantidad: Dec, precioConIgv: Dec): Linea {
  const valorUnitario = dividir(precioConIgv, UNO_MAS_IGV, 6);
  const total = escala(multiplicar(cantidad, precioConIgv), 2);
  const valorVenta = dividir(total, UNO_MAS_IGV, 2);
  const igv = restar(total, valorVenta);
  return { codigo, descripcion, unidad, cantidad, valorUnitario, precioUnitario: escala(precioConIgv, 2), valorVenta, igv };
}
export const totalLinea = (l: Linea) => sumar(l.valorVenta, l.igv);

/** Unidad del catálogo 03 de SUNAT a partir de una unidad libre. */
export function unidadSunat(unidad: string | null): string {
  if (unidad === null || unidad === undefined) return "NIU";
  const u = unidad.trim().toLowerCase();
  if (["kg", "kgs", "kilo", "kilos", "kilogramo", "kilogramos", "kgm"].includes(u)) return "KGM";
  if (["g", "gr", "gramo", "gramos", "grm"].includes(u)) return "GRM";
  if (["l", "lt", "lts", "litro", "litros", "ltr"].includes(u)) return "LTR";
  if (["caja", "cajas", "cj", "bx"].includes(u)) return "BX";
  if (["paquete", "paquetes", "pk"].includes(u)) return "PK";
  if (["zz", "servicio"].includes(u)) return "ZZ";
  return "NIU";
}

// ------------------------------------------------------------------ monto en letras (leyenda 1000)

const UNIDADES = ["", "UNO", "DOS", "TRES", "CUATRO", "CINCO", "SEIS", "SIETE", "OCHO", "NUEVE", "DIEZ", "ONCE", "DOCE", "TRECE",
  "CATORCE", "QUINCE", "DIECISEIS", "DIECISIETE", "DIECIOCHO", "DIECINUEVE", "VEINTE", "VEINTIUNO", "VEINTIDOS", "VEINTITRES",
  "VEINTICUATRO", "VEINTICINCO", "VEINTISEIS", "VEINTISIETE", "VEINTIOCHO", "VEINTINUEVE"];
const DECENAS = ["", "", "", "TREINTA", "CUARENTA", "CINCUENTA", "SESENTA", "SETENTA", "OCHENTA", "NOVENTA"];
const CENTENAS = ["", "CIENTO", "DOSCIENTOS", "TRESCIENTOS", "CUATROCIENTOS", "QUINIENTOS", "SEISCIENTOS", "SETECIENTOS",
  "OCHOCIENTOS", "NOVECIENTOS"];

/** "SON SESENTA Y TRES CON 95/100 SOLES". */
export function montoEnLetras(monto: Dec | number): string {
  const m = escala(dec(monto as any), 2);
  const t = texto(m).replace("-", "");
  const [ent, cent] = t.split(".");
  return `SON ${letras(Number(ent) * (m.v < 0n ? -1 : 1))} CON ${cent}/100 SOLES`;
}

export function letras(n: number): string {
  if (n === 0) return "CERO";
  if (n < 0) return "MENOS " + letras(-n);
  const millones = Math.floor(n / 1_000_000);
  const miles = Math.floor(n / 1_000) % 1_000;
  const resto = n % 1_000;
  const partes: string[] = [];
  if (millones > 0) partes.push(millones === 1 ? "UN MILLON" : apocope(letras(millones)) + " MILLONES");
  if (miles > 0) partes.push(miles === 1 ? "MIL" : apocope(centenas(miles)) + " MIL");
  if (resto > 0) partes.push(centenas(resto));
  return partes.join(" ");
}
const apocope = (s: string) => (s.endsWith("UNO") ? s.slice(0, -1) : s);
function centenas(n: number): string {
  if (n === 100) return "CIEN";
  const c = Math.floor(n / 100);
  const d = decenas(n % 100);
  if (c === 0) return d;
  return d === "" ? CENTENAS[c] : `${CENTENAS[c]} ${d}`;
}
function decenas(n: number): string {
  if (n < 30) return UNIDADES[n];
  const d = Math.floor(n / 10);
  const u = n % 10;
  return u === 0 ? DECENAS[d] : `${DECENAS[d]} Y ${UNIDADES[u]}`;
}
