package Web.Friotrack.service;

import java.util.List;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import Web.Friotrack.dto.ProductoDto;
import Web.Friotrack.dto.TrazabilidadDto;
import Web.Friotrack.entity.Despacho;
import Web.Friotrack.entity.DespachoLote;
import Web.Friotrack.entity.Lote;
import Web.Friotrack.exception.NotFoundException;
import Web.Friotrack.repository.DespachoRepository;
import Web.Friotrack.repository.LoteRepository;

@Service
@Transactional(readOnly = true)
public class TrazabilidadService {

    private final LoteRepository loteRepository;
    private final DespachoRepository despachoRepository;
    private final ControlService controlService;
    private final IncidenciaService incidenciaService;
    private final EvidenciaService evidenciaService;
    private final EventoService eventoService;
    private final DespachoLoteService despachoLoteService;

    public TrazabilidadService(LoteRepository loteRepository,
                               DespachoRepository despachoRepository,
                               ControlService controlService,
                               IncidenciaService incidenciaService,
                               EvidenciaService evidenciaService,
                               EventoService eventoService,
                               DespachoLoteService despachoLoteService) {
        this.loteRepository = loteRepository;
        this.despachoRepository = despachoRepository;
        this.controlService = controlService;
        this.incidenciaService = incidenciaService;
        this.evidenciaService = evidenciaService;
        this.eventoService = eventoService;
        this.despachoLoteService = despachoLoteService;
    }

    public TrazabilidadDto.LoteView porLote(Long idLote) {
        Lote lote = loteRepository.findById(idLote).orElseThrow(() -> new NotFoundException("Lote", idLote));

        List<TrazabilidadDto.DespachoRef> despachos = despachoLoteService.porLote(idLote).stream()
                .map(this::aDespachoRef)
                .toList();

        return new TrazabilidadDto.LoteView(
                lote.getIdLote(),
                lote.getCodigoLote(),
                ProductoDto.Response.of(lote.getProducto()),
                lote.getCantidad(),
                lote.getUnidad(),
                lote.getEstado(),
                lote.getFechaProduccion(),
                lote.getFechaVencimiento(),
                lote.isVencido(),
                despachos,
                controlService.porLote(idLote),
                incidenciaService.resumenPorLote(idLote),
                evidenciaService.resumenPorLote(idLote),
                eventoService.timelineLote(idLote));
    }

    public TrazabilidadDto.DespachoView porDespacho(Long idDespacho) {
        Despacho despacho = despachoRepository.findById(idDespacho)
                .orElseThrow(() -> new NotFoundException("Despacho", idDespacho));

        return new TrazabilidadDto.DespachoView(
                despacho.getIdDespacho(),
                despacho.getCodigo(),
                despacho.getTransportista(),
                despacho.getVehiculo(),
                despacho.getPlaca(),
                despacho.getDestino(),
                despacho.getEstado(),
                despacho.getFechaProgramada(),
                despacho.getFechaSalida(),
                despacho.getFechaLlegada(),
                despacho.getUsuario().getUsername(),
                despachoLoteService.resumenPorDespacho(idDespacho),
                controlService.porDespacho(idDespacho),
                incidenciaService.resumenPorDespacho(idDespacho),
                evidenciaService.resumenPorDespacho(idDespacho),
                eventoService.timelineDespacho(idDespacho));
    }

    private TrazabilidadDto.DespachoRef aDespachoRef(DespachoLote vinculo) {
        Despacho despacho = vinculo.getDespacho();
        return new TrazabilidadDto.DespachoRef(
                despacho.getIdDespacho(),
                despacho.getCodigo(),
                despacho.getEstado(),
                despacho.getDestino(),
                vinculo.getCantidad(),
                despacho.getFechaProgramada(),
                despacho.getFechaSalida(),
                despacho.getFechaLlegada());
    }

}