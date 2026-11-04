package Web.Friotrack.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

import Web.Friotrack.entity.Usuario;

@ConfigurationProperties(prefix = "app.bootstrap")
public record BootstrapProperties(
        boolean enabled,
        String username,
        String password,
        String nombre,
        String apellido,
        Usuario.Rol rol) {

    public BootstrapProperties {
        if (username == null || username.isBlank()) {
            username = "admin";
        }
        if (nombre == null || nombre.isBlank()) {
            nombre = "Administrador";
        }
        if (apellido == null || apellido.isBlank()) {
            apellido = "Sistema";
        }
        if (rol == null) {
            rol = Usuario.Rol.ADMIN;
        }
    }

    public boolean tienePasswordConfigurada() {
        return password != null && !password.isBlank();
    }

}
