package Web.Friotrack.dto;

import java.time.LocalDate;
import java.util.List;

public class DashboardDto {

    public record Cumplimiento(
            long controles,
            long enRango,
            long fueraDeRango,
            double porcentajeEnRango,
            long despachos,
            long despachosSinIncidencias,
            long desviacionesEnDespachosActivos,
            LocalDate desde,
            LocalDate hasta) {
    }

    public record Lotes(
            long total,
            long disponibles,
            long bloqueados,
            long enTransito,
            long entregados,
            long descartados,
            long porVencer) {
    }

    public record Incidencias(
            long total,
            long abiertas,
            long enProceso,
            long resueltas,
            long cerradas,
            long criticas,
            long altas,
            double promedioMinutosResolucion) {
    }

    public record DespachoPorEstado(
            Web.Friotrack.entity.Despacho.Estado estado,
            long total) {
    }

    public record EventoPorTipo(
            Web.Friotrack.entity.Evento.Tipo tipo,
            long total) {
    }

    public record General(
            Cumplimiento cumplimiento,
            Lotes lotes,
            Incidencias incidencias,
            List<DespachoPorEstado> despachosPorEstado,
            List<ProductoDto.Cumplimiento> cumplimientoPorProducto,
            List<IncidenciaDto.Resumen> incidenciasAbiertas,
            List<IncidenciaDto.Resumen> ultimaIncidenciaResuelta,
            List<EventoDto.Timeline> eventosRecientes) {
    }

}
