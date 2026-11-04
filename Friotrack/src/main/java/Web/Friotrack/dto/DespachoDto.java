package Web.Friotrack.dto;

import java.time.LocalDateTime;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import Web.Friotrack.entity.Despacho;
import Web.Friotrack.entity.DespachoLote;

public class DespachoDto {

    public record Request(
            @NotBlank @Size(max = 80) String codigo,
            @Size(max = 150) String transportista,
            @Size(max = 100) String vehiculo,
            @Size(max = 20) String placa,
            @NotBlank @Size(max = 150) String destino,
            @Size(max = 255) String direccionDestino,
            @Size(max = 150) String contactoDestino,
            LocalDateTime fechaProgramada,
            String observacion) {
    }

    public record Actualizacion(
            @Size(max = 150) String transportista,
            @Size(max = 100) String vehiculo,
            @Size(max = 20) String placa,
            @Size(max = 150) String destino,
            @Size(max = 255) String direccionDestino,
            @Size(max = 150) String contactoDestino,
            LocalDateTime fechaProgramada,
            String observacion) {
    }

    public record CambioEstado(
            @NotNull Despacho.Estado estado,
            @Size(max = 500) String motivo) {
    }

    public record Response(
            Long idDespacho,
            String codigo,
            String transportista,
            String vehiculo,
            String placa,
            String destino,
            String direccionDestino,
            String contactoDestino,
            LocalDateTime fechaProgramada,
            LocalDateTime fechaSalida,
            LocalDateTime fechaLlegada,
            Despacho.Estado estado,
            String observacion,
            UsuarioDto.Response usuario,
            LocalDateTime fechaCreacion) {

        public static Response of(Despacho despacho) {
            return new Response(despacho.getIdDespacho(), despacho.getCodigo(), despacho.getTransportista(),
                    despacho.getVehiculo(), despacho.getPlaca(), despacho.getDestino(),
                    despacho.getDireccionDestino(), despacho.getContactoDestino(), despacho.getFechaProgramada(),
                    despacho.getFechaSalida(), despacho.getFechaLlegada(), despacho.getEstado(),
                    despacho.getObservacion(), UsuarioDto.Response.of(despacho.getUsuario()),
                    despacho.getFechaCreacion());
        }
    }

    public record Item(
            Long idDespachoLote,
            Long idDespacho,
            LoteDto.Resumen lote,
            java.math.BigDecimal cantidad) {

        public static Item of(DespachoLote item) {
            return new Item(item.getIdDespachoLote(), item.getDespacho().getIdDespacho(),
                    LoteDto.Resumen.of(item.getLote()), item.getCantidad());
        }
    }

}
