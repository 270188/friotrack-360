package Web.Friotrack.controller;

import java.time.LocalDateTime;
import java.util.List;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import jakarta.validation.Valid;
import Web.Friotrack.dto.EventoDto;
import Web.Friotrack.entity.Evento;
import Web.Friotrack.security.UsuarioActualProvider;
import Web.Friotrack.service.EventoService;

@RestController
@RequestMapping("/api/evento")
public class EventoController {

    private final EventoService eventoService;
    private final UsuarioActualProvider usuarioActual;

    public EventoController(EventoService eventoService, UsuarioActualProvider usuarioActual) {
        this.eventoService = eventoService;
        this.usuarioActual = usuarioActual;
    }

    @GetMapping
    public ResponseEntity<Page<EventoDto.Response>> listar(
            @RequestParam(required = false) Long idLote,
            @RequestParam(required = false) Long idDespacho,
            @RequestParam(required = false) Evento.Tipo tipo,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime desde,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime hasta,
            Pageable pageable) {
        return ResponseEntity.ok(eventoService.buscar(idLote, idDespacho, tipo, desde, hasta, pageable));
    }

    @GetMapping("/tipo/{tipo}")
    public ResponseEntity<List<EventoDto.Response>> porTipo(@PathVariable Evento.Tipo tipo) {
        return ResponseEntity.ok(eventoService.porTipo(tipo));
    }

    @GetMapping("/timeline/lote/{idLote}")
    public ResponseEntity<List<EventoDto.Timeline>> timelineLote(@PathVariable Long idLote) {
        return ResponseEntity.ok(eventoService.timelineLote(idLote));
    }

    @GetMapping("/timeline/despacho/{idDespacho}")
    public ResponseEntity<List<EventoDto.Timeline>> timelineDespacho(@PathVariable Long idDespacho) {
        return ResponseEntity.ok(eventoService.timelineDespacho(idDespacho));
    }

    @PostMapping
    public ResponseEntity<EventoDto.Response> registrar(@Valid @RequestBody EventoDto.Request request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(eventoService.crear(request, usuarioActual.obtener()));
    }

}
