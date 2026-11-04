package Web.Friotrack.service;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import Web.Friotrack.dto.LoteDto;
import Web.Friotrack.entity.Evento;
import Web.Friotrack.entity.Lote;
import Web.Friotrack.entity.Producto;
import Web.Friotrack.entity.Usuario;
import Web.Friotrack.exception.BusinessRuleException;
import Web.Friotrack.exception.ConflictException;
import Web.Friotrack.exception.NotFoundException;
import Web.Friotrack.repository.DespachoLoteRepository;
import Web.Friotrack.repository.LoteRepository;
import Web.Friotrack.repository.ProductoRepository;
import Web.Friotrack.security.UsuarioActualProvider;

@Service
@Transactional
public class LoteService {

    private final LoteRepository loteRepository;
    private final ProductoRepository productoRepository;
    private final DespachoLoteRepository despachoLoteRepository;
    private final EventoService eventoService;
    private final UsuarioActualProvider usuarioActual;

    public LoteService(LoteRepository loteRepository,
                       ProductoRepository productoRepository,
                       DespachoLoteRepository despachoLoteRepository,
                       EventoService eventoService,
                       UsuarioActualProvider usuarioActual) {
        this.loteRepository = loteRepository;
        this.productoRepository = productoRepository;
        this.despachoLoteRepository = despachoLoteRepository;
        this.eventoService = eventoService;
        this.usuarioActual = usuarioActual;
    }

    public LoteDto.Response crear(LoteDto.Request request) {
        Producto producto = productoRepository.findById(request.idProducto())
                .orElseThrow(() -> new NotFoundException("Producto", request.idProducto()));

        if (loteRepository.existsByCodigoLote(request.codigoLote())) {
            throw new ConflictException("Ya existe un lote con el codigo " + request.codigoLote());
        }

        validarFechas(request.fechaProduccion(), request.fechaVencimiento());

        Lote lote = new Lote();
        lote.setProducto(producto);
        lote.setCodigoLote(request.codigoLote());
        lote.setFechaProduccion(request.fechaProduccion());
        lote.setFechaVencimiento(request.fechaVencimiento());
        lote.setCantidad(request.cantidad());
        if (request.unidad() != null && !request.unidad().isBlank()) {
            lote.setUnidad(request.unidad());
        }
        if (request.estado() != null) {
            lote.setEstado(request.estado());
        }

        Lote guardado = loteRepository.save(lote);
        eventoService.registrar(Evento.Tipo.CREACION_LOTE, guardado, null, usuarioActual.obtener(),
                "Lote " + guardado.getCodigoLote() + " creado con " + guardado.getCantidad() + " "
                        + guardado.getUnidad() + " de " + producto.getNombre());
        return LoteDto.Response.of(guardado);
    }

    public LoteDto.Response actualizar(Long id, LoteDto.Actualizacion request) {
        Lote lote = entidad(id);
        validarFechas(request.fechaProduccion() != null ? request.fechaProduccion() : lote.getFechaProduccion(),
                request.fechaVencimiento() != null ? request.fechaVencimiento() : lote.getFechaVencimiento());

        if (request.fechaProduccion() != null) {
            lote.setFechaProduccion(request.fechaProduccion());
        }
        if (request.fechaVencimiento() != null) {
            lote.setFechaVencimiento(request.fechaVencimiento());
        }
        if (request.cantidad() != null) {
            lote.setCantidad(request.cantidad());
        }
        if (request.unidad() != null && !request.unidad().isBlank()) {
            lote.setUnidad(request.unidad());
        }
        return LoteDto.Response.of(loteRepository.save(lote));
    }

    private Lote entidad(Long id) {
        return loteRepository.findById(id).orElseThrow(() -> new NotFoundException("Lote", id));
    }

    @Transactional(readOnly = true)
    public LoteDto.Response obtener(Long id) {
        return LoteDto.Response.of(entidad(id));
    }

    @Transactional(readOnly = true)
    public LoteDto.Response obtenerPorCodigo(String codigo) {
        return LoteDto.Response.of(loteRepository.findByCodigoLote(codigo)
                .orElseThrow(() -> new NotFoundException("No existe un lote con codigo " + codigo)));
    }

    @Transactional(readOnly = true)
    public Page<LoteDto.Response> buscar(String q, Lote.Estado estado, Long idProducto, Pageable pageable) {
        return loteRepository.buscar(normalizar(q), estado, idProducto, pageable).map(LoteDto.Response::of);
    }

    @Transactional(readOnly = true)
    public List<LoteDto.Response> porEstado(Lote.Estado estado) {
        return loteRepository.findByEstadoOrderByFechaCreacionDesc(estado).stream()
                .map(LoteDto.Response::of).toList();
    }

    @Transactional(readOnly = true)
    public List<LoteDto.Response> porProducto(Long idProducto) {
        return loteRepository.porProducto(idProducto).stream().map(LoteDto.Response::of).toList();
    }

    @Transactional(readOnly = true)
    public List<LoteDto.Response> porVencer(LocalDate limite) {
        return loteRepository.findByFechaVencimientoBeforeOrderByFechaVencimientoAsc(limite).stream()
                .map(LoteDto.Response::of).toList();
    }

    public LoteDto.Response bloquear(Long id, String motivo) {
        Lote lote = entidad(id);
        if (lote.estaBloqueado()) {
            throw new BusinessRuleException("El lote " + lote.getCodigoLote() + " ya esta bloqueado");
        }
        if (lote.getEstado() == Lote.Estado.ENTREGADO || lote.getEstado() == Lote.Estado.DESCARTADO) {
            throw new BusinessRuleException("El lote " + lote.getCodigoLote() + " esta en un estado terminal ("
                    + lote.getEstado() + ") y no puede bloquearse");
        }

        Lote.Estado anterior = lote.getEstado();
        lote.setEstado(Lote.Estado.BLOQUEADO);
        Lote guardado = loteRepository.save(lote);

        Usuario actor = usuarioActual.obtener();
        eventoService.registrar(Evento.Tipo.BLOQUEO_LOTE, guardado, null, actor,
                "Lote bloqueado (" + anterior + " -> BLOQUEADO). Motivo: "
                        + (motivo == null || motivo.isBlank() ? "no indicado" : motivo));
        return LoteDto.Response.of(guardado);
    }

    public LoteDto.Response liberar(Long id, String motivo) {
        Lote lote = entidad(id);
        if (!lote.estaBloqueado()) {
            throw new BusinessRuleException("El lote " + lote.getCodigoLote() + " no esta bloqueado");
        }

        lote.setEstado(Lote.Estado.DISPONIBLE);
        Lote guardado = loteRepository.save(lote);

        Usuario actor = usuarioActual.obtener();
        eventoService.registrar(Evento.Tipo.LIBERACION_LOTE, guardado, null, actor,
                "Lote liberado (BLOQUEADO -> DISPONIBLE) por " + actor.getUsername()
                        + ". Motivo: " + (motivo == null || motivo.isBlank() ? "no indicado" : motivo));
        return LoteDto.Response.of(guardado);
    }

    public LoteDto.Response descartar(Long id, String motivo) {
        Lote lote = entidad(id);
        if (lote.getEstado() == Lote.Estado.DESCARTADO) {
            throw new BusinessRuleException("El lote " + lote.getCodigoLote() + " ya fue descartado");
        }

        lote.setEstado(Lote.Estado.DESCARTADO);
        Lote guardado = loteRepository.save(lote);

        eventoService.registrar(Evento.Tipo.DESCARTE_LOTE, guardado, null, usuarioActual.obtener(),
                "Lote descartado. Motivo: " + (motivo == null || motivo.isBlank() ? "no indicado" : motivo));
        return LoteDto.Response.of(guardado);
    }

    public void marcarEnTransito(Lote lote) {
        if (lote.getEstado() == Lote.Estado.BLOQUEADO) {
            throw new BusinessRuleException("El lote " + lote.getCodigoLote() + " esta bloqueado: no puede enviarse");
        }
        lote.setEstado(Lote.Estado.EN_TRANSITO);
        loteRepository.save(lote);
    }

    public void marcarEntregado(Lote lote) {
        lote.setEstado(Lote.Estado.ENTREGADO);
        loteRepository.save(lote);
    }

    @Transactional(readOnly = true)
    public BigDecimal cantidadDespachadaPendiente(Long idLote) {
        return despachoLoteRepository.cantidadPendiente(idLote);
    }

    private void validarFechas(LocalDate produccion, LocalDate vencimiento) {
        if (produccion != null && vencimiento != null && produccion.isAfter(vencimiento)) {
            throw new BusinessRuleException("fechaProduccion no puede ser posterior a fechaVencimiento");
        }
    }

    private String normalizar(String q) {
        return q == null || q.isBlank() ? null : q.trim();
    }

}
