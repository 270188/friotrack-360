package Web.Friotrack.sunat;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Base64;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;
import java.util.zip.ZipOutputStream;

import org.w3c.dom.Document;
import org.w3c.dom.Element;
import org.w3c.dom.Node;
import org.w3c.dom.NodeList;

import Web.Friotrack.sunat.DocumentoSunat.Emisor;

/**
 * Envio de facturas y boletas al servicio SOAP billService de SUNAT (metodo sendBill) y lectura de la CDR.
 * Beta: https://e-beta.sunat.gob.pe/ol-ti-itcpfegem-beta/billService con usuario RUC + MODDATOS.
 */
public class ClienteSunat {

    public static final String URL_BETA = "https://e-beta.sunat.gob.pe/ol-ti-itcpfegem-beta/billService";

    public enum Estado {
        /** SUNAT acepto el comprobante (codigo 0). */
        ACEPTADO,
        /** Aceptado con observaciones (codigos 4000 en adelante). */
        OBSERVADO,
        /** SUNAT lo rechazo (codigos 2000 a 3999): no tiene validez y no se puede reenviar con el mismo numero. */
        RECHAZADO,
        /** No se pudo procesar (conexion, credenciales, excepciones 0100-1999): se puede reenviar. */
        ERROR
    }

    public record Respuesta(Estado estado, String codigo, String descripcion, List<String> observaciones,
                            byte[] cdrZip) {
    }

    private static final String NS_CBC = "urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2";
    private static final Pattern CODIGO = Pattern.compile("(\\d{1,4})\\s*$");

    private final String url;
    private final HttpClient http;

    public ClienteSunat(String url) {
        this.url = url == null || url.isBlank() ? URL_BETA : url.trim();
        this.http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(15)).build();
    }

    public String url() {
        return url;
    }

    /** @param nombre nombre del archivo sin extension: RUC-TIPO-SERIE-NUMERO, por ejemplo 20000000001-01-F001-1 */
    public Respuesta enviar(Emisor emisor, String nombre, byte[] xmlFirmado) {
        String sobre = sobreSendBill(emisor.ruc() + emisor.usuarioSol(), emisor.claveSol(), nombre + ".zip",
                Base64.getEncoder().encodeToString(zip(nombre + ".xml", xmlFirmado)));
        HttpRequest req = HttpRequest.newBuilder(URI.create(url))
                .timeout(Duration.ofSeconds(45))
                .header("Content-Type", "text/xml; charset=utf-8")
                .header("SOAPAction", "urn:sendBill")
                .POST(HttpRequest.BodyPublishers.ofString(sobre, StandardCharsets.UTF_8))
                .build();
        HttpResponse<byte[]> resp;
        try {
            resp = http.send(req, HttpResponse.BodyHandlers.ofByteArray());
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return new Respuesta(Estado.ERROR, null, "Se interrumpio el envio a SUNAT", List.of(), null);
        } catch (Exception e) {
            return new Respuesta(Estado.ERROR, null,
                    "No se pudo conectar con SUNAT (" + e.getClass().getSimpleName() + "): " + e.getMessage(), List.of(), null);
        }
        return leerRespuestaSoap(resp.statusCode(), resp.body());
    }

    static String sobreSendBill(String usuario, String clave, String archivoZip, String contenidoBase64) {
        return "<soapenv:Envelope xmlns:soapenv=\"http://schemas.xmlsoap.org/soap/envelope/\""
                + " xmlns:ser=\"http://service.sunat.gob.pe\""
                + " xmlns:wsse=\"http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd\">"
                + "<soapenv:Header><wsse:Security><wsse:UsernameToken>"
                + "<wsse:Username>" + XmlUbl.esc(usuario) + "</wsse:Username>"
                + "<wsse:Password>" + XmlUbl.esc(clave) + "</wsse:Password>"
                + "</wsse:UsernameToken></wsse:Security></soapenv:Header>"
                + "<soapenv:Body><ser:sendBill>"
                + "<fileName>" + XmlUbl.esc(archivoZip) + "</fileName>"
                + "<contentFile>" + contenidoBase64 + "</contentFile>"
                + "</ser:sendBill></soapenv:Body></soapenv:Envelope>";
    }

    static Respuesta leerRespuestaSoap(int status, byte[] cuerpo) {
        Document doc;
        try {
            doc = FirmaDigital.parsear(cuerpo);
        } catch (Exception e) {
            String texto = new String(cuerpo, StandardCharsets.UTF_8);
            return new Respuesta(Estado.ERROR, String.valueOf(status),
                    "Respuesta no valida de SUNAT (HTTP " + status + "): " + recortar(texto, 300), List.of(), null);
        }
        Element fault = primero(doc, "Fault");
        if (fault != null) {
            String faultcode = texto(fault, "faultcode");
            String faultstring = texto(fault, "faultstring");
            String codigo = null;
            Matcher m = CODIGO.matcher(faultcode == null ? "" : faultcode);
            if (m.find()) {
                codigo = m.group(1);
            } else {
                Matcher m2 = CODIGO.matcher(faultstring == null ? "" : faultstring);
                if (m2.find()) {
                    codigo = m2.group(1);
                }
            }
            int n = codigo == null ? -1 : Integer.parseInt(codigo);
            Estado estado = n >= 2000 && n < 4000 ? Estado.RECHAZADO : Estado.ERROR;
            String desc = faultstring == null || faultstring.isBlank() ? faultcode : faultstring;
            return new Respuesta(estado, codigo, desc, List.of(), null);
        }
        Element app = primero(doc, "applicationResponse");
        if (app == null) {
            return new Respuesta(Estado.ERROR, String.valueOf(status),
                    "SUNAT no devolvio la constancia de recepcion (HTTP " + status + ")", List.of(), null);
        }
        byte[] cdr = Base64.getMimeDecoder().decode(app.getTextContent().trim());
        return leerCdr(cdr);
    }

    /** Lee la Constancia de Recepcion (CDR): un ZIP con el XML ApplicationResponse. */
    public static Respuesta leerCdr(byte[] cdrZip) {
        try {
            byte[] xml = descomprimirXml(cdrZip);
            Document doc = FirmaDigital.parsear(xml);
            Element respuesta = (Element) doc.getElementsByTagNameNS(
                    "urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2", "Response").item(0);
            String codigo = respuesta == null ? null : textoNs(respuesta, "ResponseCode");
            String desc = respuesta == null ? null : textoNs(respuesta, "Description");
            List<String> notas = new ArrayList<>();
            NodeList hijos = doc.getDocumentElement().getChildNodes();
            for (int i = 0; i < hijos.getLength(); i++) {
                Node h = hijos.item(i);
                if (h instanceof Element el && NS_CBC.equals(el.getNamespaceURI()) && "Note".equals(el.getLocalName())) {
                    notas.add(el.getTextContent().trim());
                }
            }
            int n = codigo == null ? -1 : Integer.parseInt(codigo.trim());
            Estado estado;
            if (n == 0) {
                estado = notas.isEmpty() ? Estado.ACEPTADO : Estado.OBSERVADO;
            } else if (n >= 4000) {
                estado = Estado.OBSERVADO;
            } else if (n >= 2000) {
                estado = Estado.RECHAZADO;
            } else {
                estado = Estado.ERROR;
            }
            return new Respuesta(estado, codigo, desc, List.copyOf(notas), cdrZip);
        } catch (Exception e) {
            return new Respuesta(Estado.ERROR, null, "No se pudo leer la CDR: " + e.getMessage(), List.of(), cdrZip);
        }
    }

    public static byte[] zip(String nombreEntrada, byte[] contenido) {
        try {
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            try (ZipOutputStream z = new ZipOutputStream(out)) {
                z.putNextEntry(new ZipEntry(nombreEntrada));
                z.write(contenido);
                z.closeEntry();
            }
            return out.toByteArray();
        } catch (Exception e) {
            throw new IllegalStateException("No se pudo comprimir el XML", e);
        }
    }

    public static byte[] descomprimirXml(byte[] zip) throws Exception {
        try (ZipInputStream z = new ZipInputStream(new ByteArrayInputStream(zip))) {
            ZipEntry e;
            while ((e = z.getNextEntry()) != null) {
                if (!e.isDirectory() && e.getName().toLowerCase().endsWith(".xml")) {
                    return z.readAllBytes();
                }
            }
        }
        throw new IllegalArgumentException("El ZIP no contiene un XML");
    }

    private static Element primero(Document doc, String nombreLocal) {
        NodeList l = doc.getElementsByTagNameNS("*", nombreLocal);
        return l.getLength() == 0 ? null : (Element) l.item(0);
    }

    private static String texto(Element padre, String nombreLocal) {
        NodeList l = padre.getElementsByTagNameNS("*", nombreLocal);
        if (l.getLength() == 0) {
            l = padre.getElementsByTagName(nombreLocal);
        }
        return l.getLength() == 0 ? null : l.item(0).getTextContent().trim();
    }

    private static String textoNs(Element padre, String nombreLocal) {
        NodeList l = padre.getElementsByTagNameNS(NS_CBC, nombreLocal);
        return l.getLength() == 0 ? null : l.item(0).getTextContent().trim();
    }

    private static String recortar(String s, int max) {
        return s.length() <= max ? s : s.substring(0, max) + "...";
    }
}
