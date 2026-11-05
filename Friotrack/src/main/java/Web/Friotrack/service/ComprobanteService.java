package Web.Friotrack.service;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Base64;
import java.util.List;
import java.util.Map;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import Web.Friotrack.config.SunatProperties;
import Web.Friotrack.dto.ComprobanteDto;
import Web.Friotrack.entity.Comprobante;
import Web.Friotrack.entity.ComprobanteItem;
import Web.Friotrack.entity.Despacho;
import Web.Friotrack.entity.Evento;
import Web.Friotrack.entity.Usuario;
import Web.Friotrack.exception.BusinessRuleException;
import Web.Friotrack.exception.NotFoundException;
import Web.Friotrack.repository.ComprobanteRepository;
import Web.Friotrack.repository.DespachoRepository;
import Web.Friotrack.security.UsuarioActualProvider;
import Web.Friotrack.sunat.ClienteSunat;
import Web.Friotrack.sunat.DocumentoSunat;
import Web.Friotrack.sunat.FirmaDigital;
import Web.Friotrack.sunat.XmlUbl;

/**
 * Emision de comprobantes electronicos: arma el XML UBL 2.1, lo firma, lo guarda con su numero
 * correlativo y (facturas y boletas) lo envia a SUNAT, guardando la CDR de respuesta.
 */
@Service
@Transactional
public class ComprobanteService {

    public static final ZoneId ZONA_PERU = ZoneId.of("America/Lima");

    private static final Map<String, String> MOTIVOS = Map.of(
            "01", "VENTA",
            "02", "COMPRA",
            "04", "TRASLADO ENTRE ESTABLECIMIENTOS DE LA MISMA EMPRESA",
            "13", "OTROS");

    private final ComprobanteRepository comprobanteRepository;
    private final DespachoRepository despachoRepository;
    private final EventoService eventoService;
    private final UsuarioActualProvider usuarioActual;
    private final SunatProperties sunat;
    private final DocumentoSunat.Emisor emisor;
    private final FirmaDigital firma;
    private final ClienteSunat clienteSunat;

    public ComprobanteService(ComprobanteRepository comprobanteRepository,
                              DespachoRepository despachoRepository,
                              EventoService eventoService,
                              UsuarioActualProvider usuarioActual,
                              SunatProperties sunat,
                              DocumentoSunat.Emisor emisor,
                              FirmaDigital firma,
                              ClienteSunat clienteSunat) {
        this.comprobanteRepository = comprobanteRepository;
        this.despachoRepository = despachoRepository;
        this.eventoService = eventoService;
        this.usuarioActual = usuarioActual;
        this.sunat = sunat;
        this.emisor = emisor;
        this.firma = firma;
        this.clienteSunat = clienteSunat;
    }

    // ------------------------------------------------------------------ consultas
    @Transactional(readOnly = true)
    public ComprobanteDto.Emisor emisor() {
        return ComprobanteDto.Emisor.of(sunat);
    }

    @Transactional(readOnly = true)
    public Page<ComprobanteDto.Resumen> buscar(String tipo, String q, Pageable pageable) {
        String t = tipo == null || tipo.isBlank() ? null : tipo.trim();
        String texto = q == null || q.isBlank() ? null : q.trim();
        return comprobanteRepository.buscar(t, texto, pageable).map(ComprobanteDto.Resumen::of);
    }

    @Transactional(readOnly = true)
    public List<ComprobanteDto.Resumen> porDespacho(Long idDespacho) {
        return comprobanteRepository.findByDespachoIdDespachoOrderByFechaEmisionDesc(idDespacho).stream()
                .map(ComprobanteDto.Resumen::of).toList();
    }

    @Transactional(readOnly = true)
    public ComprobanteDto.Detalle obtener(Long id) {
        return detalle(entidad(id));
    }

    public record Archivo(String nombre, String tipoContenido, byte[] contenido) {
    }

    @Transactional(readOnly = true)
    public Archivo xml(Long id) {
        Comprobante c = entidad(id);
        if (c.getXmlFirmado() == null) {
            throw new NotFoundException("El comprobante " + c.numero() + " no tiene XML");
        }
        return new Archivo(nombreArchivo(c) + ".xml", "application/xml", c.getXmlFirmado().getBytes(StandardCharsets.UTF_8));
    }

    @Transactional(readOnly = true)
    public Archivo cdr(Long id) {
        Comprobante c = entidad(id);
        if (c.getCdrBase64() == null) {
            throw new NotFoundException("El comprobante " + c.numero() + " no tiene constancia de recepción (CDR)");
        }
        return new Archivo("R-" + nombreArchivo(c) + ".zip", "application/zip", Base64.getDecoder().decode(c.getCdrBase64()));
    }

    // ------------------------------------------------------------------ factura y boleta
    public ComprobanteDto.Detalle emitirVenta(ComprobanteDto.VentaRequest r) {
        boolean factura = DocumentoSunat.FACTURA.equals(r.tipo());
        if (factura && !("6".equals(r.clienteTipoDoc()) && r.clienteNumDoc().length() == 11)) {
            throw new BusinessRuleException("La factura requiere el RUC (11 dígitos) del cliente");
        }
        validarDocumento(r.clienteTipoDoc(), r.clienteNumDoc());
        for (ComprobanteDto.ItemRequest i : r.items()) {
            if (i.precioUnitario() == null) {
                throw new BusinessRuleException("Indica el precio de \"" + i.descripcion() + "\"");
            }
        }

        Comprobante c = nuevo(r.tipo(), factura ? sunat.serieFactura() : sunat.serieBoleta());
        c.setClienteTipoDoc(r.clienteTipoDoc());
        c.setClienteNumDoc(r.clienteNumDoc());
        c.setClienteNombre(r.clienteNombre().trim());
        c.setClienteDireccion(vacioANull(r.clienteDireccion()));
        c.setObservacion(vacioANull(r.observacion()));
        c.setDespacho(r.idDespacho() == null ? null : despacho(r.idDespacho()));

        List<DocumentoSunat.Linea> lineas = new ArrayList<>();
        BigDecimal gravada = BigDecimal.ZERO;
        BigDecimal igv = BigDecimal.ZERO;
        for (ComprobanteDto.ItemRequest i : r.items()) {
            DocumentoSunat.Linea l = DocumentoSunat.lineaGravada(vacioANull(i.codigo()), i.descripcion().trim(),
                    DocumentoSunat.unidadSunat(i.unidad()), i.cantidad(), i.precioUnitario());
            lineas.add(l);
            gravada = gravada.add(l.valorVenta());
            igv = igv.add(l.igv());
            ComprobanteItem item = new ComprobanteItem();
            item.setCodigo(l.codigo());
            item.setDescripcion(l.descripcion());
            item.setUnidad(l.unidad());
            item.setCantidad(l.cantidad());
            item.setValorUnitario(l.valorUnitario());
            item.setPrecioUnitario(l.precioUnitario());
            item.setValorVenta(l.valorVenta());
            item.setIgv(l.igv());
            c.agregarItem(item);
        }
        c.setOpGravada(gravada);
        c.setIgv(igv);
        c.setTotal(gravada.add(igv));

        DocumentoSunat.Venta venta = new DocumentoSunat.Venta(c.getTipo(), c.getSerie(), c.getCorrelativo(),
                c.getFechaEmision().toLocalDate(), c.getFechaEmision().toLocalTime(), c.getMoneda(),
                new DocumentoSunat.Cliente(c.getClienteTipoDoc(), c.getClienteNumDoc(), c.getClienteNombre(),
                        c.getClienteDireccion()),
                lineas, c.getOpGravada(), c.getIgv(), c.getTotal());
        FirmaDigital.Firmado firmado = firma.firmar(XmlUbl.venta(emisor, venta));
        c.setXmlFirmado(firmado.texto());
        c.setHash(firmado.hash());
        c.setEstadoSunat(Comprobante.EstadoSunat.PENDIENTE);
        // Se guarda antes de enviar: el numero queda reservado aunque SUNAT no responda.
        comprobanteRepository.saveAndFlush(c);

        enviar(c, firmado.xml());
        registrarEvento(c);
        return detalle(comprobanteRepository.save(c));
    }

    /** Reintenta el envio de un comprobante que no llego a SUNAT (estado ERROR o PENDIENTE). */
    public ComprobanteDto.Detalle reenviar(Long id) {
        Comprobante c = entidad(id);
        if (DocumentoSunat.GUIA_REMISION.equals(c.getTipo())) {
            throw new BusinessRuleException("SUNAT no tiene entorno de pruebas para la guía de remisión: no se envía");
        }
        if (c.getEstadoSunat() != Comprobante.EstadoSunat.ERROR && c.getEstadoSunat() != Comprobante.EstadoSunat.PENDIENTE) {
            throw new BusinessRuleException("Solo se reenvían comprobantes que no llegaron a SUNAT (estado ERROR o PENDIENTE)");
        }
        enviar(c, c.getXmlFirmado().getBytes(StandardCharsets.UTF_8));
        return detalle(comprobanteRepository.save(c));
    }

    // ------------------------------------------------------------------ guia de remision
    public ComprobanteDto.Detalle emitirGuia(ComprobanteDto.GuiaRequest r) {
        validarDocumento(r.clienteTipoDoc(), r.clienteNumDoc());
        boolean publico = "01".equals(r.modalidad());
        if (publico && (vacio(r.transportistaRuc()) || vacio(r.transportistaNombre()))) {
            throw new BusinessRuleException("En transporte público indica el RUC y la razón social del transportista");
        }
        if (!publico && (vacio(r.conductorDni()) || vacio(r.conductorNombres()) || vacio(r.conductorApellidos())
                || vacio(r.conductorLicencia()) || vacio(r.placa()))) {
            throw new BusinessRuleException("En transporte privado indica el conductor (DNI, nombres, apellidos, licencia) y la placa");
        }
        LocalDateTime ahora = ahora();
        if (r.fechaTraslado().isBefore(ahora.toLocalDate())) {
            throw new BusinessRuleException("La fecha de inicio del traslado no puede ser anterior a hoy");
        }

        Comprobante c = nuevo(DocumentoSunat.GUIA_REMISION, sunat.serieGuia());
        c.setClienteTipoDoc(r.clienteTipoDoc());
        c.setClienteNumDoc(r.clienteNumDoc());
        c.setClienteNombre(r.clienteNombre().trim());
        c.setClienteDireccion(r.llegadaDireccion().trim());
        c.setObservacion(vacioANull(r.observacion()));
        c.setDespacho(r.idDespacho() == null ? null : despacho(r.idDespacho()));

        ComprobanteDto.Traslado t = new ComprobanteDto.Traslado(r.motivo(), MOTIVOS.get(r.motivo()), r.modalidad(),
                r.fechaTraslado(), r.pesoKg(), vacioANull(r.transportistaRuc()), vacioANull(r.transportistaNombre()),
                vacioANull(r.conductorDni()), vacioANull(r.conductorNombres()), vacioANull(r.conductorApellidos()),
                vacioANull(r.conductorLicencia()), vacioANull(r.placa()), r.partidaUbigeo(), r.partidaDireccion().trim(),
                r.llegadaUbigeo(), r.llegadaDireccion().trim());
        c.setDatosTraslado(t.serializar());

        List<DocumentoSunat.LineaGuia> lineas = new ArrayList<>();
        for (ComprobanteDto.ItemRequest i : r.items()) {
            String unidad = DocumentoSunat.unidadSunat(i.unidad());
            lineas.add(new DocumentoSunat.LineaGuia(vacioANull(i.codigo()), i.descripcion().trim(), unidad, i.cantidad()));
            ComprobanteItem item = new ComprobanteItem();
            item.setCodigo(vacioANull(i.codigo()));
            item.setDescripcion(i.descripcion().trim());
            item.setUnidad(unidad);
            item.setCantidad(i.cantidad());
            c.agregarItem(item);
        }

        DocumentoSunat.Guia guia = new DocumentoSunat.Guia(c.getSerie(), c.getCorrelativo(),
                c.getFechaEmision().toLocalDate(), c.getFechaEmision().toLocalTime(),
                new DocumentoSunat.Cliente(c.getClienteTipoDoc(), c.getClienteNumDoc(), c.getClienteNombre(), null),
                t.motivo(), t.descripcionMotivo(), t.pesoKg(), t.modalidad(), t.fechaTraslado(),
                publico ? new DocumentoSunat.Cliente("6", t.transportistaRuc(), t.transportistaNombre(), null) : null,
                publico ? null : new DocumentoSunat.Conductor("1", t.conductorDni(), t.conductorNombres(),
                        t.conductorApellidos(), t.conductorLicencia()),
                t.placa(),
                new DocumentoSunat.Direccion(t.partidaUbigeo(), t.partidaDireccion()),
                new DocumentoSunat.Direccion(t.llegadaUbigeo(), t.llegadaDireccion()),
                lineas, c.getObservacion());
        FirmaDigital.Firmado firmado = firma.firmar(XmlUbl.guia(emisor, guia));
        c.setXmlFirmado(firmado.texto());
        c.setHash(firmado.hash());
        if (sunat.esPrueba()) {
            c.setEstadoSunat(Comprobante.EstadoSunat.NO_ENVIADO);
            c.setDescripcionRespuesta("SUNAT no ofrece entorno de pruebas para la guía de remisión electrónica: "
                    + "el XML se generó y firmó en el formato oficial, pero no se envió.");
        } else {
            c.setEstadoSunat(Comprobante.EstadoSunat.NO_ENVIADO);
            c.setDescripcionRespuesta("El envío de guías a SUNAT (API REST con credenciales GRE) no está implementado.");
        }
        comprobanteRepository.save(c);
        registrarEvento(c);
        return detalle(c);
    }

    // ------------------------------------------------------------------ apoyo
    private Comprobante nuevo(String tipo, String serie) {
        Comprobante c = new Comprobante();
        c.setTipo(tipo);
        c.setSerie(serie);
        c.setCorrelativo(comprobanteRepository.ultimoCorrelativo(tipo, serie) + 1);
        c.setFechaEmision(ahora());
        c.setMoneda("PEN");
        c.setEntorno(sunat.entorno());
        c.setUsuario(usuarioActual.obtener());
        return c;
    }

    private void enviar(Comprobante c, byte[] xml) {
        ClienteSunat.Respuesta r = clienteSunat.enviar(emisor, nombreArchivo(c), xml);
        c.setFechaEnvio(ahora());
        c.setEstadoSunat(Comprobante.EstadoSunat.valueOf(r.estado().name()));
        c.setCodigoRespuesta(r.codigo());
        c.setDescripcionRespuesta(recortar(r.descripcion(), 4000));
        c.setObservacionesSunat(r.observaciones().isEmpty() ? null : String.join("\n", r.observaciones()));
        if (r.cdrZip() != null) {
            c.setCdrBase64(Base64.getEncoder().encodeToString(r.cdrZip()));
        }
    }

    private void registrarEvento(Comprobante c) {
        if (c.getDespacho() == null) {
            return;
        }
        Usuario actor = c.getUsuario();
        eventoService.registrar(Evento.Tipo.OTRO, null, c.getDespacho(), actor,
                nombreTipo(c.getTipo()) + " " + c.numero() + " emitida para el despacho " + c.getDespacho().getCodigo()
                        + " (SUNAT: " + c.getEstadoSunat() + ")");
    }

    private ComprobanteDto.Detalle detalle(Comprobante c) {
        return ComprobanteDto.Detalle.of(c, ComprobanteDto.Emisor.of(sunat));
    }

    private Comprobante entidad(Long id) {
        return comprobanteRepository.findById(id).orElseThrow(() -> new NotFoundException("Comprobante", id));
    }

    private Despacho despacho(Long id) {
        return despachoRepository.findById(id).orElseThrow(() -> new NotFoundException("Despacho", id));
    }

    private String nombreArchivo(Comprobante c) {
        return emisor.ruc() + "-" + c.getTipo() + "-" + c.getSerie() + "-" + c.getCorrelativo();
    }

    private static void validarDocumento(String tipo, String numero) {
        if ("1".equals(tipo) && numero.length() != 8) {
            throw new BusinessRuleException("El DNI debe tener 8 dígitos");
        }
        if ("6".equals(tipo) && numero.length() != 11) {
            throw new BusinessRuleException("El RUC debe tener 11 dígitos");
        }
    }

    public static String nombreTipo(String tipo) {
        return switch (tipo) {
            case "01" -> "Factura";
            case "03" -> "Boleta";
            case "09" -> "Guía de remisión";
            default -> "Comprobante";
        };
    }

    private static LocalDateTime ahora() {
        return LocalDateTime.now(ZONA_PERU).withNano(0);
    }

    private static boolean vacio(String s) {
        return s == null || s.isBlank();
    }

    private static String vacioANull(String s) {
        return vacio(s) ? null : s.trim();
    }

    private static String recortar(String s, int max) {
        return s == null || s.length() <= max ? s : s.substring(0, max);
    }
}
