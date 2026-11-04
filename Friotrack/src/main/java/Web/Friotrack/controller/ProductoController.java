package Web.Friotrack.controller;

import java.util.List;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import jakarta.validation.Valid;
import Web.Friotrack.dto.LoteDto;
import Web.Friotrack.dto.ProductoDto;
import Web.Friotrack.entity.Producto;
import Web.Friotrack.service.ProductoService;

@RestController
@RequestMapping("/api/producto")
public class ProductoController {

    private final ProductoService productoService;

    public ProductoController(ProductoService productoService) {
        this.productoService = productoService;
    }

    @GetMapping
    public ResponseEntity<Page<ProductoDto.Response>> listar(
            @RequestParam(required = false) String q,
            @RequestParam(required = false) Boolean activo,
            Pageable pageable) {
        return ResponseEntity.ok(productoService.buscar(q, activo, pageable).map(ProductoDto.Response::of));
    }

    @GetMapping("/activos")
    public ResponseEntity<List<ProductoDto.Response>> activos() {
        return ResponseEntity.ok(productoService.activos().stream().map(ProductoDto.Response::of).toList());
    }

    @GetMapping("/con-lotes")
    public ResponseEntity<List<ProductoDto.Response>> conLotes() {
        return ResponseEntity.ok(productoService.conLotes().stream().map(ProductoDto.Response::of).toList());
    }

    @GetMapping("/{id}")
    public ResponseEntity<ProductoDto.Response> obtener(@PathVariable Long id) {
        return ResponseEntity.ok(ProductoDto.Response.of(productoService.obtener(id)));
    }

    @PostMapping
    public ResponseEntity<ProductoDto.Response> crear(@Valid @RequestBody ProductoDto.Request request) {
        Producto creado = productoService.crear(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(ProductoDto.Response.of(creado));
    }

    @PutMapping("/{id}")
    public ResponseEntity<ProductoDto.Response> actualizar(@PathVariable Long id,
                                                           @Valid @RequestBody ProductoDto.Request request) {
        return ResponseEntity.ok(ProductoDto.Response.of(productoService.actualizar(id, request)));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> desactivar(@PathVariable Long id) {
        productoService.desactivar(id);
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/{id}/definitivo")
    public ResponseEntity<Void> eliminar(@PathVariable Long id) {
        productoService.eliminar(id);
        return ResponseEntity.noContent().build();
    }

}
