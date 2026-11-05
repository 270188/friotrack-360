package Web.Friotrack.dto;

import java.io.StringReader;
import java.io.StringWriter;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Arrays;
import java.util.List;
import java.util.Properties;

import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import Web.Friotrack.config.SunatProperties;
import Web.Friotrack.entity.Comprobante;
import Web.Friotrack.entity.ComprobanteItem;

public class ComprobanteDto {

    public record ItemRequest(
            @Size(max = 50) String codigo,
            @NotBlank @Size(max = 500) String descripcion,
            @Size(max = 20) String unidad,
            @NotNull @DecimalMin(value = "0.001", message = "La cantidad debe ser mayor a 0")
            @Digits(integer = 9, fraction = 3) BigDecimal cantidad,
            @DecimalMin(value = "0.01", message = "El precio debe ser mayor a 0")
            @Digits(integer = 9, fraction = 2) BigDecimal precioUnitario) {
    }

    /** Factura (01) o boleta (03). precio_unitario de cada item incluye IGV. */
    public record VentaRequest(
            @NotBlank @Pattern(regexp = "01|03", message = "tipo debe ser 01 (factura) o 03 (boleta)") String tipo,
            @NotBlank @Pattern(regexp = "1|6", message = "Tipo de documento: 1 (DNI) o 6 (RUC)") String clienteTipoDoc,
            @NotBlank @Pattern(regexp = "\\d{8}|\\d{11}", message = "DNI de 8 digitos o RUC de 11") String clienteNumDoc,
            @NotBlank @Size(max = 200) String clienteNombre,
            @Size(max = 255) String clienteDireccion,
            Long idDespacho,
            @Size(max = 500) String observacion,
            @NotEmpty(message = "Agrega al menos un item") @Size(max = 50) @Valid List<ItemRequest> items) {
    }

    /** Guia de remision remitente (09). */
    public record GuiaRequest(
            @NotBlank @Pattern(regexp = "1|6", message = "Tipo de documento: 1 (DNI) o 6 (RUC)") String clienteTipoDoc,
            @NotBlank @Pattern(regexp = "\\d{8}|\\d{11}", message = "DNI de 8 digitos o RUC de 11") String clienteNumDoc,
            @NotBlank @Size(max = 200) String clienteNombre,
            Long idDespacho,
            @NotBlank @Pattern(regexp = "01|02|04|13", message = "Motivo: 01 venta, 02 compra, 04 traslado entre establecimientos, 13 otros") String motivo,
            @NotBlank @Pattern(regexp = "01|02", message = "Modalidad: 01 transporte publico, 02 transporte privado") String modalidad,
            @NotNull LocalDate fechaTraslado,
            @NotNull @DecimalMin(value = "0.001", message = "El peso debe ser mayor a 0")
            @Digits(integer = 9, fraction = 3) BigDecimal pesoKg,
            @Pattern(regexp = "|\\d{11}", message = "RUC del transportista de 11 digitos") String transportistaRuc,
            @Size(max = 200) String transportistaNombre,
            @Pattern(regexp = "|\\d{8}", message = "DNI del conductor de 8 digitos") String conductorDni,
            @Size(max = 100) String conductorNombres,
            @Size(max = 100) String conductorApellidos,
            @Size(max = 20) String conductorLicencia,
            @Size(max = 10) String placa,
            @NotBlank @Pattern(regexp = "\\d{6}", message = "Ubigeo de 6 digitos") String partidaUbigeo,
            @NotBlank @Size(max = 200) String partidaDireccion,
            @NotBlank @Pattern(regexp = "\\d{6}", message = "Ubigeo de 6 digitos") String llegadaUbigeo,
            @NotBlank @Size(max = 200) String llegadaDireccion,
            @Size(max = 500) String observacion,
            @NotEmpty(message = "Agrega al menos un item") @Size(max = 50) @Valid List<ItemRequest> items) {
    }

    /** Datos del traslado de la guia, guardados en comprobante.datos_traslado. */
    public record Traslado(
            String motivo,
            String descripcionMotivo,
            String modalidad,
            LocalDate fechaTraslado,
            BigDecimal pesoKg,
            String transportistaRuc,
            String transportistaNombre,
            String conductorDni,
            String conductorNombres,
            String conductorApellidos,
            String conductorLicencia,
            String placa,
            String partidaUbigeo,
            String partidaDireccion,
            String llegadaUbigeo,
            String llegadaDireccion) {

        public String serializar() {
            Properties p = new Properties();
            poner(p, "motivo", motivo);
            poner(p, "descripcionMotivo", descripcionMotivo);
            poner(p, "modalidad", modalidad);
            poner(p, "fechaTraslado", fechaTraslado == null ? null : fechaTraslado.toString());
            poner(p, "pesoKg", pesoKg == null ? null : pesoKg.toPlainString());
            poner(p, "transportistaRuc", transportistaRuc);
            poner(p, "transportistaNombre", transportistaNombre);
            poner(p, "conductorDni", conductorDni);
            poner(p, "conductorNombres", conductorNombres);
            poner(p, "conductorApellidos", conductorApellidos);
            poner(p, "conductorLicencia", conductorLicencia);
            poner(p, "placa", placa);
            poner(p, "partidaUbigeo", partidaUbigeo);
            poner(p, "partidaDireccion", partidaDireccion);
            poner(p, "llegadaUbigeo", llegadaUbigeo);
            poner(p, "llegadaDireccion", llegadaDireccion);
            StringWriter w = new StringWriter();
            try {
                p.store(w, null);
            } catch (java.io.IOException e) {
                throw new IllegalStateException(e);
            }
            return w.toString();
        }

        public static Traslado leer(String texto) {
            if (texto == null || texto.isBlank()) {
                return null;
            }
            Properties p = new Properties();
            try {
                p.load(new StringReader(texto));
            } catch (java.io.IOException e) {
                return null;
            }
            String fecha = p.getProperty("fechaTraslado");
            String peso = p.getProperty("pesoKg");
            return new Traslado(p.getProperty("motivo"), p.getProperty("descripcionMotivo"), p.getProperty("modalidad"),
                    fecha == null ? null : LocalDate.parse(fecha), peso == null ? null : new BigDecimal(peso),
                    p.getProperty("transportistaRuc"), p.getProperty("transportistaNombre"), p.getProperty("conductorDni"),
                    p.getProperty("conductorNombres"), p.getProperty("conductorApellidos"),
                    p.getProperty("conductorLicencia"), p.getProperty("placa"), p.getProperty("partidaUbigeo"),
                    p.getProperty("partidaDireccion"), p.getProperty("llegadaUbigeo"), p.getProperty("llegadaDireccion"));
        }

        private static void poner(Properties p, String k, String v) {
            if (v != null && !v.isBlank()) {
                p.setProperty(k, v);
            }
        }
    }

    public record Emisor(
            String ruc,
            String razonSocial,
            String nombreComercial,
            String direccion,
            String distrito,
            String provincia,
            String departamento,
            String ubigeo,
            String entorno,
            boolean prueba,
            String serieFactura,
            String serieBoleta,
            String serieGuia) {

        public static Emisor of(SunatProperties p) {
            return new Emisor(p.ruc(), p.razonSocial(), p.nombreComercial(), p.direccion(), p.distrito(),
                    p.provincia(), p.departamento(), p.ubigeo(), p.entorno(), p.esPrueba(), p.serieFactura(),
                    p.serieBoleta(), p.serieGuia());
        }
    }

    public record Item(
            Integer orden,
            String codigo,
            String descripcion,
            String unidad,
            BigDecimal cantidad,
            BigDecimal valorUnitario,
            BigDecimal precioUnitario,
            BigDecimal valorVenta,
            BigDecimal igv,
            BigDecimal total) {

        public static Item of(ComprobanteItem i) {
            return new Item(i.getOrden(), i.getCodigo(), i.getDescripcion(), i.getUnidad(), i.getCantidad(),
                    i.getValorUnitario(), i.getPrecioUnitario(), i.getValorVenta(), i.getIgv(),
                    i.getValorVenta().add(i.getIgv()));
        }
    }

    public record Resumen(
            Long idComprobante,
            String tipo,
            String serie,
            Long correlativo,
            String numero,
            LocalDateTime fechaEmision,
            String clienteTipoDoc,
            String clienteNumDoc,
            String clienteNombre,
            String moneda,
            BigDecimal total,
            Comprobante.EstadoSunat estadoSunat,
            String codigoRespuesta,
            Long idDespacho,
            String codigoDespacho) {

        public static Resumen of(Comprobante c) {
            return new Resumen(c.getIdComprobante(), c.getTipo(), c.getSerie(), c.getCorrelativo(), c.numero(),
                    c.getFechaEmision(), c.getClienteTipoDoc(), c.getClienteNumDoc(), c.getClienteNombre(),
                    c.getMoneda(), c.getTotal(), c.getEstadoSunat(), c.getCodigoRespuesta(),
                    c.getDespacho() == null ? null : c.getDespacho().getIdDespacho(),
                    c.getDespacho() == null ? null : c.getDespacho().getCodigo());
        }
    }

    public record Detalle(
            Long idComprobante,
            String tipo,
            String serie,
            Long correlativo,
            String numero,
            LocalDateTime fechaEmision,
            String moneda,
            String clienteTipoDoc,
            String clienteNumDoc,
            String clienteNombre,
            String clienteDireccion,
            BigDecimal opGravada,
            BigDecimal igv,
            BigDecimal total,
            String montoEnLetras,
            Long idDespacho,
            String codigoDespacho,
            Traslado traslado,
            String observacion,
            String entorno,
            Comprobante.EstadoSunat estadoSunat,
            String codigoRespuesta,
            String descripcionRespuesta,
            List<String> observacionesSunat,
            String hash,
            boolean tieneXml,
            boolean tieneCdr,
            LocalDateTime fechaEnvio,
            String username,
            LocalDateTime fechaCreacion,
            List<Item> items,
            Emisor emisor) {

        public static Detalle of(Comprobante c, Emisor emisor) {
            List<String> obs = c.getObservacionesSunat() == null || c.getObservacionesSunat().isBlank()
                    ? List.of()
                    : Arrays.stream(c.getObservacionesSunat().split("\n")).filter(s -> !s.isBlank()).toList();
            return new Detalle(c.getIdComprobante(), c.getTipo(), c.getSerie(), c.getCorrelativo(), c.numero(),
                    c.getFechaEmision(), c.getMoneda(), c.getClienteTipoDoc(), c.getClienteNumDoc(),
                    c.getClienteNombre(), c.getClienteDireccion(), c.getOpGravada(), c.getIgv(), c.getTotal(),
                    "09".equals(c.getTipo()) ? null : Web.Friotrack.sunat.MontoEnLetras.soles(c.getTotal()),
                    c.getDespacho() == null ? null : c.getDespacho().getIdDespacho(),
                    c.getDespacho() == null ? null : c.getDespacho().getCodigo(),
                    Traslado.leer(c.getDatosTraslado()), c.getObservacion(), c.getEntorno(), c.getEstadoSunat(),
                    c.getCodigoRespuesta(), c.getDescripcionRespuesta(), obs, c.getHash(),
                    c.getXmlFirmado() != null, c.getCdrBase64() != null, c.getFechaEnvio(),
                    c.getUsuario() == null ? null : c.getUsuario().getUsername(), c.getFechaCreacion(),
                    c.getItems().stream().map(Item::of).toList(), emisor);
        }
    }
}
