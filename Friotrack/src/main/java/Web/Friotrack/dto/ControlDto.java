package Web.Friotrack.dto;

import java.math.BigDecimal;
import java.time.LocalDateTime;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import Web.Friotrack.entity.Control;
import Web.Friotrack.support.EvaluadorRango;

public class ControlDto {

    public record Request(
            @NotNull Long idDespacho,
            @NotNull Long idLote,
            LocalDateTime fechaHora,
            @DecimalMin("-50.00") @DecimalMax("50.00") BigDecimal temperatura,
            @DecimalMin("0.00") @DecimalMax("100.00") BigDecimal humedad,
            @Size(max = 1000) String observacion) {
    }

    public record Response(
            Long idControl,
            Long idDespacho,
            String codigoDespacho,
            Long idLote,
            String codigoLote,
            LocalDateTime fechaHora,
            BigDecimal temperatura,
            BigDecimal humedad,
            Control.Resultado resultado,
            String motivoDesviacion,
            String observacion,
            Long idUsuario,
            String username) {

        public static Response of(Control control) {
            return new Response(control.getIdControl(), control.getDespacho().getIdDespacho(),
                    control.getDespacho().getCodigo(), control.getLote().getIdLote(),
                    control.getLote().getCodigoLote(), control.getFechaHora(), control.getTemperatura(),
                    control.getHumedad(), control.getResultado(), EvaluadorRango.motivo(control),
                    control.getObservacion(), control.getUsuario().getIdUsuario(),
                    control.getUsuario().getUsername());
        }
    }

}
