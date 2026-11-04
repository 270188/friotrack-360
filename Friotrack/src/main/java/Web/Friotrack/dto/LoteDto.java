package Web.Friotrack.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import Web.Friotrack.entity.Lote;

public class LoteDto {

    public record Request(
            @NotNull Long idProducto,
            @NotBlank @Size(max = 80) String codigoLote,
            LocalDate fechaProduccion,
            LocalDate fechaVencimiento,
            @NotNull @DecimalMin("0.000") @Digits(integer = 9, fraction = 3) BigDecimal cantidad,
            @Size(max = 30) String unidad,
            Lote.Estado estado) {
    }

    public record Actualizacion(
            LocalDate fechaProduccion,
            LocalDate fechaVencimiento,
            @DecimalMin("0.000") @Digits(integer = 9, fraction = 3) BigDecimal cantidad,
            @Size(max = 30) String unidad) {
    }

    public record Response(
            Long idLote,
            String codigoLote,
            ProductoDto.Response producto,
            LocalDate fechaProduccion,
            LocalDate fechaVencimiento,
            boolean vencido,
            BigDecimal cantidad,
            String unidad,
            Lote.Estado estado,
            LocalDateTime fechaCreacion) {

        public static Response of(Lote lote) {
            return new Response(lote.getIdLote(), lote.getCodigoLote(), ProductoDto.Response.of(lote.getProducto()),
                    lote.getFechaProduccion(), lote.getFechaVencimiento(), lote.isVencido(),
                    lote.getCantidad(), lote.getUnidad(), lote.getEstado(), lote.getFechaCreacion());
        }
    }

    public record Resumen(
            Long idLote,
            String codigoLote,
            String producto,
            BigDecimal cantidad,
            String unidad,
            Lote.Estado estado) {

        public static Resumen of(Lote lote) {
            return new Resumen(lote.getIdLote(), lote.getCodigoLote(), lote.getProducto().getNombre(),
                    lote.getCantidad(), lote.getUnidad(), lote.getEstado());
        }
    }

    public record CambioEstado(
            @Size(max = 500) String motivo) {
    }

}
