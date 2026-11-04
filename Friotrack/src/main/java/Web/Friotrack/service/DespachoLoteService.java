package Web.Friotrack.service;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

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
import Web.Friotrack.repository.LoteRepository;
import Web.Friotrack.security.UsuarioActualProvider;

@Service
@Transactional
public class DespachoLoteService {

    private final DespachoLoteRepository despachoLoteRepository;
    private final DespachoRepository despachoRepository;
    private final LoteRepository loteRepository;
    private final LoteService loteService;
    private final EventoService eventoService;
    private final UsuarioActualProvider usuarioActual;

    public DespachoLoteService(DespachoLoteRepository despachoLoteRepository,
                               DespachoRepository despachoRepository,
                               LoteRepository loteRepository,
                               LoteService loteService,
                               EventoService eventoService,
                               UsuarioActualProvider usuarioActual) {
        this.despachoLoteRepository = despachoLoteRepository;
        this.despachoRepository = despachoRepository;
        this.loteRepository = loteRepository;
        this.loteService = loteService;
        this.eventoService = eventoService;
        this.usuarioActual = usuarioActual;
    }

    public DespachoDto.Item agregar(Long idDespacho, Long idLote, BigDecimal cantidad) {
        Despacho despacho = despachoRepository.findById(idDespacho)
                .orElseThrow(() -> new NotFoundException("Despacho", idDespacho));
        Lote lote = loteRepository.findById(idLote)
                .orElseThrow(() -> new NotFoundException("Lote", idLote));

        if (despacho.esTerminal()) {
            throw new BusinessRuleException("El despacho " + despacho.getCodigo() + " esta en estado terminal ("
                    + despacho.getEstado() + "): no admite mas lotes");
        }
        if (lote.estaBloqueado()) {
            throw new BusinessRuleException("El lote " + lote.getCodigoLote()
                    + " esta bloqueado y no puede incluirse en un despacho");
        }
        if (lote.getEstado() == Lote.Estado.DESCARTADO || lote.getEstado() == Lote.Estado.ENTREGADO) {
            throw new BusinessRuleException("El lote " + lote.getCodigoLote() + " esta en estado "
                    + lote.getEstado() + " y no puede despacharse");
        }
        if (despachoLoteRepository.existe(idDespacho, idLote)) {
            throw new ConflictException("El lote " + lote.getCodigoLote()
                    + " ya esta asociado al despacho " + despacho.getCodigo());
        }
        if (cantidad == null || cantidad.compareTo(BigDecimal.ZERO) <= 0) {
            throw new BusinessRuleException("La cantidad debe ser mayor que cero");
        }

        BigDecimal pendiente = loteService.cantidadDespachadaPendiente(idLote);
        if (pendiente.add(cantidad).compareTo(lote.getCantidad()) > 0) {
            throw new BusinessRuleException("El lote " + lote.getCodigoLote() + " tiene " + lote.getCantidad()
                    + " " + lote.getUnidad() + " y ya tiene " + pendiente
                    + " comprometido en despachos no terminales");
        }

        DespachoLote item = new DespachoLote();
        item.setDespacho(despacho);
        item.setLote(lote);
        item.setCantidad(cantidad);
        DespachoLote guardado = despachoLoteRepository.save(item);

        Usuario actor = usuarioActual.obtener();
        eventoService.registrar(Evento.Tipo.PREPARACION, lote, despacho, actor,
                "Lote " + lote.getCodigoLote() + " asociado al despacho " + despacho.getCodigo()
                        + " (" + cantidad + " " + lote.getUnidad() + ")");

        if (despacho.getEstado() == Despacho.Estado.PENDIENTE) {
            despacho.setEstado(Despacho.Estado.PREPARACION);
            despachoRepository.save(despacho);
        }

        return DespachoDto.Item.of(guardado);
    }

    public void quitar(Long idDespachoLote) {
        DespachoLote item = despachoLoteRepository.findById(idDespachoLote)
                .orElseThrow(() -> new NotFoundException("DespachoLote", idDespachoLote));

        if (item.getDespacho().esTerminal()) {
            throw new BusinessRuleException("El despacho " + item.getDespacho().getCodigo()
                    + " esta cerrado: no se puede modificar su contenido");
        }

        eventoService.registrar(Evento.Tipo.OTRO, item.getLote(), item.getDespacho(), usuarioActual.obtener(),
                "Lote " + item.getLote().getCodigoLote() + " retirado del despacho "
                        + item.getDespacho().getCodigo());
        despachoLoteRepository.delete(item);
    }

    @Transactional(readOnly = true)
    public List<DespachoDto.Item> porDespacho(Long idDespacho) {
        return despachoLoteRepository.porDespacho(idDespacho).stream().map(DespachoDto.Item::of).toList();
    }

    @Transactional(readOnly = true)
    public List<DespachoLote> porLote(Long idLote) {
        return despachoLoteRepository.porLote(idLote);
    }

    @Transactional(readOnly = true)
    public List<LoteDto.Resumen> resumenPorDespacho(Long idDespacho) {
        return despachoLoteRepository.porDespacho(idDespacho).stream()
                .map(dl -> LoteDto.Resumen.of(dl.getLote())).toList();
    }

    @Transactional(readOnly = true)
    public LocalDateTime primerEnvio(Long idLote) {
        return porLote(idLote).stream()
                .filter(dl -> !dl.getDespacho().esTerminal())
                .map(dl -> dl.getDespacho().getFechaSalida())
                .filter(java.util.Objects::nonNull)
                .min(LocalDateTime::compareTo)
                .orElse(null);
    }

}
