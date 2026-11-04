package Web.Friotrack.service;

import java.time.LocalDateTime;
import java.util.List;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import Web.Friotrack.dto.EventoDto;
import Web.Friotrack.entity.Despacho;
import Web.Friotrack.entity.Evento;
import Web.Friotrack.entity.Lote;
import Web.Friotrack.entity.Usuario;
import Web.Friotrack.exception.BusinessRuleException;
import Web.Friotrack.exception.NotFoundException;
import Web.Friotrack.repository.DespachoRepository;
import Web.Friotrack.repository.EventoRepository;
import Web.Friotrack.repository.LoteRepository;

@Service
@Transactional
public class EventoService {

    private final EventoRepository eventoRepository;
    private final LoteRepository loteRepository;
    private final DespachoRepository despachoRepository;

    public EventoService(EventoRepository eventoRepository,
                         LoteRepository loteRepository,
                         DespachoRepository despachoRepository) {
        this.eventoRepository = eventoRepository;
        this.loteRepository = loteRepository;
        this.despachoRepository = despachoRepository;
    }

    public Evento registrar(Evento.Tipo tipo, Lote lote, Despacho despacho, Usuario usuario,
                            String descripcion, String ubicacion) {
        Evento evento = new Evento();
        evento.setTipo(tipo);
        evento.setLote(lote);
        evento.setDespacho(despacho);
        evento.setUsuario(usuario);
        evento.setDescripcion(descripcion);
        evento.setUbicacion(ubicacion);
        return eventoRepository.save(evento);
    }

    public Evento registrar(Evento.Tipo tipo, Lote lote, Despacho despacho, Usuario usuario, String descripcion) {
        return registrar(tipo, lote, despacho, usuario, descripcion, null);
    }

    public EventoDto.Response crear(EventoDto.Request request, Usuario usuario) {
        if (request.idLote() == null && request.idDespacho() == null) {
            throw new BusinessRuleException("Un evento debe estar anclado a un lote o a un despacho");
        }

        Evento evento = new Evento();
        evento.setTipo(request.tipo());
        evento.setUsuario(usuario);
        evento.setDescripcion(request.descripcion());
        evento.setUbicacion(request.ubicacion());
        evento.setFechaHora(request.fechaHora() != null ? request.fechaHora() : LocalDateTime.now());

        if (request.idLote() != null) {
            evento.setLote(loteRepository.findById(request.idLote())
                    .orElseThrow(() -> new NotFoundException("Lote", request.idLote())));
        }
        if (request.idDespacho() != null) {
            evento.setDespacho(despachoRepository.findById(request.idDespacho())
                    .orElseThrow(() -> new NotFoundException("Despacho", request.idDespacho())));
        }

        return EventoDto.Response.of(eventoRepository.save(evento));
    }

    @Transactional(readOnly = true)
    public List<EventoDto.Timeline> timelineLote(Long idLote) {
        return eventoRepository.porLote(idLote).stream().map(EventoDto.Response::toTimeline).toList();
    }

    @Transactional(readOnly = true)
    public List<EventoDto.Timeline> timelineDespacho(Long idDespacho) {
        return eventoRepository.porDespacho(idDespacho).stream().map(EventoDto.Response::toTimeline).toList();
    }

    @Transactional(readOnly = true)
    public List<EventoDto.Response> porTipo(Evento.Tipo tipo) {
        return eventoRepository.findByTipoOrderByFechaHoraDesc(tipo).stream()
                .map(EventoDto.Response::of).toList();
    }

    @Transactional(readOnly = true)
    public org.springframework.data.domain.Page<EventoDto.Response> buscar(Long idLote, Long idDespacho,
                                                                          Evento.Tipo tipo, LocalDateTime desde,
                                                                          LocalDateTime hasta,
                                                                          org.springframework.data.domain.Pageable pageable) {
        return eventoRepository.buscar(idLote, idDespacho, tipo, desde, hasta, pageable)
                .map(EventoDto.Response::of);
    }

}
