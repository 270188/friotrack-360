package Web.Friotrack.sunat;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.security.KeyStore;
import java.security.PrivateKey;
import java.security.cert.X509Certificate;
import java.util.Collections;
import java.util.List;

import javax.xml.XMLConstants;
import javax.xml.crypto.dsig.CanonicalizationMethod;
import javax.xml.crypto.dsig.DigestMethod;
import javax.xml.crypto.dsig.Reference;
import javax.xml.crypto.dsig.SignatureMethod;
import javax.xml.crypto.dsig.SignedInfo;
import javax.xml.crypto.dsig.Transform;
import javax.xml.crypto.dsig.XMLSignature;
import javax.xml.crypto.dsig.XMLSignatureFactory;
import javax.xml.crypto.dsig.dom.DOMSignContext;
import javax.xml.crypto.dsig.dom.DOMValidateContext;
import javax.xml.crypto.dsig.keyinfo.KeyInfo;
import javax.xml.crypto.dsig.keyinfo.KeyInfoFactory;
import javax.xml.crypto.dsig.keyinfo.X509Data;
import javax.xml.crypto.dsig.spec.C14NMethodParameterSpec;
import javax.xml.crypto.dsig.spec.TransformParameterSpec;
import javax.xml.parsers.DocumentBuilderFactory;
import javax.xml.transform.OutputKeys;
import javax.xml.transform.TransformerFactory;
import javax.xml.transform.dom.DOMSource;
import javax.xml.transform.stream.StreamResult;

import org.w3c.dom.Document;
import org.w3c.dom.Element;
import org.w3c.dom.Node;
import org.xml.sax.InputSource;

/**
 * Firma XMLDSig "enveloped" dentro de ext:UBLExtensions, como pide SUNAT.
 * En el entorno beta no hace falta que el certificado este registrado en SUNAT.
 */
public final class FirmaDigital {

    static final String NS_EXT = "urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2";

    static {
        // Base64 de la firma y del certificado en una sola linea, sin "&#13;" ni saltos que algunos validadores rechazan.
        System.setProperty("com.sun.org.apache.xml.internal.security.ignoreLineBreaks", "true");
    }

    private final PrivateKey clave;
    private final X509Certificate certificado;

    public record Firmado(byte[] xml, String hash) {
        public String texto() {
            return new String(xml, StandardCharsets.UTF_8);
        }
    }

    public FirmaDigital(InputStream pkcs12, char[] password) {
        try (pkcs12) {
            KeyStore ks = KeyStore.getInstance("PKCS12");
            ks.load(pkcs12, password);
            String alias = Collections.list(ks.aliases()).stream()
                    .filter(a -> {
                        try {
                            return ks.isKeyEntry(a);
                        } catch (Exception e) {
                            return false;
                        }
                    })
                    .findFirst()
                    .orElseThrow(() -> new IllegalStateException("El certificado no contiene una clave privada"));
            this.clave = (PrivateKey) ks.getKey(alias, password);
            this.certificado = (X509Certificate) ks.getCertificate(alias);
        } catch (IllegalStateException e) {
            throw e;
        } catch (Exception e) {
            throw new IllegalStateException("No se pudo leer el certificado digital: " + e.getMessage(), e);
        }
    }

    public X509Certificate certificado() {
        return certificado;
    }

    public Firmado firmar(String xml) {
        try {
            Document doc = parsear(xml.getBytes(StandardCharsets.UTF_8));
            Node destino = doc.getElementsByTagNameNS(NS_EXT, "ExtensionContent").item(0);
            if (destino == null) {
                throw new IllegalArgumentException("El XML no tiene ext:ExtensionContent para la firma");
            }
            XMLSignatureFactory fac = XMLSignatureFactory.getInstance("DOM");
            Reference ref = fac.newReference("",
                    fac.newDigestMethod(DigestMethod.SHA256, null),
                    List.of(fac.newTransform(Transform.ENVELOPED, (TransformParameterSpec) null)),
                    null, null);
            SignedInfo si = fac.newSignedInfo(
                    fac.newCanonicalizationMethod(CanonicalizationMethod.INCLUSIVE, (C14NMethodParameterSpec) null),
                    fac.newSignatureMethod(SignatureMethod.RSA_SHA256, null),
                    List.of(ref));
            KeyInfoFactory kif = fac.getKeyInfoFactory();
            X509Data datos = kif.newX509Data(List.of(certificado));
            KeyInfo ki = kif.newKeyInfo(List.of(datos));

            DOMSignContext ctx = new DOMSignContext(clave, destino);
            ctx.setDefaultNamespacePrefix("ds");
            fac.newXMLSignature(si, ki, null, XmlUbl.ID_FIRMA, null).sign(ctx);

            String hash = doc.getElementsByTagNameNS(XMLSignature.XMLNS, "DigestValue").item(0).getTextContent();
            return new Firmado(serializar(doc), hash);
        } catch (IllegalArgumentException e) {
            throw e;
        } catch (Exception e) {
            throw new IllegalStateException("No se pudo firmar el XML: " + e.getMessage(), e);
        }
    }

    /** Valida la firma con el certificado incluido en el propio XML (se usa en las pruebas). */
    public static boolean verificar(byte[] xml) {
        try {
            Document doc = parsear(xml);
            Element firma = (Element) doc.getElementsByTagNameNS(XMLSignature.XMLNS, "Signature").item(0);
            Element certNodo = (Element) firma.getElementsByTagNameNS(XMLSignature.XMLNS, "X509Certificate").item(0);
            byte[] der = java.util.Base64.getMimeDecoder().decode(certNodo.getTextContent());
            X509Certificate cert = (X509Certificate) java.security.cert.CertificateFactory.getInstance("X.509")
                    .generateCertificate(new ByteArrayInputStream(der));
            DOMValidateContext ctx = new DOMValidateContext(cert.getPublicKey(), firma);
            return XMLSignatureFactory.getInstance("DOM").unmarshalXMLSignature(ctx).validate(ctx);
        } catch (Exception e) {
            return false;
        }
    }

    static Document parsear(byte[] xml) throws Exception {
        DocumentBuilderFactory dbf = DocumentBuilderFactory.newInstance();
        dbf.setNamespaceAware(true);
        dbf.setFeature("http://apache.org/xml/features/disallow-doctype-decl", true);
        dbf.setFeature(XMLConstants.FEATURE_SECURE_PROCESSING, true);
        dbf.setXIncludeAware(false);
        dbf.setExpandEntityReferences(false);
        var builder = dbf.newDocumentBuilder();
        builder.setErrorHandler(new org.xml.sax.helpers.DefaultHandler() {
            @Override
            public void error(org.xml.sax.SAXParseException e) throws org.xml.sax.SAXException {
                throw e;
            }

            @Override
            public void fatalError(org.xml.sax.SAXParseException e) throws org.xml.sax.SAXException {
                throw e;
            }
        });
        return builder.parse(new InputSource(new ByteArrayInputStream(xml)));
    }

    static Document parsear(String xml) throws Exception {
        return parsear(xml.getBytes(StandardCharsets.UTF_8));
    }

    private static byte[] serializar(Document doc) throws Exception {
        TransformerFactory tf = TransformerFactory.newInstance();
        tf.setAttribute(XMLConstants.ACCESS_EXTERNAL_DTD, "");
        tf.setAttribute(XMLConstants.ACCESS_EXTERNAL_STYLESHEET, "");
        var t = tf.newTransformer();
        t.setOutputProperty(OutputKeys.ENCODING, "UTF-8");
        t.setOutputProperty(OutputKeys.INDENT, "no");
        doc.setXmlStandalone(true);
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        t.transform(new DOMSource(doc), new StreamResult(out));
        return out.toByteArray();
    }
}
