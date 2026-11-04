package Web.Friotrack.dto;

import java.time.LocalDateTime;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import Web.Friotrack.entity.Evento;

public class EventoDto {

    public record Request(
            Long idLote,
            Long idDespacho,
            Evento.Tipo tipo,
            @Size(max = 2000) String descripcion,
            @Size(max = 255) String ubicacion,
            LocalDateTime fechaHora) {
    }

    public record Response(
            Long idEvento,
            Long idLote,
            String codigoLote,
            Long idDespacho,
            String codigoDespacho,
            Evento.Tipo tipo,
            String descripcion,
            String ubicacion,
            LocalDateTime fechaHora,
            Long idUsuario,
            String username) {

        public static Response of(Evento evento) {
            return new Response(evento.getIdEvento(),
                    evento.getLote() == null ? null : evento.getLote().getIdLote(),
                    evento.getLote() == null ? null : evento.getLote().getCodigoLote(),
                    evento.getDespacho() == null ? null : evento.getDespacho().getIdDespacho(),
                    evento.getDespacho() == null ? null : evento.getDespacho().getCodigo(),
                    evento.getTipo(), evento.getDescripcion(), evento.getUbicacion(), evento.getFechaHora(),
                    evento.getUsuario().getIdUsuario(), evento.getUsuario().getUsername());
        }

        public static Timeline toTimeline(Evento evento) {
            return new Timeline(evento.getFechaHora(), evento.getTipo().name(),
                    evento.getUsuario().getUsername(), evento.getDescripcion());
        }
    }

    public record Timeline(
            LocalDateTime fecha,
            String tipo,
            String actor,
            String descripcion) {
    }

}
