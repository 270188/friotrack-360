// Envío al servicio SOAP billService de SUNAT (sendBill) y lectura de la constancia de recepción (CDR).
import { unzipSync, zipSync, strToU8, strFromU8 } from "fflate";
import { DOMParser } from "@xmldom/xmldom";
import type { Emisor } from "./documento.ts";
import { esc } from "./xml.ts";

export const URL_BETA = "https://e-beta.sunat.gob.pe/ol-ti-itcpfegem-beta/billService";
export type Estado = "ACEPTADO" | "OBSERVADO" | "RECHAZADO" | "ERROR";
export type RespuestaSunat = { estado: Estado; codigo: string | null; descripcion: string | null; observaciones: string[]; cdrZip: Uint8Array | null };

const NS_CBC = "urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2";
const NS_CAC = "urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2";

export const zip = (nombre: string, contenido: string) => zipSync({ [nombre]: strToU8(contenido) });

export function sobreSendBill(usuario: string, clave: string, archivoZip: string, base64: string) {
  return '<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"' +
    ' xmlns:ser="http://service.sunat.gob.pe"' +
    ' xmlns:wsse="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd">' +
    "<soapenv:Header><wsse:Security><wsse:UsernameToken>" +
    `<wsse:Username>${esc(usuario)}</wsse:Username><wsse:Password>${esc(clave)}</wsse:Password>` +
    "</wsse:UsernameToken></wsse:Security></soapenv:Header>" +
    `<soapenv:Body><ser:sendBill><fileName>${esc(archivoZip)}</fileName><contentFile>${base64}</contentFile>` +
    "</ser:sendBill></soapenv:Body></soapenv:Envelope>";
}

/** @param nombre RUC-TIPO-SERIE-NUMERO sin extensión, por ejemplo 20000000001-01-F001-1 */
export async function enviar(emisor: Emisor, nombre: string, xmlFirmado: string, url = URL_BETA): Promise<RespuestaSunat> {
  const contenido = Buffer.from(zip(`${nombre}.xml`, xmlFirmado)).toString("base64");
  const sobre = sobreSendBill(emisor.ruc + emisor.usuarioSol, emisor.claveSol, `${nombre}.zip`, contenido);
  let status: number;
  let cuerpo: string;
  try {
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "text/xml; charset=utf-8", SOAPAction: "urn:sendBill" },
      body: sobre,
      signal: AbortSignal.timeout(40_000),
    });
    status = r.status;
    cuerpo = await r.text();
  } catch (e) {
    const err = e as Error;
    return { estado: "ERROR", codigo: null, descripcion: `No se pudo conectar con SUNAT (${err.name}): ${err.message}`, observaciones: [], cdrZip: null };
  }
  return leerRespuestaSoap(status, cuerpo);
}

function parsear(xml: string) {
  let error: string | null = null;
  const doc = new DOMParser({ onError: (_nivel: string, msg: string) => { error ??= msg; } }).parseFromString(xml, "text/xml");
  if (error || !doc.documentElement) throw new Error(error ?? "XML vacío");
  return doc;
}
const primero = (doc: any, local: string) => doc.getElementsByTagNameNS("*", local)[0] ?? null;
function textoHijo(padre: any, local: string): string | null {
  let l = padre.getElementsByTagNameNS("*", local);
  if (!l.length) l = padre.getElementsByTagName(local);
  return l.length ? String(l[0].textContent).trim() : null;
}

export function leerRespuestaSoap(status: number, cuerpo: string): RespuestaSunat {
  let doc;
  try {
    doc = parsear(cuerpo);
  } catch {
    return { estado: "ERROR", codigo: String(status), descripcion: `Respuesta no valida de SUNAT (HTTP ${status}): ${cuerpo.length > 300 ? cuerpo.slice(0, 300) + "..." : cuerpo}`, observaciones: [], cdrZip: null };
  }
  const fault = primero(doc, "Fault");
  if (fault) {
    const faultcode = textoHijo(fault, "faultcode");
    const faultstring = textoHijo(fault, "faultstring");
    const codigo = /(\d{1,4})\s*$/.exec(faultcode ?? "")?.[1] ?? /(\d{1,4})\s*$/.exec(faultstring ?? "")?.[1] ?? null;
    const n = codigo === null ? -1 : Number(codigo);
    return {
      estado: n >= 2000 && n < 4000 ? "RECHAZADO" : "ERROR",
      codigo,
      descripcion: faultstring && faultstring.trim() ? faultstring : faultcode,
      observaciones: [],
      cdrZip: null,
    };
  }
  const app = primero(doc, "applicationResponse");
  if (!app) return { estado: "ERROR", codigo: String(status), descripcion: `SUNAT no devolvio la constancia de recepcion (HTTP ${status})`, observaciones: [], cdrZip: null };
  return leerCdr(new Uint8Array(Buffer.from(String(app.textContent).replace(/\s+/g, ""), "base64")));
}

/** Lee la CDR: un ZIP con el XML ApplicationResponse. */
export function leerCdr(cdrZip: Uint8Array): RespuestaSunat {
  try {
    const archivos = unzipSync(cdrZip);
    const nombre = Object.keys(archivos).find((n) => n.toLowerCase().endsWith(".xml"));
    if (!nombre) throw new Error("El ZIP no contiene un XML");
    const doc = parsear(strFromU8(archivos[nombre]));
    const resp = doc.getElementsByTagNameNS(NS_CAC, "Response")[0];
    const textoCbc = (padre: any, local: string) => {
      const l = padre.getElementsByTagNameNS(NS_CBC, local);
      return l.length ? String(l[0].textContent).trim() : null;
    };
    const codigo = resp ? textoCbc(resp, "ResponseCode") : null;
    const descripcion = resp ? textoCbc(resp, "Description") : null;
    const notas: string[] = [];
    const hijos = doc.documentElement!.childNodes;
    for (let i = 0; i < hijos.length; i++) {
      const h = hijos[i] as any;
      if (h.nodeType === 1 && h.namespaceURI === NS_CBC && h.localName === "Note") notas.push(String(h.textContent).trim());
    }
    const n = codigo === null ? -1 : Number(codigo);
    const estado: Estado = n === 0 ? (notas.length ? "OBSERVADO" : "ACEPTADO") : n >= 4000 ? "OBSERVADO" : n >= 2000 ? "RECHAZADO" : "ERROR";
    return { estado, codigo, descripcion, observaciones: notas, cdrZip };
  } catch (e) {
    return { estado: "ERROR", codigo: null, descripcion: `No se pudo leer la CDR: ${(e as Error).message}`, observaciones: [], cdrZip };
  }
}
