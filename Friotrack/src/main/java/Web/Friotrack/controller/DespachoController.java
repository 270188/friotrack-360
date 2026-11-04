package Web.Friotrack.controller;

import java.time.LocalDateTime;
import java.util.List;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
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
import Web.Friotrack.dto.DespachoDto;
import Web.Friotrack.entity.Despacho;
import Web.Friotrack.service.DespachoLoteService;
import Web.Friotrack.service.DespachoService;

@RestController
@RequestMapping("/api/despacho")
public class DespachoController {

    private final DespachoService despachoService;
    private final DespachoLoteService despachoLoteService;

    public DespachoController(DespachoService despachoService, DespachoLoteService despachoLoteService) {
        this.despachoService = despachoService;
        this.despachoLoteService = despachoLoteService;
    }

    @GetMapping
    public ResponseEntity<Page<DespachoDto.Response>> listar(
            @RequestParam(required = false) String q,
            @RequestParam(required = false) Despacho.Estado estado,
            Pageable pageable) {
        return ResponseEntity.ok(despachoService.buscar(q, estado, pageable));
    }

    @GetMapping("/estado/{estado}")
    public ResponseEntity<List<DespachoDto.Response>> porEstado(@PathVariable Despacho.Estado estado) {
        return ResponseEntity.ok(despachoService.porEstado(estado));
    }

    @GetMapping("/programados")
    public ResponseEntity<List<DespachoDto.Response>> programados(
            @RequestParam LocalDateTime desde,
            @RequestParam LocalDateTime hasta) {
        return ResponseEntity.ok(despachoService.programadosEntre(desde, hasta));
    }

    @GetMapping("/{id}")
    public ResponseEntity<DespachoDto.Response> obtener(@PathVariable Long id) {
        return ResponseEntity.ok(despachoService.obtener(id));
    }

    @GetMapping("/codigo/{codigo}")
    public ResponseEntity<DespachoDto.Response> porCodigo(@PathVariable String codigo) {
        return ResponseEntity.ok(despachoService.obtenerPorCodigo(codigo));
    }

    @PostMapping
    public ResponseEntity<DespachoDto.Response> crear(@Valid @RequestBody DespachoDto.Request request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(despachoService.crear(request));
    }

    @PutMapping("/{id}")
    public ResponseEntity<DespachoDto.Response> actualizar(@PathVariable Long id,
                                                           @Valid @RequestBody DespachoDto.Actualizacion request) {
        return ResponseEntity.ok(despachoService.actualizar(id, request));
    }

    @PatchMapping("/{id}/estado")
    public ResponseEntity<DespachoDto.Response> cambiarEstado(@PathVariable Long id,
                                                             @Valid @RequestBody DespachoDto.CambioEstado request) {
        return ResponseEntity.ok(despachoService.cambiarEstado(id, request.estado(), request.motivo()));
    }

    @GetMapping("/{id}/lotes")
    public ResponseEntity<List<DespachoDto.Item>> lotes(@PathVariable Long id) {
        return ResponseEntity.ok(despachoLoteService.porDespacho(id));
    }

    @PostMapping("/{id}/lotes")
    public ResponseEntity<DespachoDto.Item> agregarLote(@PathVariable Long id,
                                                       @Valid @RequestBody LoteDespachoRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(despachoLoteService.agregar(id, request.idLote(), request.cantidad()));
    }

    @DeleteMapping("/lote/{idDespachoLote}")
    public ResponseEntity<Void> quitarLote(@PathVariable Long idDespachoLote) {
        despachoLoteService.quitar(idDespachoLote);
        return ResponseEntity.noContent().build();
    }

    public record LoteDespachoRequest(
            @jakarta.validation.constraints.NotNull Long idLote,
            @jakarta.validation.constraints.NotNull @jakarta.validation.constraints.DecimalMin("0.001")
            @jakarta.validation.constraints.Digits(integer = 9, fraction = 3)
            java.math.BigDecimal cantidad) {
    }

}
