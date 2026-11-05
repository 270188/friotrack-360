package Web.Friotrack.sunat;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;

import org.junit.jupiter.api.Test;

import Web.Friotrack.sunat.DocumentoSunat.Cliente;
import Web.Friotrack.sunat.DocumentoSunat.Emisor;
import Web.Friotrack.sunat.DocumentoSunat.Venta;

/** Prueba el nucleo de facturacion electronica sin base de datos ni conexion a SUNAT. */
class SunatTest {

    private static final Emisor EMISOR = new Emisor("20000000001", "POLAR PIURA S.A.C.", "POLAR PIURA SAC", "200101",
            "PIURA", "PIURA", "PIURA", "PIURA - PERU", "MODDATOS", "moddatos");

    private static FirmaDigital firma() {
        return new FirmaDigital(SunatTest.class.getResourceAsStream("/sunat/certificado-prueba.p12"), "prueba".toCharArray());
    }

    private static Venta factura() {
        var l1 = DocumentoSunat.lineaGravada("P001", "Yogurt natural 1L", "NIU", new BigDecimal("3"), new BigDecimal("5.90"));
        var l2 = DocumentoSunat.lineaGravada("P002", "Queso fresco", "KGM", new BigDecimal("2.5"), new BigDecimal("18.50"));
        BigDecimal gravada = l1.valorVenta().add(l2.valorVenta());
        BigDecimal igv = l1.igv().add(l2.igv());
        return new Venta("01", "F001", 1, LocalDate.of(2026, 11, 4), LocalTime.of(19, 30), "PEN",
                new Cliente("6", "20100070970", "CLIENTE S.A.", null), List.of(l1, l2), gravada, igv, gravada.add(igv));
    }

    @Test
    void calculaImportesDesdeElPrecioConIgv() {
        Venta v = factura();
        assertEquals(new BigDecimal("54.19"), v.gravada());
        assertEquals(new BigDecimal("9.76"), v.igv());
        assertEquals(new BigDecimal("63.95"), v.total());
    }

    @Test
    void escribeElMontoEnLetras() {
        assertEquals("SON SESENTA Y TRES CON 95/100 SOLES", MontoEnLetras.soles(new BigDecimal("63.95")));
        assertEquals("SON UN MILLON QUINIENTOS VEINTIUN MIL VEINTIUNO CON 10/100 SOLES",
                MontoEnLetras.soles(new BigDecimal("1521021.10")));
        assertEquals("SON CIEN CON 00/100 SOLES", MontoEnLetras.soles(new BigDecimal("100")));
    }

    @Test
    void firmaYDetectaAlteraciones() {
        FirmaDigital.Firmado f = firma().firmar(XmlUbl.venta(EMISOR, factura()));
        assertTrue(FirmaDigital.verificar(f.xml()));
        assertTrue(f.texto().contains("<ds:Signature Id=\"SignSUNAT\""));
        assertFalse(f.texto().contains("&#13;"));
        byte[] alterado = f.texto().replace("63.95", "63.96").getBytes(StandardCharsets.UTF_8);
        assertFalse(FirmaDigital.verificar(alterado));
    }

    @Test
    void leeLaConstanciaDeRecepcion() throws Exception {
        String cdr = "<ar:ApplicationResponse xmlns:ar=\"urn:oasis:names:specification:ubl:schema:xsd:ApplicationResponse-2\""
                + " xmlns:cac=\"urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2\""
                + " xmlns:cbc=\"urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2\">"
                + "<cac:DocumentResponse><cac:Response><cbc:ResponseCode>0</cbc:ResponseCode>"
                + "<cbc:Description>La Factura numero F001-1, ha sido aceptada</cbc:Description></cac:Response>"
                + "</cac:DocumentResponse></ar:ApplicationResponse>";
        byte[] zip = ClienteSunat.zip("R-20000000001-01-F001-1.xml", cdr.getBytes(StandardCharsets.UTF_8));
        assertArrayEquals(cdr.getBytes(StandardCharsets.UTF_8), ClienteSunat.descomprimirXml(zip));
        ClienteSunat.Respuesta r = ClienteSunat.leerCdr(zip);
        assertEquals(ClienteSunat.Estado.ACEPTADO, r.estado());
        assertEquals("0", r.codigo());
    }

    @Test
    void clasificaLosErroresDeSunat() {
        String fault = "<soap-env:Envelope xmlns:soap-env=\"http://schemas.xmlsoap.org/soap/envelope/\"><soap-env:Body>"
                + "<soap-env:Fault><faultcode>soap-env:Client.%s</faultcode><faultstring>x</faultstring></soap-env:Fault>"
                + "</soap-env:Body></soap-env:Envelope>";
        assertEquals(ClienteSunat.Estado.ERROR,
                ClienteSunat.leerRespuestaSoap(500, fault.formatted("0102").getBytes(StandardCharsets.UTF_8)).estado());
        assertEquals(ClienteSunat.Estado.RECHAZADO,
                ClienteSunat.leerRespuestaSoap(500, fault.formatted("3244").getBytes(StandardCharsets.UTF_8)).estado());
    }
}
