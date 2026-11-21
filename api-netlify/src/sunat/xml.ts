// XML UBL 2.1 de factura, boleta y guía de remisión (XmlUbl.java). Sale sin firmar, con un
// ext:ExtensionContent vacío donde firma.ts inserta la firma.
import { escala, sinCeros, texto, type Dec } from "./decimal.ts";
import { FACTURA, montoEnLetras, type Cliente, type Emisor, type Guia, type Venta } from "./documento.ts";

export const ID_FIRMA = "SignSUNAT";
const NS =
  ' xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"' +
  ' xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2"' +
  ' xmlns:ds="http://www.w3.org/2000/09/xmldsig#"' +
  ' xmlns:ext="urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2"';
const EXTENSIONES = "<ext:UBLExtensions><ext:UBLExtension><ext:ExtensionContent/></ext:UBLExtension></ext:UBLExtensions>";

export function esc(s: string | null | undefined): string {
  if (s === null || s === undefined) return "";
  let r = "";
  for (const ch of s) {
    if (ch === "&") r += "&amp;";
    else if (ch === "<") r += "&lt;";
    else if (ch === ">") r += "&gt;";
    else if (ch === '"') r += "&quot;";
    else if (ch === "'") r += "&apos;";
    else if (ch >= " " || ch === "\n" || ch === "\t") r += ch;
  }
  return r.trim();
}
const noVacio = (s: string | null | undefined) => s !== null && s !== undefined && s.trim() !== "";
const tag = (n: string, v: string | null | undefined) => `<${n}>${esc(v)}</${n}>`;
const decimal = (v: Dec, s: number) => texto(escala(v, s));
const monto = (n: string, v: Dec, m: string) => `<${n} currencyID="${m}">${decimal(v, 2)}</${n}>`;
/** Montos unitarios: hasta 6 decimales, sin ceros sobrantes (mínimo 2). */
function montoExacto(n: string, v: Dec, m: string) {
  let d = sinCeros(escala(v, 6));
  if (d.s < 2) d = escala(d, 2);
  return `<${n} currencyID="${m}">${texto(d)}</${n}>`;
}
const identificacion = (c: Cliente) =>
  `<cac:PartyIdentification><cbc:ID schemeID="${esc(c.tipoDoc)}">${esc(c.numDoc)}</cbc:ID></cac:PartyIdentification>`;
const esquemaIgv = () => "<cac:TaxScheme><cbc:ID>1000</cbc:ID><cbc:Name>IGV</cbc:Name><cbc:TaxTypeCode>VAT</cbc:TaxTypeCode></cac:TaxScheme>";
const ubigeo = (u: string) => `<cbc:ID schemeAgencyName="PE:INEI" schemeName="Ubigeos">${esc(u)}</cbc:ID>`;

const firma = (e: Emisor) =>
  "<cac:Signature>" + tag("cbc:ID", ID_FIRMA) +
  "<cac:SignatoryParty><cac:PartyIdentification>" + tag("cbc:ID", e.ruc) + "</cac:PartyIdentification>" +
  "<cac:PartyName>" + tag("cbc:Name", e.razonSocial) + "</cac:PartyName></cac:SignatoryParty>" +
  "<cac:DigitalSignatureAttachment><cac:ExternalReference>" + tag("cbc:URI", "#" + ID_FIRMA) +
  "</cac:ExternalReference></cac:DigitalSignatureAttachment></cac:Signature>";

function emisor(e: Emisor) {
  let x = "<cac:Party>";
  x += `<cac:PartyIdentification><cbc:ID schemeID="6">${esc(e.ruc)}</cbc:ID></cac:PartyIdentification>`;
  if (noVacio(e.nombreComercial)) x += "<cac:PartyName>" + tag("cbc:Name", e.nombreComercial) + "</cac:PartyName>";
  x += "<cac:PartyLegalEntity>" + tag("cbc:RegistrationName", e.razonSocial);
  x += "<cac:RegistrationAddress>" + tag("cbc:ID", e.ubigeo) + "<cbc:AddressTypeCode>0000</cbc:AddressTypeCode>" +
    tag("cbc:CityName", e.provincia) + tag("cbc:CountrySubentity", e.departamento) + tag("cbc:District", e.distrito) +
    "<cac:AddressLine>" + tag("cbc:Line", e.direccion) + "</cac:AddressLine>" +
    "<cac:Country><cbc:IdentificationCode>PE</cbc:IdentificationCode></cac:Country></cac:RegistrationAddress>";
  return x + "</cac:PartyLegalEntity></cac:Party>";
}

export function xmlVenta(e: Emisor, v: Venta): string {
  const m = v.moneda;
  let x = '<?xml version="1.0" encoding="UTF-8"?>\n';
  x += `<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"${NS}>`;
  x += EXTENSIONES;
  x += "<cbc:UBLVersionID>2.1</cbc:UBLVersionID><cbc:CustomizationID>2.0</cbc:CustomizationID>";
  x += tag("cbc:ID", `${v.serie}-${v.correlativo}`);
  x += tag("cbc:IssueDate", v.fecha);
  x += tag("cbc:IssueTime", v.hora);
  x += `<cbc:InvoiceTypeCode listID="0101">${v.tipo}</cbc:InvoiceTypeCode>`;
  x += `<cbc:Note languageLocaleID="1000">${esc(montoEnLetras(v.total))}</cbc:Note>`;
  x += tag("cbc:DocumentCurrencyCode", m);
  x += firma(e);
  x += "<cac:AccountingSupplierParty>" + emisor(e) + "</cac:AccountingSupplierParty>";
  x += "<cac:AccountingCustomerParty><cac:Party>" + identificacion(v.cliente);
  x += "<cac:PartyLegalEntity>" + tag("cbc:RegistrationName", v.cliente.nombre);
  if (noVacio(v.cliente.direccion)) {
    x += "<cac:RegistrationAddress><cac:AddressLine>" + tag("cbc:Line", v.cliente.direccion) + "</cac:AddressLine></cac:RegistrationAddress>";
  }
  x += "</cac:PartyLegalEntity></cac:Party></cac:AccountingCustomerParty>";
  if (v.tipo === FACTURA) {
    x += "<cac:PaymentTerms><cbc:ID>FormaPago</cbc:ID><cbc:PaymentMeansID>Contado</cbc:PaymentMeansID></cac:PaymentTerms>";
  }
  x += "<cac:TaxTotal>" + monto("cbc:TaxAmount", v.igv, m);
  x += "<cac:TaxSubtotal>" + monto("cbc:TaxableAmount", v.gravada, m) + monto("cbc:TaxAmount", v.igv, m) +
    "<cac:TaxCategory>" + esquemaIgv() + "</cac:TaxCategory></cac:TaxSubtotal></cac:TaxTotal>";
  x += "<cac:LegalMonetaryTotal>" + monto("cbc:LineExtensionAmount", v.gravada, m) + monto("cbc:TaxInclusiveAmount", v.total, m) +
    monto("cbc:PayableAmount", v.total, m) + "</cac:LegalMonetaryTotal>";
  v.lineas.forEach((l, k) => {
    x += "<cac:InvoiceLine>" + tag("cbc:ID", String(k + 1));
    x += `<cbc:InvoicedQuantity unitCode="${esc(l.unidad)}">${decimal(l.cantidad, 3)}</cbc:InvoicedQuantity>`;
    x += monto("cbc:LineExtensionAmount", l.valorVenta, m);
    x += "<cac:PricingReference><cac:AlternativeConditionPrice>" + monto("cbc:PriceAmount", l.precioUnitario, m) +
      "<cbc:PriceTypeCode>01</cbc:PriceTypeCode></cac:AlternativeConditionPrice></cac:PricingReference>";
    x += "<cac:TaxTotal>" + monto("cbc:TaxAmount", l.igv, m);
    x += "<cac:TaxSubtotal>" + monto("cbc:TaxableAmount", l.valorVenta, m) + monto("cbc:TaxAmount", l.igv, m) +
      "<cac:TaxCategory><cbc:Percent>18</cbc:Percent><cbc:TaxExemptionReasonCode>10</cbc:TaxExemptionReasonCode>" +
      esquemaIgv() + "</cac:TaxCategory></cac:TaxSubtotal></cac:TaxTotal>";
    x += "<cac:Item>" + tag("cbc:Description", l.descripcion);
    if (noVacio(l.codigo)) x += "<cac:SellersItemIdentification>" + tag("cbc:ID", l.codigo) + "</cac:SellersItemIdentification>";
    x += "</cac:Item>";
    x += "<cac:Price>" + montoExacto("cbc:PriceAmount", l.valorUnitario, m) + "</cac:Price>";
    x += "</cac:InvoiceLine>";
  });
  return x + "</Invoice>";
}

export function xmlGuia(e: Emisor, g: Guia): string {
  let x = '<?xml version="1.0" encoding="UTF-8"?>\n';
  x += `<DespatchAdvice xmlns="urn:oasis:names:specification:ubl:schema:xsd:DespatchAdvice-2"${NS}>`;
  x += EXTENSIONES;
  x += "<cbc:UBLVersionID>2.1</cbc:UBLVersionID><cbc:CustomizationID>2.0</cbc:CustomizationID>";
  x += tag("cbc:ID", `${g.serie}-${g.correlativo}`);
  x += tag("cbc:IssueDate", g.fecha);
  x += tag("cbc:IssueTime", g.hora);
  x += '<cbc:DespatchAdviceTypeCode listAgencyName="PE:SUNAT" listName="Tipo de Documento"' +
    ' listURI="urn:pe:gob:sunat:cpe:see:gem:catalogos:catalogo01">09</cbc:DespatchAdviceTypeCode>';
  if (noVacio(g.observacion)) x += tag("cbc:Note", g.observacion);
  x += firma(e);
  x += "<cac:DespatchSupplierParty><cac:Party>" +
    `<cac:PartyIdentification><cbc:ID schemeID="6">${esc(e.ruc)}</cbc:ID></cac:PartyIdentification>` +
    "<cac:PartyLegalEntity>" + tag("cbc:RegistrationName", e.razonSocial) + "</cac:PartyLegalEntity>" +
    "</cac:Party></cac:DespatchSupplierParty>";
  x += "<cac:DeliveryCustomerParty><cac:Party>" + identificacion(g.destinatario) +
    "<cac:PartyLegalEntity>" + tag("cbc:RegistrationName", g.destinatario.nombre) + "</cac:PartyLegalEntity>" +
    "</cac:Party></cac:DeliveryCustomerParty>";
  x += "<cac:Shipment><cbc:ID>SUNAT_Envio</cbc:ID>";
  x += '<cbc:HandlingCode listAgencyName="PE:SUNAT" listName="Motivo de traslado"' +
    ` listURI="urn:pe:gob:sunat:cpe:see:gem:catalogos:catalogo20">${esc(g.motivo)}</cbc:HandlingCode>`;
  if (noVacio(g.descripcionMotivo)) x += tag("cbc:HandlingInstructions", g.descripcionMotivo);
  x += `<cbc:GrossWeightMeasure unitCode="KGM">${decimal(g.pesoKg, 3)}</cbc:GrossWeightMeasure>`;
  x += "<cac:ShipmentStage>";
  x += '<cbc:TransportModeCode listName="Modalidad de traslado" listAgencyName="PE:SUNAT"' +
    ` listURI="urn:pe:gob:sunat:cpe:see:gem:catalogos:catalogo18">${esc(g.modalidad)}</cbc:TransportModeCode>`;
  x += "<cac:TransitPeriod>" + tag("cbc:StartDate", g.fechaTraslado) + "</cac:TransitPeriod>";
  if (g.modalidad === "01" && g.transportista) {
    x += "<cac:CarrierParty>" + identificacion(g.transportista) + "<cac:PartyLegalEntity>" +
      tag("cbc:RegistrationName", g.transportista.nombre) + "</cac:PartyLegalEntity></cac:CarrierParty>";
  }
  if (g.modalidad === "02" && g.conductor) {
    const c = g.conductor;
    x += `<cac:DriverPerson><cbc:ID schemeID="${esc(c.tipoDoc)}">${esc(c.numDoc)}</cbc:ID>` +
      tag("cbc:FirstName", c.nombres) + tag("cbc:FamilyName", c.apellidos) + "<cbc:JobTitle>Principal</cbc:JobTitle>" +
      "<cac:IdentityDocumentReference>" + tag("cbc:ID", c.licencia) + "</cac:IdentityDocumentReference></cac:DriverPerson>";
  }
  x += "</cac:ShipmentStage>";
  x += "<cac:Delivery><cac:DeliveryAddress>" + ubigeo(g.llegada.ubigeo) +
    "<cac:AddressLine>" + tag("cbc:Line", g.llegada.linea) + "</cac:AddressLine></cac:DeliveryAddress>" +
    "<cac:Despatch><cac:DespatchAddress>" + ubigeo(g.partida.ubigeo) +
    "<cac:AddressLine>" + tag("cbc:Line", g.partida.linea) + "</cac:AddressLine></cac:DespatchAddress></cac:Despatch></cac:Delivery>";
  if (g.modalidad === "02" && noVacio(g.placa)) {
    x += "<cac:TransportHandlingUnit><cac:TransportEquipment>" + tag("cbc:ID", g.placa!.replaceAll("-", "")) +
      "</cac:TransportEquipment></cac:TransportHandlingUnit>";
  }
  x += "</cac:Shipment>";
  g.lineas.forEach((l, k) => {
    const n = String(k + 1);
    x += "<cac:DespatchLine>" + tag("cbc:ID", n) +
      `<cbc:DeliveredQuantity unitCode="${esc(l.unidad)}">${decimal(l.cantidad, 3)}</cbc:DeliveredQuantity>` +
      "<cac:OrderLineReference>" + tag("cbc:LineID", n) + "</cac:OrderLineReference><cac:Item>" + tag("cbc:Description", l.descripcion);
    if (noVacio(l.codigo)) x += "<cac:SellersItemIdentification>" + tag("cbc:ID", l.codigo) + "</cac:SellersItemIdentification>";
    x += "</cac:Item></cac:DespatchLine>";
  });
  return x + "</DespatchAdvice>";
}
