package Web.Friotrack.dto;

import java.time.LocalDateTime;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import Web.Friotrack.entity.Evidencia;

public class EvidenciaDto {

    public record Request(
            @NotBlank String tipo,
            @NotBlank @Size(max = 255) String nombreArchivo,
            @Size(max = 500) String url,
            @Size(max = 500) String descripcion) {
    }

    public record Response(
            Long idEvidencia,
            Long idIncidencia,
            String tipo,
            String nombreArchivo,
            String url,
            String descripcion,
            LocalDateTime fechaCreacion,
            Long idUsuario,
            String username) {

        public static Response of(Evidencia evidencia) {
            return new Response(evidencia.getIdEvidencia(), evidencia.getIncidencia().getIdIncidencia(),
                    evidencia.getTipo(), evidencia.getNombreArchivo(), evidencia.getUrl(),
                    evidencia.getDescripcion(), evidencia.getFechaCreacion(),
                    evidencia.getUsuario().getIdUsuario(), evidencia.getUsuario().getUsername());
        }
    }

    public record Resumen(
            Long idEvidencia,
            Long idIncidencia,
            String codigoLote,
            String tipo,
            String nombreArchivo,
            String url,
            String descripcion,
            LocalDateTime fechaCreacion,
            String username) {

        public static Resumen of(Evidencia evidencia, String codigoLote) {
            return new Resumen(evidencia.getIdEvidencia(), evidencia.getIncidencia().getIdIncidencia(),
                    codigoLote, evidencia.getTipo(), evidencia.getNombreArchivo(), evidencia.getUrl(),
                    evidencia.getDescripcion(), evidencia.getFechaCreacion(),
                    evidencia.getUsuario().getUsername());
        }
    }

}
