package Web.Friotrack.sunat;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;

/**
 * Datos de los comprobantes que se envian a SUNAT. Son clases de Java puro (sin Spring ni JPA)
 * para poder generarlos, firmarlos y probarlos de forma aislada.
 */
public final class DocumentoSunat {

    private DocumentoSunat() {
    }

    public static final BigDecimal TASA_IGV = new BigDecimal("0.18");

    /** Catalogo 01 de SUNAT. */
    public static final String FACTURA = "01";
    public static final String BOLETA = "03";
    public static final String GUIA_REMISION = "09";

    /** Datos del emisor (la empresa). */
    public record Emisor(
            String ruc,
            String razonSocial,
            String nombreComercial,
            String ubigeo,
            String departamento,
            String provincia,
            String distrito,
            String direccion,
            String usuarioSol,
            String claveSol) {
    }

    /** Cliente o destinatario. tipoDoc segun catalogo 06: 6 = RUC, 1 = DNI, 0 = otros. */
    public record Cliente(String tipoDoc, String numDoc, String nombre, String direccion) {
    }

    public record Linea(
            String codigo,
            String descripcion,
            String unidad,
            BigDecimal cantidad,
            BigDecimal valorUnitario,
            BigDecimal precioUnitario,
            BigDecimal valorVenta,
            BigDecimal igv) {

        public BigDecimal total() {
            return valorVenta.add(igv);
        }
    }

    /** Factura (01) o boleta (03), operaciones gravadas con IGV. */
    public record Venta(
            String tipo,
            String serie,
            long correlativo,
            LocalDate fecha,
            LocalTime hora,
            String moneda,
            Cliente cliente,
            List<Linea> lineas,
            BigDecimal gravada,
            BigDecimal igv,
            BigDecimal total) {

        public String numero() {
            return serie + "-" + correlativo;
        }
    }

    public record Direccion(String ubigeo, String linea) {
    }

    public record Conductor(String tipoDoc, String numDoc, String nombres, String apellidos, String licencia) {
    }

    public record LineaGuia(String codigo, String descripcion, String unidad, BigDecimal cantidad) {
    }

    /** Guia de remision remitente (09). modalidad: 01 = transporte publico, 02 = transporte privado. */
    public record Guia(
            String serie,
            long correlativo,
            LocalDate fecha,
            LocalTime hora,
            Cliente destinatario,
            String motivo,
            String descripcionMotivo,
            BigDecimal pesoKg,
            String modalidad,
            LocalDate fechaTraslado,
            Cliente transportista,
            Conductor conductor,
            String placa,
            Direccion partida,
            Direccion llegada,
            List<LineaGuia> lineas,
            String observacion) {

        public String numero() {
            return serie + "-" + correlativo;
        }
    }

    /**
     * Calcula una linea gravada a partir del precio unitario con IGV, que es el que conoce el usuario.
     * valor unitario = precio / 1.18 ; valor de venta = cantidad x valor unitario ; IGV = 18 % del valor de venta.
     */
    public static Linea lineaGravada(String codigo, String descripcion, String unidad, BigDecimal cantidad,
                                     BigDecimal precioConIgv) {
        BigDecimal valorUnitario = precioConIgv.divide(BigDecimal.ONE.add(TASA_IGV), 6, RoundingMode.HALF_UP);
        BigDecimal total = cantidad.multiply(precioConIgv).setScale(2, RoundingMode.HALF_UP);
        BigDecimal valorVenta = total.divide(BigDecimal.ONE.add(TASA_IGV), 2, RoundingMode.HALF_UP);
        BigDecimal igv = total.subtract(valorVenta);
        return new Linea(codigo, descripcion, unidad, cantidad, valorUnitario,
                precioConIgv.setScale(2, RoundingMode.HALF_UP), valorVenta, igv);
    }

    /** Unidad de medida del catalogo 03 (UN/ECE rec 20) a partir de la unidad libre del lote o producto. */
    public static String unidadSunat(String unidad) {
        if (unidad == null) {
            return "NIU";
        }
        String u = unidad.trim().toLowerCase();
        return switch (u) {
            case "kg", "kgs", "kilo", "kilos", "kilogramo", "kilogramos", "kgm" -> "KGM";
            case "g", "gr", "gramo", "gramos", "grm" -> "GRM";
            case "l", "lt", "lts", "litro", "litros", "ltr" -> "LTR";
            case "caja", "cajas", "cj", "bx" -> "BX";
            case "paquete", "paquetes", "pk" -> "PK";
            case "zz", "servicio" -> "ZZ";
            default -> "NIU";
        };
    }
}
