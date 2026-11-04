package Web.Friotrack.service;

import java.util.List;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import Web.Friotrack.dto.EvidenciaDto;
import Web.Friotrack.entity.Evidencia;
import Web.Friotrack.entity.Incidencia;
import Web.Friotrack.exception.NotFoundException;
import Web.Friotrack.repository.EvidenciaRepository;
import Web.Friotrack.repository.IncidenciaRepository;
import Web.Friotrack.security.UsuarioActualProvider;

@Service
@Transactional
public class EvidenciaService {

    private final EvidenciaRepository evidenciaRepository;
    private final IncidenciaRepository incidenciaRepository;
    private final EventoService eventoService;
    private final UsuarioActualProvider usuarioActual;

    public EvidenciaService(EvidenciaRepository evidenciaRepository,
                            IncidenciaRepository incidenciaRepository,
                            EventoService eventoService,
                            UsuarioActualProvider usuarioActual) {
        this.evidenciaRepository = evidenciaRepository;
        this.incidenciaRepository = incidenciaRepository;
        this.eventoService = eventoService;
        this.usuarioActual = usuarioActual;
    }

    public EvidenciaDto.Response registrar(Long idIncidencia, EvidenciaDto.Request request) {
        Incidencia incidencia = incidenciaRepository.findById(idIncidencia)
                .orElseThrow(() -> new NotFoundException("Incidencia", idIncidencia));

        Evidencia evidencia = new Evidencia();
        evidencia.setIncidencia(incidencia);
        evidencia.setTipo(request.tipo());
        evidencia.setNombreArchivo(request.nombreArchivo());
        evidencia.setUrl(request.url());
        evidencia.setDescripcion(request.descripcion());
        evidencia.setUsuario(usuarioActual.obtener());

        Evidencia guardada = evidenciaRepository.save(evidencia);

        eventoService.registrar(Web.Friotrack.entity.Evento.Tipo.OTRO, incidencia.getLote(),
                incidencia.getDespacho(), guardada.getUsuario(),
                "Evidencia " + guardada.getIdEvidencia() + " (" + guardada.getTipo()
                        + ") adjunta a la incidencia " + incidencia.getIdIncidencia() + ": "
                        + guardada.getNombreArchivo());

        return EvidenciaDto.Response.of(guardada);
    }

    public void eliminar(Long idEvidencia) {
        evidenciaRepository.delete(evidenciaRepository.findById(idEvidencia)
                .orElseThrow(() -> new NotFoundException("Evidencia", idEvidencia)));
    }

    @Transactional(readOnly = true)
    public EvidenciaDto.Response obtener(Long id) {
        return EvidenciaDto.Response.of(evidenciaRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Evidencia", id)));
    }

    @Transactional(readOnly = true)
    public List<EvidenciaDto.Response> porIncidencia(Long idIncidencia) {
        return evidenciaRepository.porIncidencia(idIncidencia).stream().map(EvidenciaDto.Response::of).toList();
    }

    @Transactional(readOnly = true)
    public List<EvidenciaDto.Response> porLote(Long idLote) {
        return evidenciaDeLote(idLote).stream().map(EvidenciaDto.Response::of).toList();
    }

    @Transactional(readOnly = true)
    public List<EvidenciaDto.Resumen> resumenPorLote(Long idLote) {
        return evidenciaDeLote(idLote).stream().map(this::aResumen).toList();
    }

    @Transactional(readOnly = true)
    public List<EvidenciaDto.Resumen> resumenPorDespacho(Long idDespacho) {
        return incidenciaRepository.porDespacho(idDespacho).stream()
                .flatMap(i -> evidenciaRepository.porIncidencia(i.getIdIncidencia()).stream())
                .map(this::aResumen)
                .toList();
    }

    private List<Evidencia> evidenciaDeLote(Long idLote) {
        return incidenciaRepository.porLote(idLote).stream()
                .flatMap(i -> evidenciaRepository.porIncidencia(i.getIdIncidencia()).stream())
                .toList();
    }

    private EvidenciaDto.Resumen aResumen(Evidencia evidencia) {
        return EvidenciaDto.Resumen.of(evidencia, evidencia.getIncidencia().getLote().getCodigoLote());
    }

    @Transactional(readOnly = true)
    public List<EvidenciaDto.Response> porDespacho(Long idDespacho) {
        return incidenciaRepository.porDespacho(idDespacho).stream()
                .flatMap(i -> evidenciaRepository.porIncidencia(i.getIdIncidencia()).stream())
                .map(EvidenciaDto.Response::of)
                .toList();
    }

}
