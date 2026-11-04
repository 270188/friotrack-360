package Web.Friotrack.service;

import java.time.LocalDateTime;
import java.util.List;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import Web.Friotrack.dto.EvidenciaDto;
import Web.Friotrack.dto.IncidenciaDto;
import Web.Friotrack.entity.Control;
import Web.Friotrack.entity.Evento;
import Web.Friotrack.entity.Incidencia;
import Web.Friotrack.entity.Usuario;
import Web.Friotrack.exception.BusinessRuleException;
import Web.Friotrack.exception.NotFoundException;
import Web.Friotrack.repository.ControlRepository;
import Web.Friotrack.repository.EvidenciaRepository;
import Web.Friotrack.repository.IncidenciaRepository;
import Web.Friotrack.repository.DespachoRepository;
import Web.Friotrack.repository.LoteRepository;
import Web.Friotrack.repository.UsuarioRepository;
import Web.Friotrack.security.UsuarioActualProvider;
import Web.Friotrack.support.EvaluadorRango;

@Service
@Transactional
public class IncidenciaService {

    private final IncidenciaRepository incidenciaRepository;
    private final ControlRepository controlRepository;
    private final EvidenciaRepository evidenciaRepository;
    private final LoteRepository loteRepository;
    private final DespachoRepository despachoRepository;
    private final UsuarioRepository usuarioRepository;
    private final EventoService eventoService;
    private final UsuarioActualProvider usuarioActual;

    public IncidenciaService(IncidenciaRepository incidenciaRepository,
                             ControlRepository controlRepository,
                             EvidenciaRepository evidenciaRepository,
                             LoteRepository loteRepository,
                             DespachoRepository despachoRepository,
                             UsuarioRepository usuarioRepository,
                             EventoService eventoService,
                             UsuarioActualProvider usuarioActual) {
        this.incidenciaRepository = incidenciaRepository;
        this.controlRepository = controlRepository;
        this.evidenciaRepository = evidenciaRepository;
        this.loteRepository = loteRepository;
        this.despachoRepository = despachoRepository;
        this.usuarioRepository = usuarioRepository;
        this.eventoService = eventoService;
        this.usuarioActual = usuarioActual;
    }

    /**
     * Se invoca desde ControlService cuando una lectura resulta FUERA_RANGO.
     */
    Incidencia registrarDesviacion(Control control, Usuario actor) {
        String motivo = EvaluadorRango.motivo(control);

        Incidencia incidencia = new Incidencia();
        incidencia.setControl(control);
        incidencia.setLote(control.getLote());
        incidencia.setDespacho(control.getDespacho());
        incidencia.setTipo(determinarTipo(control));
        incidencia.setDescripcion(motivo != null ? motivo
                : "Lectura fuera de rango registrada en el control " + control.getIdControl());
        incidencia.setPrioridad(Incidencia.Prioridad.ALTA);
        incidencia.setEstado(Incidencia.Estado.ABIERTA);
        incidencia.setResponsable(actor);

        Incidencia guardada = incidenciaRepository.save(incidencia);

        eventoService.registrar(Evento.Tipo.OTRO, control.getLote(), control.getDespacho(), actor,
                "Incidencia " + guardada.getIdIncidencia() + " abierta automaticamente (" + guardada.getTipo()
                        + ", " + guardada.getPrioridad() + "): " + guardada.getDescripcion());

        return guardada;
    }

    public IncidenciaDto.Response crear(IncidenciaDto.Request request) {
        Incidencia incidencia = new Incidencia();

        if (request.idControl() != null) {
            Control control = controlRepository.findById(request.idControl())
                    .orElseThrow(() -> new NotFoundException("Control", request.idControl()));
            incidencia.setControl(control);
            incidencia.setLote(control.getLote());
            incidencia.setDespacho(control.getDespacho());
        } else {
            incidencia.setLote(loteRepository.findById(request.idLote())
                    .orElseThrow(() -> new NotFoundException("Lote", request.idLote())));
            if (request.idDespacho() != null) {
                incidencia.setDespacho(despachoRepository.findById(request.idDespacho())
                        .orElseThrow(() -> new NotFoundException("Despacho", request.idDespacho())));
            }
        }

        incidencia.setTipo(request.tipo() != null ? request.tipo() : Incidencia.Tipo.OTRA);
        incidencia.setDescripcion(request.descripcion());
        incidencia.setPrioridad(request.prioridad() != null ? request.prioridad() : Incidencia.Prioridad.MEDIA);
        incidencia.setResponsable(resolverResponsable(request.idResponsable()));

        Incidencia guardada = incidenciaRepository.save(incidencia);
        eventoService.registrar(Evento.Tipo.OTRO, guardada.getLote(), guardada.getDespacho(), usuarioActual.obtener(),
                "Incidencia " + guardada.getIdIncidencia() + " creada (" + guardada.getTipo() + ", "
                        + guardada.getPrioridad() + "): " + guardada.getDescripcion());
        return conEvidencias(guardada);
    }

    public IncidenciaDto.Response actualizar(Long id, IncidenciaDto.Actualizacion request) {
        Incidencia incidencia = entidad(id);

        if (request.tipo() != null) {
            incidencia.setTipo(request.tipo());
        }
        if (request.descripcion() != null) {
            incidencia.setDescripcion(request.descripcion());
        }
        if (request.prioridad() != null) {
            incidencia.setPrioridad(request.prioridad());
        }
        if (request.causa() != null) {
            incidencia.setCausa(request.causa());
        }
        if (request.accion() != null) {
            incidencia.setAccion(request.accion());
        }
        if (request.idResponsable() != null) {
            incidencia.setResponsable(resolverResponsable(request.idResponsable()));
        }

        return conEvidencias(incidenciaRepository.save(incidencia));
    }

    public IncidenciaDto.Response cambiarEstado(Long id, IncidenciaDto.CambioEstado request) {
        Incidencia incidencia = entidad(id);
        Incidencia.Estado anterior = incidencia.getEstado();
        Incidencia.Estado nuevo = request.estado();

        if (anterior == nuevo) {
            throw new BusinessRuleException("La incidencia ya se encuentra en estado " + nuevo);
        }
        if (!esTransicionValida(anterior, nuevo)) {
            throw new BusinessRuleException("Transicion de incidencia invalida: " + anterior + " -> " + nuevo);
        }
        if ((nuevo == Incidencia.Estado.RESUELTA || nuevo == Incidencia.Estado.CERRADA)
                && incidencia.getCausa() == null && request.causa() == null) {
            throw new BusinessRuleException("Para resolver o cerrar la incidencia debe registrar la causa");
        }

        if (request.causa() != null) {
            incidencia.setCausa(request.causa());
        }
        if (request.accion() != null) {
            incidencia.setAccion(request.accion());
        }
        if (request.idResponsable() != null) {
            incidencia.setResponsable(resolverResponsable(request.idResponsable()));
        }

        incidencia.setEstado(nuevo);
        incidencia.setFechaCierre(nuevo == Incidencia.Estado.RESUELTA || nuevo == Incidencia.Estado.CERRADA
                ? LocalDateTime.now()
                : null);

        Incidencia guardada = incidenciaRepository.save(incidencia);

        eventoService.registrar(Evento.Tipo.OTRO, guardada.getLote(), guardada.getDespacho(), usuarioActual.obtener(),
                "Incidencia " + guardada.getIdIncidencia() + ": " + anterior + " -> " + nuevo
                        + (request.motivo() == null || request.motivo().isBlank() ? "" : ". " + request.motivo()));

        return conEvidencias(guardada);
    }

    private Incidencia entidad(Long id) {
        return incidenciaRepository.findById(id).orElseThrow(() -> new NotFoundException("Incidencia", id));
    }

    @Transactional(readOnly = true)
    public IncidenciaDto.Response obtener(Long id) {
        return conEvidencias(entidad(id));
    }

    @Transactional(readOnly = true)
    public List<IncidenciaDto.Resumen> porEstado(Incidencia.Estado estado) {
        return resumen(incidenciaRepository.findByEstadoOrderByPrioridadDescFechaCreacionAsc(estado));
    }

    @Transactional(readOnly = true)
    public List<IncidenciaDto.Response> abiertas() {
        return incidenciaRepository.findByEstadoInOrderByPrioridadDescFechaCreacionAsc(
                        List.of(Incidencia.Estado.ABIERTA, Incidencia.Estado.EN_PROCESO)).stream()
                .map(this::conEvidencias).toList();
    }

    @Transactional(readOnly = true)
    public List<IncidenciaDto.Resumen> resumenPorLote(Long idLote) {
        return resumen(incidenciaRepository.porLote(idLote));
    }

    @Transactional(readOnly = true)
    public List<IncidenciaDto.Resumen> resumenPorDespacho(Long idDespacho) {
        return resumen(incidenciaRepository.porDespacho(idDespacho));
    }

    @Transactional(readOnly = true)
    public List<IncidenciaDto.Resumen> resumenPorTipo(Incidencia.Tipo tipo) {
        return resumen(incidenciaRepository.findByTipoOrderByFechaCreacionDesc(tipo));
    }

    @Transactional(readOnly = true)
    public List<IncidenciaDto.Response> porDespacho(Long idDespacho) {
        return incidenciaRepository.porDespacho(idDespacho).stream().map(this::conEvidencias).toList();
    }

    @Transactional(readOnly = true)
    public List<IncidenciaDto.Response> porTipo(Incidencia.Tipo tipo) {
        return incidenciaRepository.findByTipoOrderByFechaCreacionDesc(tipo).stream()
                .map(this::conEvidencias).toList();
    }

    @Transactional(readOnly = true)
    public long evidencias(Long idIncidencia) {
        return evidenciaRepository.contarPorIncidencia(idIncidencia);
    }

    private List<IncidenciaDto.Resumen> resumen(List<Incidencia> incidencias) {
        return incidencias.stream()
                .map(i -> IncidenciaDto.Resumen.of(i, evidenciaRepository.contarPorIncidencia(i.getIdIncidencia())))
                .toList();
    }

    public IncidenciaDto.Response conEvidencias(Incidencia incidencia) {
        return IncidenciaDto.Response.of(incidencia,
                evidenciaRepository.porIncidencia(incidencia.getIdIncidencia()).stream()
                        .map(EvidenciaDto.Response::of).toList());
    }

    private Incidencia.Tipo determinarTipo(Control control) {
        ProductoRango rango = ProductoRango.de(control);
        boolean fueraTemperatura = EvaluadorRango.fueraDeRango(control.getTemperatura(),
                rango.temperaturaMin(), rango.temperaturaMax());
        boolean fueraHumedad = EvaluadorRango.fueraDeRango(control.getHumedad(),
                rango.humedadMin(), rango.humedadMax());

        if (fueraTemperatura && !fueraHumedad) {
            return Incidencia.Tipo.TEMPERATURA;
        }
        if (fueraHumedad && !fueraTemperatura) {
            return Incidencia.Tipo.HUMEDAD;
        }
        return Incidencia.Tipo.OTRA;
    }

    private Usuario resolverResponsable(Long idResponsable) {
        if (idResponsable == null) {
            return usuarioActual.obtener();
        }
        return usuarioRepository.findById(idResponsable)
                .orElseThrow(() -> new NotFoundException("Usuario responsable", idResponsable));
    }

    private boolean esTransicionValida(Incidencia.Estado anterior, Incidencia.Estado nuevo) {
        return switch (anterior) {
            case ABIERTA -> nuevo == Incidencia.Estado.EN_PROCESO
                    || nuevo == Incidencia.Estado.RESUELTA
                    || nuevo == Incidencia.Estado.CERRADA;
            case EN_PROCESO -> nuevo == Incidencia.Estado.RESUELTA || nuevo == Incidencia.Estado.CERRADA;
            case RESUELTA -> nuevo == Incidencia.Estado.CERRADA || nuevo == Incidencia.Estado.EN_PROCESO;
            default -> false;
        };
    }

    private record ProductoRango(java.math.BigDecimal temperaturaMin, java.math.BigDecimal temperaturaMax,
                                  java.math.BigDecimal humedadMin, java.math.BigDecimal humedadMax) {

        static ProductoRango de(Control control) {
            var producto = control.getLote().getProducto();
            return new ProductoRango(producto.getTemperaturaMin(), producto.getTemperaturaMax(),
                    producto.getHumedadMin(), producto.getHumedadMax());
        }
    }

}
