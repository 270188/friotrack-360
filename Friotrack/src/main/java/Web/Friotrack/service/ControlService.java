package Web.Friotrack.service;

import java.time.LocalDateTime;
import java.util.List;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import Web.Friotrack.dto.ControlDto;
import Web.Friotrack.dto.EventoDto;
import Web.Friotrack.entity.Control;
import Web.Friotrack.entity.Despacho;
import Web.Friotrack.entity.Evento;
import Web.Friotrack.entity.Lote;
import Web.Friotrack.entity.Producto;
import Web.Friotrack.entity.Usuario;
import Web.Friotrack.exception.BusinessRuleException;
import Web.Friotrack.exception.NotFoundException;
import Web.Friotrack.repository.ControlRepository;
import Web.Friotrack.repository.DespachoLoteRepository;
import Web.Friotrack.repository.DespachoRepository;
import Web.Friotrack.repository.LoteRepository;
import Web.Friotrack.security.UsuarioActualProvider;
import Web.Friotrack.support.EvaluadorRango;

@Service
@Transactional
public class ControlService {

    private final ControlRepository controlRepository;
    private final DespachoRepository despachoRepository;
    private final DespachoLoteRepository despachoLoteRepository;
    private final LoteRepository loteRepository;
    private final IncidenciaService incidenciaService;
    private final EventoService eventoService;
    private final UsuarioActualProvider usuarioActual;

    public ControlService(ControlRepository controlRepository,
                          DespachoRepository despachoRepository,
                          DespachoLoteRepository despachoLoteRepository,
                          LoteRepository loteRepository,
                          IncidenciaService incidenciaService,
                          EventoService eventoService,
                          UsuarioActualProvider usuarioActual) {
        this.controlRepository = controlRepository;
        this.despachoRepository = despachoRepository;
        this.despachoLoteRepository = despachoLoteRepository;
        this.loteRepository = loteRepository;
        this.incidenciaService = incidenciaService;
        this.eventoService = eventoService;
        this.usuarioActual = usuarioActual;
    }

    public ControlDto.Response registrar(ControlDto.Request request) {
        Despacho despacho = despachoRepository.findById(request.idDespacho())
                .orElseThrow(() -> new NotFoundException("Despacho", request.idDespacho()));
        Lote lote = loteRepository.findById(request.idLote())
                .orElseThrow(() -> new NotFoundException("Lote", request.idLote()));

        if (!despachoLoteRepository.existe(despacho.getIdDespacho(), lote.getIdLote())) {
            throw new BusinessRuleException("El lote " + lote.getCodigoLote()
                    + " no esta asociado al despacho " + despacho.getCodigo());
        }
        if (despacho.esTerminal()) {
            throw new BusinessRuleException("El despacho " + despacho.getCodigo()
                    + " esta cerrado: no admite lecturas");
        }

        Producto producto = lote.getProducto();
        Usuario actor = usuarioActual.obtener();

        Control control = new Control();
        control.setDespacho(despacho);
        control.setLote(lote);
        control.setFechaHora(request.fechaHora() != null ? request.fechaHora() : LocalDateTime.now());
        control.setTemperatura(request.temperatura());
        control.setHumedad(request.humedad());
        control.setObservacion(request.observacion());
        control.setUsuario(actor);
        control.setResultado(EvaluadorRango.evaluar(request.temperatura(), request.humedad(), producto));

        Control guardado = controlRepository.save(control);

        String motivo = EvaluadorRango.motivo(guardado);
        eventoService.registrar(Evento.Tipo.CONTROL, lote, despacho, actor,
                "Lectura " + describir(guardado) + " -> " + guardado.getResultado()
                        + (motivo == null ? "" : " (" + motivo + ")"));

        if (guardado.getResultado() == Control.Resultado.FUERA_RANGO) {
            incidenciaService.registrarDesviacion(guardado, actor);
        }

        return ControlDto.Response.of(guardado);
    }

    @Transactional(readOnly = true)
    public ControlDto.Response obtener(Long id) {
        return ControlDto.Response.of(controlRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Control", id)));
    }

    @Transactional(readOnly = true)
    public List<ControlDto.Response> porDespacho(Long idDespacho) {
        return controlRepository.porDespacho(idDespacho).stream().map(ControlDto.Response::of).toList();
    }

    @Transactional(readOnly = true)
    public List<ControlDto.Response> porLote(Long idLote) {
        return controlRepository.porLote(idLote).stream().map(ControlDto.Response::of).toList();
    }

    @Transactional(readOnly = true)
    public List<ControlDto.Response> porLoteODespacho(Long idLote, Long idDespacho) {
        return controlRepository.porLoteODespacho(idLote, idDespacho).stream()
                .map(ControlDto.Response::of).toList();
    }

    @Transactional(readOnly = true)
    public List<ControlDto.Response> fueraDeRango() {
        return controlRepository.findByResultadoOrderByFechaHoraDesc(Control.Resultado.FUERA_RANGO).stream()
                .map(ControlDto.Response::of).toList();
    }

    private String describir(Control control) {
        StringBuilder lectura = new StringBuilder();
        if (control.getTemperatura() != null) {
            lectura.append(control.getTemperatura()).append(" °C");
        }
        if (control.getHumedad() != null) {
            if (lectura.length() > 0) {
                lectura.append(" / ");
            }
            lectura.append(control.getHumedad()).append(" %");
        }
        return lectura.length() == 0 ? "sin valores" : lectura.toString();
    }

}
