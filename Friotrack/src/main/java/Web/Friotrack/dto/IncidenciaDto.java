package Web.Friotrack.dto;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.List;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import Web.Friotrack.entity.Incidencia;

public class IncidenciaDto {

    public record Request(
            Long idControl,
            @NotNull Long idLote,
            Long idDespacho,
            Incidencia.Tipo tipo,
            @NotBlank String descripcion,
            Incidencia.Prioridad prioridad,
            Long idResponsable) {
    }

    public record Actualizacion(
            Incidencia.Tipo tipo,
            @Size(max = 4000) String descripcion,
            Incidencia.Prioridad prioridad,
            @Size(max = 4000) String causa,
            @Size(max = 4000) String accion,
            Long idResponsable) {
    }

    public record CambioEstado(
            @NotNull Incidencia.Estado estado,
            @Size(max = 4000) String causa,
            @Size(max = 4000) String accion,
            Long idResponsable,
            @Size(max = 500) String motivo) {
    }

    public record Response(
            Long idIncidencia,
            Long idControl,
            Long idLote,
            String codigoLote,
            Long idDespacho,
            String codigoDespacho,
            Incidencia.Tipo tipo,
            String descripcion,
            Incidencia.Prioridad prioridad,
            Incidencia.Estado estado,
            String causa,
            String accion,
            Long idResponsable,
            String usernameResponsable,
            LocalDateTime fechaCreacion,
            LocalDateTime fechaCierre,
            Long minutosResolucion,
            List<EvidenciaDto.Response> evidencias) {

        public static Response of(Incidencia incidencia, List<EvidenciaDto.Response> evidencias) {
            LocalDateTime creacion = incidencia.getFechaCreacion();
            LocalDateTime cierre = incidencia.getFechaCierre();
            return new Response(incidencia.getIdIncidencia(),
                    incidencia.getControl() == null ? null : incidencia.getControl().getIdControl(),
                    incidencia.getLote().getIdLote(), incidencia.getLote().getCodigoLote(),
                    incidencia.getDespacho() == null ? null : incidencia.getDespacho().getIdDespacho(),
                    incidencia.getDespacho() == null ? null : incidencia.getDespacho().getCodigo(),
                    incidencia.getTipo(), incidencia.getDescripcion(), incidencia.getPrioridad(),
                    incidencia.getEstado(), incidencia.getCausa(), incidencia.getAccion(),
                    incidencia.getResponsable() == null ? null : incidencia.getResponsable().getIdUsuario(),
                    incidencia.getResponsable() == null ? null : incidencia.getResponsable().getUsername(),
                    creacion, cierre,
                    cierre == null ? null : Duration.between(creacion, cierre).toMinutes(),
                    evidencias);
        }
    }

    public record Resumen(
            Long idIncidencia,
            Incidencia.Tipo tipo,
            Incidencia.Prioridad prioridad,
            Incidencia.Estado estado,
            String descripcion,
            Long idLote,
            String codigoLote,
            Long idDespacho,
            LocalDateTime fechaCreacion,
            long evidencias) {

        public static Resumen of(Incidencia incidencia, long evidencias) {
            return new Resumen(incidencia.getIdIncidencia(), incidencia.getTipo(), incidencia.getPrioridad(),
                    incidencia.getEstado(), incidencia.getDescripcion(), incidencia.getLote().getIdLote(),
                    incidencia.getLote().getCodigoLote(),
                    incidencia.getDespacho() == null ? null : incidencia.getDespacho().getIdDespacho(),
                    incidencia.getFechaCreacion(), evidencias);
        }
    }

}
