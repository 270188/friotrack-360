package Web.Friotrack.controller;

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
import Web.Friotrack.dto.UsuarioDto;
import Web.Friotrack.entity.Usuario;
import Web.Friotrack.service.UsuarioService;

@RestController
@RequestMapping("/api/usuario")
public class UsuarioController {

    private final UsuarioService usuarioService;

    public UsuarioController(UsuarioService usuarioService) {
        this.usuarioService = usuarioService;
    }

    @GetMapping
    public ResponseEntity<Page<UsuarioDto.Response>> listar(Pageable pageable) {
        return ResponseEntity.ok(usuarioService.listar(pageable).map(UsuarioDto.Response::of));
    }

    @GetMapping("/activos")
    public ResponseEntity<List<UsuarioDto.Response>> activos() {
        return ResponseEntity.ok(usuarioService.activos().stream().map(UsuarioDto.Response::of).toList());
    }

    @GetMapping("/rol/{rol}")
    public ResponseEntity<List<UsuarioDto.Response>> porRol(@PathVariable Usuario.Rol rol) {
        return ResponseEntity.ok(usuarioService.porRol(rol).stream().map(UsuarioDto.Response::of).toList());
    }

    @GetMapping("/{id}")
    public ResponseEntity<UsuarioDto.Response> obtenerPorId(@PathVariable Long id) {
        return ResponseEntity.ok(UsuarioDto.Response.of(usuarioService.obtener(id)));
    }

    @GetMapping("/username/{username}")
    public ResponseEntity<UsuarioDto.Response> porUsername(@PathVariable String username) {
        return ResponseEntity.ok(UsuarioDto.Response.of(usuarioService.obtenerPorUsername(username)));
    }

    @PostMapping
    public ResponseEntity<UsuarioDto.Response> crear(@Valid @RequestBody UsuarioDto.Request request) {
        Usuario creado = usuarioService.crear(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(UsuarioDto.Response.of(creado));
    }

    @PutMapping("/{id}")
    public ResponseEntity<UsuarioDto.Response> actualizar(@PathVariable Long id,
                                                         @Valid @RequestBody UsuarioDto.Actualizacion request) {
        return ResponseEntity.ok(UsuarioDto.Response.of(usuarioService.actualizar(id, request)));
    }

    @PatchMapping("/{id}/password")
    public ResponseEntity<UsuarioDto.Response> cambiarPassword(@PathVariable Long id,
                                                               @Valid @RequestBody UsuarioDto.CambioPassword request) {
        return ResponseEntity.ok(UsuarioDto.Response.of(usuarioService.cambiarPassword(id, request)));
    }

    @PatchMapping("/{id}/activar")
    public ResponseEntity<UsuarioDto.Response> activar(@PathVariable Long id) {
        return ResponseEntity.ok(UsuarioDto.Response.of(usuarioService.activar(id)));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<UsuarioDto.Response> desactivar(@PathVariable Long id) {
        return ResponseEntity.ok(UsuarioDto.Response.of(usuarioService.desactivar(id)));
    }

}
