// Firma XMLDSig "enveloped" (RSA-SHA256, C14N inclusiva) dentro de ext:ExtensionContent, como pide SUNAT.
import { SignedXml } from "xml-crypto";
import { CERT_PRUEBA, CLAVE_PRUEBA } from "./certificado-prueba.ts";
import { ID_FIRMA } from "./xml.ts";

export type Firmado = { xml: string; hash: string };

const pem = (nombre: string, porDefecto: string) => (process.env[nombre] ?? "").replace(/\\n/g, "\n").trim() || porDefecto;

export function firmar(xml: string): Firmado {
  const cert = pem("SUNAT_CERT_PEM", CERT_PRUEBA);
  const clave = pem("SUNAT_KEY_PEM", CLAVE_PRUEBA);
  if (!xml.includes("<ext:ExtensionContent/>")) throw new Error("El XML no tiene ext:ExtensionContent para la firma");
  const sig = new SignedXml({
    privateKey: clave,
    publicCert: cert,
    signatureAlgorithm: "http://www.w3.org/2001/04/xmldsig-more#rsa-sha256",
    canonicalizationAlgorithm: "http://www.w3.org/TR/2001/REC-xml-c14n-20010315",
  });
  sig.addReference({
    xpath: "/*",
    uri: "",
    isEmptyUri: true,
    transforms: ["http://www.w3.org/2000/09/xmldsig#enveloped-signature"],
    digestAlgorithm: "http://www.w3.org/2001/04/xmlenc#sha256",
  });
  sig.computeSignature(xml, {
    prefix: "ds",
    attrs: { Id: ID_FIRMA },
    location: { reference: "//*[local-name(.)='ExtensionContent']", action: "append" },
  });
  const firmado = sig.getSignedXml();
  const hash = /<ds:DigestValue>([^<]+)<\/ds:DigestValue>/.exec(firmado)?.[1] ?? "";
  // getSignedXml conserva la declaración XML original.
  return { xml: firmado, hash };
}

/** Verifica la firma con el certificado incluido en el XML (para pruebas). */
export function verificar(xml: string): boolean {
  const cert = /<ds:X509Certificate>([^<]+)<\/ds:X509Certificate>/.exec(xml)?.[1];
  const firma = /<ds:Signature[\s\S]*<\/ds:Signature>/.exec(xml)?.[0];
  if (!cert || !firma) return false;
  const v = new SignedXml({ publicCert: `-----BEGIN CERTIFICATE-----\n${cert}\n-----END CERTIFICATE-----` });
  v.loadSignature(firma);
  try {
    return v.checkSignature(xml);
  } catch {
    return false;
  }
}
