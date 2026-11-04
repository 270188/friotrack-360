package Web.Friotrack.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

import Web.Friotrack.entity.Despacho;
import Web.Friotrack.entity.Lote;

public class TrazabilidadDto {

    public record LoteView(
            Long idLote,
            String codigoLote,
            ProductoDto.Response producto,
            BigDecimal cantidad,
            String unidad,
            Lote.Estado estado,
            LocalDate fechaProduccion,
            LocalDate fechaVencimiento,
            boolean vencido,
            List<DespachoRef> despachos,
            List<ControlDto.Response> controles,
            List<IncidenciaDto.Resumen> incidencias,
            List<EvidenciaDto.Resumen> evidencias,
            List<EventoDto.Timeline> timeline) {
    }

    public record DespachoView(
            Long idDespacho,
            String codigo,
            String transportista,
            String vehiculo,
            String placa,
            String destino,
            Despacho.Estado estado,
            LocalDateTime fechaProgramada,
            LocalDateTime fechaSalida,
            LocalDateTime fechaLlegada,
            String responsable,
            List<LoteDto.Resumen> lotes,
            List<ControlDto.Response> controles,
            List<IncidenciaDto.Resumen> incidencias,
            List<EvidenciaDto.Resumen> evidencias,
            List<EventoDto.Timeline> timeline) {
    }

    public record DespachoRef(
            Long idDespacho,
            String codigo,
            Despacho.Estado estado,
            String destino,
            BigDecimal cantidad,
            LocalDateTime fechaProgramada,
            LocalDateTime fechaSalida,
            LocalDateTime fechaLlegada) {
    }

}
