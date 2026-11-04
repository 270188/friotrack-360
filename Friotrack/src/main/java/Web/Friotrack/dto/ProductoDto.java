package Web.Friotrack.dto;

import java.math.BigDecimal;
import java.time.LocalDateTime;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import Web.Friotrack.entity.Producto;

public class ProductoDto {

    public record Request(
            @NotBlank @Size(max = 150) String nombre,
            @Size(max = 100) String categoria,
            String descripcion,
            @DecimalMin("-50.00") @DecimalMax("50.00") BigDecimal temperaturaMin,
            @DecimalMin("-50.00") @DecimalMax("50.00") BigDecimal temperaturaMax,
            @DecimalMin("0.00") @DecimalMax("100.00") BigDecimal humedadMin,
            @DecimalMin("0.00") @DecimalMax("100.00") BigDecimal humedadMax,
            Boolean activo) {
    }

    public record Response(
            Long idProducto,
            String nombre,
            String categoria,
            String descripcion,
            BigDecimal temperaturaMin,
            BigDecimal temperaturaMax,
            BigDecimal humedadMin,
            BigDecimal humedadMax,
            boolean defineRangoTemperatura,
            boolean defineRangoHumedad,
            Boolean activo,
            LocalDateTime fechaCreacion) {

        public static Response of(Producto producto) {
            return new Response(producto.getIdProducto(), producto.getNombre(), producto.getCategoria(),
                    producto.getDescripcion(), producto.getTemperaturaMin(), producto.getTemperaturaMax(),
                    producto.getHumedadMin(), producto.getHumedadMax(),
                    producto.defineRangoTemperatura(), producto.defineRangoHumedad(),
                    producto.getActivo(), producto.getFechaCreacion());
        }
    }

    public record Cumplimiento(
            Long idProducto,
            String nombre,
            long controles,
            long desviaciones,
            double porcentajeEnRango) {

        public static Cumplimiento of(Long idProducto, String nombre, long controles, long desviaciones) {
            double porcentaje = controles == 0 ? 100.0 : (controles - desviaciones) * 100.0 / controles;
            return new Cumplimiento(idProducto, nombre, controles, desviaciones,
                    Math.round(porcentaje * 100.0) / 100.0);
        }
    }

}
