package Web.Friotrack.controller;

import java.time.LocalDate;
import java.util.List;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import jakarta.validation.Valid;
import Web.Friotrack.dto.LoteDto;
import Web.Friotrack.entity.Lote;
import Web.Friotrack.service.LoteService;

@RestController
@RequestMapping("/api/lote")
public class LoteController {

    private final LoteService loteService;

    public LoteController(LoteService loteService) {
        this.loteService = loteService;
    }

    @GetMapping
    public ResponseEntity<Page<LoteDto.Response>> listar(
            @RequestParam(required = false) String q,
            @RequestParam(required = false) Lote.Estado estado,
            @RequestParam(required = false) Long idProducto,
            Pageable pageable) {
        return ResponseEntity.ok(loteService.buscar(q, estado, idProducto, pageable));
    }

    @GetMapping("/estado/{estado}")
    public ResponseEntity<List<LoteDto.Response>> porEstado(@PathVariable Lote.Estado estado) {
        return ResponseEntity.ok(loteService.porEstado(estado));
    }

    @GetMapping("/producto/{idProducto}")
    public ResponseEntity<List<LoteDto.Response>> porProducto(@PathVariable Long idProducto) {
        return ResponseEntity.ok(loteService.porProducto(idProducto));
    }

    @GetMapping("/por-vencer")
    public ResponseEntity<List<LoteDto.Response>> porVencer(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate limite) {
        return ResponseEntity.ok(loteService.porVencer(
                limite == null ? LocalDate.now().plusDays(30) : limite));
    }

    @GetMapping("/{id}")
    public ResponseEntity<LoteDto.Response> obtener(@PathVariable Long id) {
        return ResponseEntity.ok(loteService.obtener(id));
    }

    @GetMapping("/codigo/{codigo}")
    public ResponseEntity<LoteDto.Response> porCodigo(@PathVariable String codigo) {
        return ResponseEntity.ok(loteService.obtenerPorCodigo(codigo));
    }

    @PostMapping
    public ResponseEntity<LoteDto.Response> crear(@Valid @RequestBody LoteDto.Request request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(loteService.crear(request));
    }

    @PutMapping("/{id}")
    public ResponseEntity<LoteDto.Response> actualizar(@PathVariable Long id,
                                                       @Valid @RequestBody LoteDto.Actualizacion request) {
        return ResponseEntity.ok(loteService.actualizar(id, request));
    }

    @PatchMapping("/{id}/bloquear")
    public ResponseEntity<LoteDto.Response> bloquear(@PathVariable Long id,
                                                     @RequestBody(required = false) LoteDto.CambioEstado request) {
        return ResponseEntity.ok(loteService.bloquear(id, request == null ? null : request.motivo()));
    }

    @PatchMapping("/{id}/liberar")
    public ResponseEntity<LoteDto.Response> liberar(@PathVariable Long id,
                                                    @RequestBody(required = false) LoteDto.CambioEstado request) {
        return ResponseEntity.ok(loteService.liberar(id, request == null ? null : request.motivo()));
    }

    @PatchMapping("/{id}/descartar")
    public ResponseEntity<LoteDto.Response> descartar(@PathVariable Long id,
                                                     @RequestBody(required = false) LoteDto.CambioEstado request) {
        return ResponseEntity.ok(loteService.descartar(id, request == null ? null : request.motivo()));
    }

}
