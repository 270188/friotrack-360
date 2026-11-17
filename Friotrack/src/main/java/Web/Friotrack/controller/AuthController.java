package Web.Friotrack.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import jakarta.validation.Valid;
import Web.Friotrack.dto.UsuarioDto;
import Web.Friotrack.security.UsuarioActualProvider;
import Web.Friotrack.service.AuthService;
import Web.Friotrack.service.UsuarioService;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AuthService authService;
    private final UsuarioService usuarioService;
    private final UsuarioActualProvider usuarioActual;

    public AuthController(AuthService authService, UsuarioService usuarioService, UsuarioActualProvider usuarioActual) {
        this.authService = authService;
        this.usuarioService = usuarioService;
        this.usuarioActual = usuarioActual;
    }

    @PostMapping("/login")
    public ResponseEntity<UsuarioDto.Credenciales> login(@Valid @RequestBody UsuarioDto.LoginRequest request) {
        return ResponseEntity.ok(authService.login(request));
    }

    /** Datos del usuario que inicio sesion (segun su token JWT). */
    @GetMapping("/me")
    public ResponseEntity<UsuarioDto.Response> perfil() {
        return ResponseEntity.ok(UsuarioDto.Response.of(usuarioActual.obtener()));
    }

    /** Cambio de la propia contrasena: exige la contrasena actual. */
    @PatchMapping("/password")
    public ResponseEntity<UsuarioDto.Response> cambiarPassword(@Valid @RequestBody UsuarioDto.CambioPassword request) {
        return ResponseEntity.ok(UsuarioDto.Response.of(
                usuarioService.cambiarPassword(usuarioActual.obtenerId(), request)));
    }

}
