package Web.Friotrack.service;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import Web.Friotrack.dto.DashboardDto;
import Web.Friotrack.dto.EventoDto;
import Web.Friotrack.dto.IncidenciaDto;
import Web.Friotrack.dto.ProductoDto;
import Web.Friotrack.entity.Control;
import Web.Friotrack.entity.Despacho;
import Web.Friotrack.entity.Evento;
import Web.Friotrack.entity.Incidencia;
import Web.Friotrack.entity.Lote;
import Web.Friotrack.repository.ControlRepository;
import Web.Friotrack.repository.DespachoRepository;
import Web.Friotrack.repository.EventoRepository;
import Web.Friotrack.repository.EvidenciaRepository;
import Web.Friotrack.repository.IncidenciaRepository;
import Web.Friotrack.repository.LoteRepository;
import Web.Friotrack.repository.ProductoRepository;

@Service
@Transactional(readOnly = true)
public class DashboardService {

    private static final int DIAS_POR_VENCER = 30;
    private static final int RECIENTES = 10;
    private static final LocalDateTime EPOCA = LocalDateTime.of(1970, 1, 1, 0, 0);

    private final ControlRepository controlRepository;
    private final DespachoRepository despachoRepository;
    private final EventoRepository eventoRepository;
    private final EvidenciaRepository evidenciaRepository;
    private final IncidenciaRepository incidenciaRepository;
    private final LoteRepository loteRepository;
    private final ProductoRepository productoRepository;

    public DashboardService(ControlRepository controlRepository,
                            DespachoRepository despachoRepository,
                            EventoRepository eventoRepository,
                            EvidenciaRepository evidenciaRepository,
                            IncidenciaRepository incidenciaRepository,
                            LoteRepository loteRepository,
                            ProductoRepository productoRepository) {
        this.controlRepository = controlRepository;
        this.despachoRepository = despachoRepository;
        this.eventoRepository = eventoRepository;
        this.evidenciaRepository = evidenciaRepository;
        this.incidenciaRepository = incidenciaRepository;
        this.loteRepository = loteRepository;
        this.productoRepository = productoRepository;
    }

    public DashboardDto.General general(LocalDate desde, LocalDate hasta) {
        LocalDateTime desdeFiltro = desde != null ? desde.atStartOfDay() : EPOCA;
        LocalDateTime hastaFiltro = hasta != null ? hasta.plusDays(1).atStartOfDay() : LocalDateTime.now().plusDays(1);

        long controles = controlRepository.countByFechaHoraBetween(desdeFiltro, hastaFiltro);
        long fueraDeRango = controlRepository.countByResultadoAndFechaHoraBetween(
                Control.Resultado.FUERA_RANGO, desdeFiltro, hastaFiltro);

        DashboardDto.Cumplimiento cumplimiento = new DashboardDto.Cumplimiento(
                controles,
                controles - fueraDeRango,
                fueraDeRango,
                controles == 0 ? 100.0 : redondear((controles - fueraDeRango) * 100.0 / controles),
                despachoRepository.count(),
                despachoRepository.countDespachosSinIncidenciasAbiertas(),
                controlRepository.countDesviacionesEnDespachosActivos(),
                desde,
                hasta);

        DashboardDto.Lotes lotes = new DashboardDto.Lotes(
                loteRepository.count(),
                loteRepository.countByEstado(Lote.Estado.DISPONIBLE),
                loteRepository.countByEstado(Lote.Estado.BLOQUEADO),
                loteRepository.countByEstado(Lote.Estado.EN_TRANSITO),
                loteRepository.countByEstado(Lote.Estado.ENTREGADO),
                loteRepository.countByEstado(Lote.Estado.DESCARTADO),
                loteRepository.findByFechaVencimientoBeforeOrderByFechaVencimientoAsc(
                        LocalDate.now().plusDays(DIAS_POR_VENCER)).size());

        DashboardDto.Incidencias incidencias = new DashboardDto.Incidencias(
                incidenciaRepository.count(),
                incidenciaRepository.countByEstado(Incidencia.Estado.ABIERTA),
                incidenciaRepository.countByEstado(Incidencia.Estado.EN_PROCESO),
                incidenciaRepository.countByEstado(Incidencia.Estado.RESUELTA),
                incidenciaRepository.countByEstado(Incidencia.Estado.CERRADA),
                incidenciaRepository.countByPrioridad(Incidencia.Prioridad.CRITICA),
                incidenciaRepository.countByPrioridad(Incidencia.Prioridad.ALTA),
                redondear(incidenciaRepository.promedioMinutosResolucion()));

        List<DashboardDto.DespachoPorEstado> despachosPorEstado = new ArrayList<>();
        for (Despacho.Estado estado : Despacho.Estado.values()) {
            despachosPorEstado.add(new DashboardDto.DespachoPorEstado(estado,
                    despachoRepository.countByEstado(estado)));
        }

        List<Incidencia> abiertas = incidenciaRepository
                .findByEstadoInOrderByPrioridadDescFechaCreacionAsc(
                        List.of(Incidencia.Estado.ABIERTA, Incidencia.Estado.EN_PROCESO))
                .stream().limit(RECIENTES).toList();

        List<Incidencia> ultimasResueltas = incidenciaRepository
                .findByEstadoOrderByFechaCierreDesc(Incidencia.Estado.RESUELTA)
                .stream().limit(RECIENTES).toList();

        List<Long> ids = new ArrayList<>();
        abiertas.forEach(i -> ids.add(i.getIdIncidencia()));
        ultimasResueltas.forEach(i -> ids.add(i.getIdIncidencia()));
        Map<Long, Long> evidenciasPorIncidencia = contarEvidencias(ids);

        return new DashboardDto.General(
                cumplimiento,
                lotes,
                incidencias,
                despachosPorEstado,
                cumplimientoPorProducto(),
                abiertas.stream()
                        .map(i -> IncidenciaDto.Resumen.of(i, evidenciasPorIncidencia.getOrDefault(i.getIdIncidencia(), 0L)))
                        .toList(),
                ultimasResueltas.stream()
                        .map(i -> IncidenciaDto.Resumen.of(i, evidenciasPorIncidencia.getOrDefault(i.getIdIncidencia(), 0L)))
                        .toList(),
                eventosRecientes().stream().map(EventoDto.Response::toTimeline).toList());
    }

    private List<Evento> eventosRecientes() {
        return eventoRepository.findTop10ByOrderByFechaHoraDescIdEventoDesc();
    }

    private Map<Long, Long> contarEvidencias(List<Long> ids) {
        Map<Long, Long> conteo = new HashMap<>();
        if (ids.isEmpty()) {
            return conteo;
        }
        for (Object[] fila : evidenciaRepository.contarPorIncidencias(ids)) {
            conteo.put(((Number) fila[0]).longValue(), ((Number) fila[1]).longValue());
        }
        return conteo;
    }

    private List<ProductoDto.Cumplimiento> cumplimientoPorProducto() {
        return productoRepository.findConLotes().stream()
                .map(producto -> ProductoDto.Cumplimiento.of(
                        producto.getIdProducto(),
                        producto.getNombre(),
                        controlRepository.countControlesByProducto(producto.getIdProducto()),
                        controlRepository.countDesviacionesByProducto(producto.getIdProducto())))
                .toList();
    }

    private double redondear(double valor) {
        return Math.round(valor * 100.0) / 100.0;
    }

}
