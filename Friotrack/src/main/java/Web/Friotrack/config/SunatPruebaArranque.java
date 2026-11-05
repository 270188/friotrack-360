package Web.Friotrack.config;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.util.List;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import Web.Friotrack.service.ComprobanteService;
import Web.Friotrack.sunat.ClienteSunat;
import Web.Friotrack.sunat.DocumentoSunat;
import Web.Friotrack.sunat.FirmaDigital;
import Web.Friotrack.sunat.XmlUbl;

/**
 * Diagnostico opcional (SUNAT_PRUEBA_AL_INICIAR=true): al arrancar envia a SUNAT beta una factura y una boleta
 * de prueba con series propias (FT99 / BT99) y escribe la respuesta en el log. No guarda nada en la base.
 */
@Component
@ConditionalOnProperty(prefix = "app.sunat", name = "prueba-al-iniciar", havingValue = "true")
public class SunatPruebaArranque implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(SunatPruebaArranque.class);

    private final SunatProperties props;
    private final DocumentoSunat.Emisor emisor;
    private final FirmaDigital firma;
    private final ClienteSunat cliente;

    public SunatPruebaArranque(SunatProperties props, DocumentoSunat.Emisor emisor, FirmaDigital firma, ClienteSunat cliente) {
        this.props = props;
        this.emisor = emisor;
        this.firma = firma;
        this.cliente = cliente;
    }

    @Override
    public void run(ApplicationArguments args) {
        if (!props.esPrueba()) {
            log.warn("SUNAT_PRUEBA_AL_INICIAR se ignora fuera del entorno de pruebas");
            return;
        }
        Thread hilo = new Thread(this::probar, "sunat-prueba");
        hilo.setDaemon(true);
        hilo.start();
    }

    private void probar() {
        LocalDateTime ahora = LocalDateTime.now(ComprobanteService.ZONA_PERU).withNano(0);
        long numero = (System.currentTimeMillis() / 1000) % 99_999_999L;
        var linea = DocumentoSunat.lineaGravada("PRUEBA", "PRODUCTO DE PRUEBA", "NIU", new BigDecimal("2"), new BigDecimal("11.80"));
        enviar(new DocumentoSunat.Venta("01", "FT99", numero, ahora.toLocalDate(), ahora.toLocalTime(), "PEN",
                new DocumentoSunat.Cliente("6", "20100070970", "CLIENTE DE PRUEBA S.A.", "LIMA"),
                List.of(linea), linea.valorVenta(), linea.igv(), linea.total()));
        enviar(new DocumentoSunat.Venta("03", "BT99", numero, ahora.toLocalDate(), ahora.toLocalTime(), "PEN",
                new DocumentoSunat.Cliente("1", "12345678", "CLIENTE DE PRUEBA", null),
                List.of(linea), linea.valorVenta(), linea.igv(), linea.total()));
    }

    private void enviar(DocumentoSunat.Venta v) {
        try {
            FirmaDigital.Firmado f = firma.firmar(XmlUbl.venta(emisor, v));
            String nombre = emisor.ruc() + "-" + v.tipo() + "-" + v.numero();
            ClienteSunat.Respuesta r = cliente.enviar(emisor, nombre, f.xml());
            log.warn("=== PRUEBA SUNAT {} {} -> {} [{}] {} {}", v.tipo(), v.numero(), r.estado(), r.codigo(),
                    r.descripcion(), r.observaciones());
            if (r.estado() == ClienteSunat.Estado.RECHAZADO || r.estado() == ClienteSunat.Estado.ERROR) {
                log.warn("=== XML enviado ({}): {}", nombre, new String(f.xml(), StandardCharsets.UTF_8));
            }
        } catch (Exception e) {
            log.error("=== PRUEBA SUNAT {} fallo: {}", v.numero(), e.toString(), e);
        }
    }
}
