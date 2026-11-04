package Web.Friotrack.security;

import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;

import Web.Friotrack.entity.Usuario;
import Web.Friotrack.exception.BusinessRuleException;
import Web.Friotrack.repository.UsuarioRepository;

@Component
public class UsuarioActualProvider {

    private final UsuarioRepository usuarioRepository;

    public UsuarioActualProvider(UsuarioRepository usuarioRepository) {
        this.usuarioRepository = usuarioRepository;
    }

    public Usuario obtener() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !(authentication.getPrincipal() instanceof UsuarioDetailsService.UsuarioPrincipal principal)) {
            throw new BusinessRuleException("No hay una sesion autenticada válida");
        }
        return usuarioRepository.findById(principal.usuario().getIdUsuario())
                .orElseThrow(() -> new BusinessRuleException("El usuario de la sesion ya no existe"));
    }

    public Long obtenerId() {
        return obtener().getIdUsuario();
    }

    public boolean esAdmin() {
        return obtener().getRol() == Usuario.Rol.ADMIN;
    }

    public boolean esCalidad() {
        return Usuario.Rol.CALIDAD.equals(obtener().getRol());
    }

}
