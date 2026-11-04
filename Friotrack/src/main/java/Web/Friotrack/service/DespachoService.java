package Web.Friotrack.service;

import java.time.LocalDateTime;
import java.util.List;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import Web.Friotrack.dto.DespachoDto;
import Web.Friotrack.dto.LoteDto;
import Web.Friotrack.entity.Despacho;
import Web.Friotrack.entity.DespachoLote;
import Web.Friotrack.entity.Evento;
import Web.Friotrack.entity.Lote;
import Web.Friotrack.entity.Usuario;
import Web.Friotrack.exception.BusinessRuleException;
import Web.Friotrack.exception.ConflictException;
import Web.Friotrack.exception.NotFoundException;
import Web.Friotrack.repository.DespachoLoteRepository;
import Web.Friotrack.repository.DespachoRepository;
import Web.Friotrack.security.UsuarioActualProvider;

@Service
@Transactional
public class DespachoService {

    private final DespachoRepository despachoRepository;
    private final DespachoLoteRepository despachoLoteRepository;
    private final DespachoLoteService despachoLoteService;
    private final LoteService loteService;
    private final EventoService eventoService;
    private final UsuarioActualProvider usuarioActual;

    public DespachoService(DespachoRepository despachoRepository,
                           DespachoLoteRepository despachoLoteRepository,
                           DespachoLoteService despachoLoteService,
                           LoteService loteService,
                           EventoService eventoService,
                           UsuarioActualProvider usuarioActual) {
        this.despachoRepository = despachoRepository;
        this.despachoLoteRepository = despachoLoteRepository;
        this.despachoLoteService = despachoLoteService;
        this.loteService = loteService;
        this.eventoService = eventoService;
        this.usuarioActual = usuarioActual;
    }

    public DespachoDto.Response crear(DespachoDto.Request request) {
        if (despachoRepository.existsByCodigo(request.codigo())) {
            throw new ConflictException("Ya existe un despacho con el codigo " + request.codigo());
        }

        Despacho despacho = new Despacho();
        despacho.setCodigo(request.codigo());
        despacho.setUsuario(usuarioActual.obtener());
        aplicar(despacho, request);
        return DespachoDto.Response.of(despachoRepository.save(despacho));
    }

    public DespachoDto.Response actualizar(Long id, DespachoDto.Actualizacion request) {
        Despacho despacho = entidad(id);
        if (despacho.esTerminal()) {
            throw new BusinessRuleException("El despacho " + despacho.getCodigo()
                    + " esta en estado terminal y no admite cambios");
        }
        aplicar(despacho, request);
        return DespachoDto.Response.of(despachoRepository.save(despacho));
    }

    private Despacho entidad(Long id) {
        return despachoRepository.findById(id).orElseThrow(() -> new NotFoundException("Despacho", id));
    }

    @Transactional(readOnly = true)
    public DespachoDto.Response obtener(Long id) {
        return DespachoDto.Response.of(entidad(id));
    }

    @Transactional(readOnly = true)
    public DespachoDto.Response obtenerPorCodigo(String codigo) {
        return DespachoDto.Response.of(despachoRepository.findByCodigo(codigo)
                .orElseThrow(() -> new NotFoundException("No existe un despacho con codigo " + codigo)));
    }

    @Transactional(readOnly = true)
    public Page<DespachoDto.Response> buscar(String q, Despacho.Estado estado, Pageable pageable) {
        return despachoRepository.buscar(q == null || q.isBlank() ? null : q.trim(), estado, pageable)
                .map(DespachoDto.Response::of);
    }

    @Transactional(readOnly = true)
    public List<DespachoDto.Response> porEstado(Despacho.Estado estado) {
        return despachoRepository.findByEstadoOrderByFechaCreacionDesc(estado).stream()
                .map(DespachoDto.Response::of).toList();
    }

    @Transactional(readOnly = true)
    public List<DespachoDto.Response> programadosEntre(LocalDateTime desde, LocalDateTime hasta) {
        return despachoRepository.findByFechaProgramadaBetweenOrderByFechaProgramadaAsc(desde, hasta).stream()
                .map(DespachoDto.Response::of).toList();
    }

    public DespachoDto.Response cambiarEstado(Long id, Despacho.Estado nuevo, String motivo) {
        Despacho despacho = entidad(id);
        Despacho.Estado anterior = despacho.getEstado();

        if (anterior == nuevo) {
            throw new BusinessRuleException("El despacho ya se encuentra en " + nuevo);
        }
        if (despacho.esTerminal()) {
            throw new BusinessRuleException("El despacho " + despacho.getCodigo()
                    + " esta en estado terminal (" + anterior + ")");
        }
        if (nuevo == Despacho.Estado.ENTREGADO && anterior != Despacho.Estado.EN_TRANSITO) {
            throw new BusinessRuleException("Solo un despacho EN_TRANSITO puede marcarse como ENTREGADO");
        }

        validarTransicion(anterior, nuevo);

        Usuario actor = usuarioActual.obtener();
        despacho.setEstado(nuevo);

        switch (nuevo) {
            case EN_TRANSITO -> {
                despacho.setFechaSalida(LocalDateTime.now());
                marcarLotes(despacho, Lote.Estado.EN_TRANSITO);
                eventoService.registrar(Evento.Tipo.SALIDA, null, despacho, actor,
                        "Salida del despacho " + despacho.getCodigo() + " hacia " + despacho.getDestino()
                                + (motivo == null || motivo.isBlank() ? "" : ". " + motivo));
            }
            case ENTREGADO -> {
                despacho.setFechaLlegada(LocalDateTime.now());
                marcarLotes(despacho, Lote.Estado.ENTREGADO);
                eventoService.registrar(Evento.Tipo.ENTREGA, null, despacho, actor,
                        "Entrega del despacho " + despacho.getCodigo() + " en " + despacho.getDestino()
                                + (motivo == null || motivo.isBlank() ? "" : ". " + motivo));
            }
            case CANCELADO -> eventoService.registrar(Evento.Tipo.OTRO, null, despacho, actor,
                    "Despacho cancelado (" + anterior + " -> CANCELADO)"
                            + (motivo == null || motivo.isBlank() ? "" : ". " + motivo));
            default -> eventoService.registrar(Evento.Tipo.OTRO, null, despacho, actor,
                    "Estado del despacho " + despacho.getCodigo() + ": " + anterior + " -> " + nuevo);
        }

        return DespachoDto.Response.of(despachoRepository.save(despacho));
    }

    private void marcarLotes(Despacho despacho, Lote.Estado estado) {
        for (DespachoLote item : despachoLoteRepository.porDespacho(despacho.getIdDespacho())) {
            Lote lote = item.getLote();
            if (estado == Lote.Estado.EN_TRANSITO) {
                loteService.marcarEnTransito(lote);
                eventoService.registrar(Evento.Tipo.SALIDA, lote, despacho, usuarioActual.obtener(),
                        "Lote " + lote.getCodigoLote() + " en salida hacia " + despacho.getDestino()
                                + " (despacho " + despacho.getCodigo() + ")");
            } else if (lote.getEstado() != Lote.Estado.BLOQUEADO && lote.getEstado() != Lote.Estado.DESCARTADO) {
                loteService.marcarEntregado(lote);
                eventoService.registrar(Evento.Tipo.ENTREGA, lote, despacho, usuarioActual.obtener(),
                        "Lote " + lote.getCodigoLote() + " entregado en " + despacho.getDestino());
            }
        }
    }

    private void validarTransicion(Despacho.Estado anterior, Despacho.Estado nuevo) {
        boolean valida = switch (anterior) {
            case PENDIENTE -> nuevo == Despacho.Estado.PREPARACION
                    || nuevo == Despacho.Estado.EN_TRANSITO
                    || nuevo == Despacho.Estado.CANCELADO;
            case PREPARACION -> nuevo == Despacho.Estado.EN_TRANSITO || nuevo == Despacho.Estado.CANCELADO;
            case EN_TRANSITO -> nuevo == Despacho.Estado.ENTREGADO || nuevo == Despacho.Estado.CANCELADO;
            default -> false;
        };
        if (!valida) {
            throw new BusinessRuleException("Transicion de despacho invalida: " + anterior + " -> " + nuevo);
        }
    }

    private void aplicar(Despacho despacho, DespachoDto.Request request) {
        despacho.setTransportista(request.transportista());
        despacho.setVehiculo(request.vehiculo());
        despacho.setPlaca(request.placa());
        despacho.setDestino(request.destino());
        despacho.setDireccionDestino(request.direccionDestino());
        despacho.setContactoDestino(request.contactoDestino());
        despacho.setFechaProgramada(request.fechaProgramada());
        despacho.setObservacion(request.observacion());
    }

    private void aplicar(Despacho despacho, DespachoDto.Actualizacion request) {
        if (request.transportista() != null) {
            despacho.setTransportista(request.transportista());
        }
        if (request.vehiculo() != null) {
            despacho.setVehiculo(request.vehiculo());
        }
        if (request.placa() != null) {
            despacho.setPlaca(request.placa());
        }
        if (request.destino() != null) {
            despacho.setDestino(request.destino());
        }
        if (request.direccionDestino() != null) {
            despacho.setDireccionDestino(request.direccionDestino());
        }
        if (request.contactoDestino() != null) {
            despacho.setContactoDestino(request.contactoDestino());
        }
        if (request.fechaProgramada() != null) {
            despacho.setFechaProgramada(request.fechaProgramada());
        }
        if (request.observacion() != null) {
            despacho.setObservacion(request.observacion());
        }
    }

}
