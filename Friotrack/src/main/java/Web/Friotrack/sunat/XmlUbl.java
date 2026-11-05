package Web.Friotrack.sunat;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.format.DateTimeFormatter;

import Web.Friotrack.sunat.DocumentoSunat.Cliente;
import Web.Friotrack.sunat.DocumentoSunat.Emisor;
import Web.Friotrack.sunat.DocumentoSunat.Guia;
import Web.Friotrack.sunat.DocumentoSunat.Linea;
import Web.Friotrack.sunat.DocumentoSunat.LineaGuia;
import Web.Friotrack.sunat.DocumentoSunat.Venta;

/**
 * XML UBL 2.1 de los comprobantes segun las especificaciones de SUNAT (version 2.0 de la personalizacion).
 * El XML sale sin firmar, con un ext:ExtensionContent vacio donde {@link FirmaDigital} inserta la firma.
 */
public final class XmlUbl {

    private XmlUbl() {
    }

    /** Id de la firma: lo usan ds:Signature y el bloque cac:Signature del comprobante. */
    public static final String ID_FIRMA = "SignSUNAT";

    private static final DateTimeFormatter HORA = DateTimeFormatter.ofPattern("HH:mm:ss");

    private static final String NS =
            " xmlns:cac=\"urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2\""
            + " xmlns:cbc=\"urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2\""
            + " xmlns:ds=\"http://www.w3.org/2000/09/xmldsig#\""
            + " xmlns:ext=\"urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2\"";

    private static final String EXTENSIONES =
            "<ext:UBLExtensions><ext:UBLExtension><ext:ExtensionContent/></ext:UBLExtension></ext:UBLExtensions>";

    // ------------------------------------------------------------------ factura y boleta
    public static String venta(Emisor e, Venta v) {
        String m = v.moneda();
        StringBuilder x = new StringBuilder(4096);
        x.append("<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n");
        x.append("<Invoice xmlns=\"urn:oasis:names:specification:ubl:schema:xsd:Invoice-2\"").append(NS).append('>');
        x.append(EXTENSIONES);
        x.append("<cbc:UBLVersionID>2.1</cbc:UBLVersionID>");
        x.append("<cbc:CustomizationID>2.0</cbc:CustomizationID>");
        x.append(tag("cbc:ID", v.numero()));
        x.append(tag("cbc:IssueDate", v.fecha().toString()));
        x.append(tag("cbc:IssueTime", HORA.format(v.hora())));
        x.append("<cbc:InvoiceTypeCode listID=\"0101\">").append(v.tipo()).append("</cbc:InvoiceTypeCode>");
        x.append("<cbc:Note languageLocaleID=\"1000\">").append(esc(MontoEnLetras.soles(v.total()))).append("</cbc:Note>");
        x.append(tag("cbc:DocumentCurrencyCode", m));
        x.append(firma(e));
        x.append("<cac:AccountingSupplierParty>").append(emisor(e)).append("</cac:AccountingSupplierParty>");
        x.append("<cac:AccountingCustomerParty><cac:Party>");
        x.append(identificacion(v.cliente()));
        x.append("<cac:PartyLegalEntity>").append(tag("cbc:RegistrationName", v.cliente().nombre()));
        if (noVacio(v.cliente().direccion())) {
            x.append("<cac:RegistrationAddress><cac:AddressLine>").append(tag("cbc:Line", v.cliente().direccion()))
                    .append("</cac:AddressLine></cac:RegistrationAddress>");
        }
        x.append("</cac:PartyLegalEntity></cac:Party></cac:AccountingCustomerParty>");
        if (DocumentoSunat.FACTURA.equals(v.tipo())) {
            x.append("<cac:PaymentTerms><cbc:ID>FormaPago</cbc:ID><cbc:PaymentMeansID>Contado</cbc:PaymentMeansID></cac:PaymentTerms>");
        }
        x.append("<cac:TaxTotal>").append(monto("cbc:TaxAmount", v.igv(), m));
        x.append("<cac:TaxSubtotal>").append(monto("cbc:TaxableAmount", v.gravada(), m))
                .append(monto("cbc:TaxAmount", v.igv(), m))
                .append("<cac:TaxCategory>").append(esquemaIgv()).append("</cac:TaxCategory></cac:TaxSubtotal>");
        x.append("</cac:TaxTotal>");
        x.append("<cac:LegalMonetaryTotal>")
                .append(monto("cbc:LineExtensionAmount", v.gravada(), m))
                .append(monto("cbc:TaxInclusiveAmount", v.total(), m))
                .append(monto("cbc:PayableAmount", v.total(), m))
                .append("</cac:LegalMonetaryTotal>");
        int i = 1;
        for (Linea l : v.lineas()) {
            x.append("<cac:InvoiceLine>");
            x.append(tag("cbc:ID", String.valueOf(i++)));
            x.append("<cbc:InvoicedQuantity unitCode=\"").append(esc(l.unidad())).append("\">")
                    .append(decimal(l.cantidad(), 3)).append("</cbc:InvoicedQuantity>");
            x.append(monto("cbc:LineExtensionAmount", l.valorVenta(), m));
            x.append("<cac:PricingReference><cac:AlternativeConditionPrice>")
                    .append(monto("cbc:PriceAmount", l.precioUnitario(), m))
                    .append("<cbc:PriceTypeCode>01</cbc:PriceTypeCode></cac:AlternativeConditionPrice></cac:PricingReference>");
            x.append("<cac:TaxTotal>").append(monto("cbc:TaxAmount", l.igv(), m));
            x.append("<cac:TaxSubtotal>").append(monto("cbc:TaxableAmount", l.valorVenta(), m))
                    .append(monto("cbc:TaxAmount", l.igv(), m))
                    .append("<cac:TaxCategory><cbc:Percent>18</cbc:Percent>")
                    .append("<cbc:TaxExemptionReasonCode>10</cbc:TaxExemptionReasonCode>")
                    .append(esquemaIgv()).append("</cac:TaxCategory></cac:TaxSubtotal></cac:TaxTotal>");
            x.append("<cac:Item>").append(tag("cbc:Description", l.descripcion()));
            if (noVacio(l.codigo())) {
                x.append("<cac:SellersItemIdentification>").append(tag("cbc:ID", l.codigo()))
                        .append("</cac:SellersItemIdentification>");
            }
            x.append("</cac:Item>");
            x.append("<cac:Price>").append(montoExacto("cbc:PriceAmount", l.valorUnitario(), m)).append("</cac:Price>");
            x.append("</cac:InvoiceLine>");
        }
        x.append("</Invoice>");
        return x.toString();
    }

    // ------------------------------------------------------------------ guia de remision remitente
    public static String guia(Emisor e, Guia g) {
        StringBuilder x = new StringBuilder(4096);
        x.append("<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n");
        x.append("<DespatchAdvice xmlns=\"urn:oasis:names:specification:ubl:schema:xsd:DespatchAdvice-2\"").append(NS).append('>');
        x.append(EXTENSIONES);
        x.append("<cbc:UBLVersionID>2.1</cbc:UBLVersionID>");
        x.append("<cbc:CustomizationID>2.0</cbc:CustomizationID>");
        x.append(tag("cbc:ID", g.numero()));
        x.append(tag("cbc:IssueDate", g.fecha().toString()));
        x.append(tag("cbc:IssueTime", HORA.format(g.hora())));
        x.append("<cbc:DespatchAdviceTypeCode listAgencyName=\"PE:SUNAT\" listName=\"Tipo de Documento\"")
                .append(" listURI=\"urn:pe:gob:sunat:cpe:see:gem:catalogos:catalogo01\">09</cbc:DespatchAdviceTypeCode>");
        if (noVacio(g.observacion())) {
            x.append(tag("cbc:Note", g.observacion()));
        }
        x.append(firma(e));
        x.append("<cac:DespatchSupplierParty><cac:Party>")
                .append("<cac:PartyIdentification><cbc:ID schemeID=\"6\">").append(esc(e.ruc())).append("</cbc:ID></cac:PartyIdentification>")
                .append("<cac:PartyLegalEntity>").append(tag("cbc:RegistrationName", e.razonSocial())).append("</cac:PartyLegalEntity>")
                .append("</cac:Party></cac:DespatchSupplierParty>");
        x.append("<cac:DeliveryCustomerParty><cac:Party>").append(identificacion(g.destinatario()))
                .append("<cac:PartyLegalEntity>").append(tag("cbc:RegistrationName", g.destinatario().nombre())).append("</cac:PartyLegalEntity>")
                .append("</cac:Party></cac:DeliveryCustomerParty>");

        x.append("<cac:Shipment><cbc:ID>SUNAT_Envio</cbc:ID>");
        x.append("<cbc:HandlingCode listAgencyName=\"PE:SUNAT\" listName=\"Motivo de traslado\"")
                .append(" listURI=\"urn:pe:gob:sunat:cpe:see:gem:catalogos:catalogo20\">").append(esc(g.motivo())).append("</cbc:HandlingCode>");
        if (noVacio(g.descripcionMotivo())) {
            x.append(tag("cbc:HandlingInstructions", g.descripcionMotivo()));
        }
        x.append("<cbc:GrossWeightMeasure unitCode=\"KGM\">").append(decimal(g.pesoKg(), 3)).append("</cbc:GrossWeightMeasure>");
        x.append("<cac:ShipmentStage>");
        x.append("<cbc:TransportModeCode listName=\"Modalidad de traslado\" listAgencyName=\"PE:SUNAT\"")
                .append(" listURI=\"urn:pe:gob:sunat:cpe:see:gem:catalogos:catalogo18\">").append(esc(g.modalidad())).append("</cbc:TransportModeCode>");
        x.append("<cac:TransitPeriod>").append(tag("cbc:StartDate", g.fechaTraslado().toString())).append("</cac:TransitPeriod>");
        if ("01".equals(g.modalidad()) && g.transportista() != null) {
            x.append("<cac:CarrierParty>").append(identificacion(g.transportista()))
                    .append("<cac:PartyLegalEntity>").append(tag("cbc:RegistrationName", g.transportista().nombre()))
                    .append("</cac:PartyLegalEntity></cac:CarrierParty>");
        }
        if ("02".equals(g.modalidad()) && g.conductor() != null) {
            var c = g.conductor();
            x.append("<cac:DriverPerson><cbc:ID schemeID=\"").append(esc(c.tipoDoc())).append("\">").append(esc(c.numDoc())).append("</cbc:ID>")
                    .append(tag("cbc:FirstName", c.nombres())).append(tag("cbc:FamilyName", c.apellidos()))
                    .append("<cbc:JobTitle>Principal</cbc:JobTitle>")
                    .append("<cac:IdentityDocumentReference>").append(tag("cbc:ID", c.licencia())).append("</cac:IdentityDocumentReference>")
                    .append("</cac:DriverPerson>");
        }
        x.append("</cac:ShipmentStage>");
        x.append("<cac:Delivery><cac:DeliveryAddress>").append(ubigeo(g.llegada().ubigeo()))
                .append("<cac:AddressLine>").append(tag("cbc:Line", g.llegada().linea())).append("</cac:AddressLine></cac:DeliveryAddress>")
                .append("<cac:Despatch><cac:DespatchAddress>").append(ubigeo(g.partida().ubigeo()))
                .append("<cac:AddressLine>").append(tag("cbc:Line", g.partida().linea())).append("</cac:AddressLine></cac:DespatchAddress></cac:Despatch>")
                .append("</cac:Delivery>");
        if ("02".equals(g.modalidad()) && noVacio(g.placa())) {
            x.append("<cac:TransportHandlingUnit><cac:TransportEquipment>").append(tag("cbc:ID", g.placa().replace("-", "")))
                    .append("</cac:TransportEquipment></cac:TransportHandlingUnit>");
        }
        x.append("</cac:Shipment>");
        int i = 1;
        for (LineaGuia l : g.lineas()) {
            x.append("<cac:DespatchLine>").append(tag("cbc:ID", String.valueOf(i)))
                    .append("<cbc:DeliveredQuantity unitCode=\"").append(esc(l.unidad())).append("\">").append(decimal(l.cantidad(), 3)).append("</cbc:DeliveredQuantity>")
                    .append("<cac:OrderLineReference>").append(tag("cbc:LineID", String.valueOf(i))).append("</cac:OrderLineReference>")
                    .append("<cac:Item>").append(tag("cbc:Description", l.descripcion()));
            if (noVacio(l.codigo())) {
                x.append("<cac:SellersItemIdentification>").append(tag("cbc:ID", l.codigo())).append("</cac:SellersItemIdentification>");
            }
            x.append("</cac:Item></cac:DespatchLine>");
            i++;
        }
        x.append("</DespatchAdvice>");
        return x.toString();
    }

    // ------------------------------------------------------------------ piezas comunes
    private static String firma(Emisor e) {
        return "<cac:Signature>" + tag("cbc:ID", ID_FIRMA)
                + "<cac:SignatoryParty><cac:PartyIdentification>" + tag("cbc:ID", e.ruc()) + "</cac:PartyIdentification>"
                + "<cac:PartyName>" + tag("cbc:Name", e.razonSocial()) + "</cac:PartyName></cac:SignatoryParty>"
                + "<cac:DigitalSignatureAttachment><cac:ExternalReference>" + tag("cbc:URI", "#" + ID_FIRMA)
                + "</cac:ExternalReference></cac:DigitalSignatureAttachment></cac:Signature>";
    }

    private static String emisor(Emisor e) {
        StringBuilder x = new StringBuilder("<cac:Party>");
        x.append("<cac:PartyIdentification><cbc:ID schemeID=\"6\">").append(esc(e.ruc())).append("</cbc:ID></cac:PartyIdentification>");
        if (noVacio(e.nombreComercial())) {
            x.append("<cac:PartyName>").append(tag("cbc:Name", e.nombreComercial())).append("</cac:PartyName>");
        }
        x.append("<cac:PartyLegalEntity>").append(tag("cbc:RegistrationName", e.razonSocial()));
        x.append("<cac:RegistrationAddress>")
                .append(tag("cbc:ID", e.ubigeo()))
                .append("<cbc:AddressTypeCode>0000</cbc:AddressTypeCode>")
                .append(tag("cbc:CityName", e.provincia()))
                .append(tag("cbc:CountrySubentity", e.departamento()))
                .append(tag("cbc:District", e.distrito()))
                .append("<cac:AddressLine>").append(tag("cbc:Line", e.direccion())).append("</cac:AddressLine>")
                .append("<cac:Country><cbc:IdentificationCode>PE</cbc:IdentificationCode></cac:Country>")
                .append("</cac:RegistrationAddress>");
        x.append("</cac:PartyLegalEntity></cac:Party>");
        return x.toString();
    }

    private static String identificacion(Cliente c) {
        return "<cac:PartyIdentification><cbc:ID schemeID=\"" + esc(c.tipoDoc()) + "\">" + esc(c.numDoc())
                + "</cbc:ID></cac:PartyIdentification>";
    }

    private static String esquemaIgv() {
        return "<cac:TaxScheme><cbc:ID>1000</cbc:ID><cbc:Name>IGV</cbc:Name><cbc:TaxTypeCode>VAT</cbc:TaxTypeCode></cac:TaxScheme>";
    }

    private static String ubigeo(String u) {
        return "<cbc:ID schemeAgencyName=\"PE:INEI\" schemeName=\"Ubigeos\">" + esc(u) + "</cbc:ID>";
    }

    private static String monto(String nombre, BigDecimal valor, String moneda) {
        return "<" + nombre + " currencyID=\"" + moneda + "\">" + decimal(valor, 2) + "</" + nombre + ">";
    }

    /** Montos unitarios: hasta 6 decimales, sin ceros sobrantes. */
    private static String montoExacto(String nombre, BigDecimal valor, String moneda) {
        BigDecimal v = valor.setScale(6, RoundingMode.HALF_UP).stripTrailingZeros();
        if (v.scale() < 2) {
            v = v.setScale(2);
        }
        return "<" + nombre + " currencyID=\"" + moneda + "\">" + v.toPlainString() + "</" + nombre + ">";
    }

    private static String decimal(BigDecimal v, int escala) {
        return v.setScale(escala, RoundingMode.HALF_UP).toPlainString();
    }

    private static String tag(String nombre, String valor) {
        return "<" + nombre + ">" + esc(valor) + "</" + nombre + ">";
    }

    static boolean noVacio(String s) {
        return s != null && !s.isBlank();
    }

    static String esc(String s) {
        if (s == null) {
            return "";
        }
        StringBuilder sb = new StringBuilder(s.length());
        for (char ch : s.toCharArray()) {
            switch (ch) {
                case '&' -> sb.append("&amp;");
                case '<' -> sb.append("&lt;");
                case '>' -> sb.append("&gt;");
                case '"' -> sb.append("&quot;");
                case '\'' -> sb.append("&apos;");
                default -> {
                    if (ch >= 0x20 || ch == '\n' || ch == '\t') {
                        sb.append(ch);
                    }
                }
            }
        }
        return sb.toString().trim();
    }
}
