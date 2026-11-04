package Web.Friotrack.service;

import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.AuthenticationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import Web.Friotrack.dto.UsuarioDto;
import Web.Friotrack.entity.Usuario;
import Web.Friotrack.exception.BusinessRuleException;
import Web.Friotrack.repository.UsuarioRepository;
import Web.Friotrack.security.JwtService;

@Service
public class AuthService {

    private final AuthenticationManager authenticationManager;
    private final JwtService jwtService;
    private final UsuarioRepository usuarioRepository;

    public AuthService(AuthenticationManager authenticationManager,
                       JwtService jwtService,
                       UsuarioRepository usuarioRepository) {
        this.authenticationManager = authenticationManager;
        this.jwtService = jwtService;
        this.usuarioRepository = usuarioRepository;
    }

    @Transactional(readOnly = true)
    public UsuarioDto.Credenciales login(UsuarioDto.LoginRequest request) {
        Authentication authentication;
        try {
            authentication = authenticationManager.authenticate(
                    new UsernamePasswordAuthenticationToken(request.username(), request.password()));
        } catch (AuthenticationException ex) {
            throw new BusinessRuleException("Usuario o contrasena incorrectos");
        }

        Usuario usuario = usuarioRepository.findByUsername(authentication.getName())
                .orElseThrow(() -> new BusinessRuleException("El usuario autenticado no existe"));

        if (!Boolean.TRUE.equals(usuario.getActivo())) {
            throw new BusinessRuleException("La cuenta esta desactivada");
        }

        String token = jwtService.generarToken(usuario.getUsername(), usuario.getIdUsuario(), usuario.getRol().name());

        return new UsuarioDto.Credenciales(token, "Bearer", usuario.getIdUsuario(), usuario.getUsername(),
                usuario.getRol(), jwtService.getExpirationSegundos());
    }

}
