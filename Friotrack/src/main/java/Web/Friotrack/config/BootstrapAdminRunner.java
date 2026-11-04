package Web.Friotrack.config;

import java.security.SecureRandom;
import java.util.Base64;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import Web.Friotrack.entity.Usuario;
import Web.Friotrack.repository.UsuarioRepository;

@Component
public class BootstrapAdminRunner implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(BootstrapAdminRunner.class);

    private final UsuarioRepository usuarioRepository;
    private final PasswordEncoder passwordEncoder;
    private final BootstrapProperties properties;
    private final SecureRandom secureRandom = new SecureRandom();

    public BootstrapAdminRunner(UsuarioRepository usuarioRepository,
                                PasswordEncoder passwordEncoder,
                                BootstrapProperties properties) {
        this.usuarioRepository = usuarioRepository;
        this.passwordEncoder = passwordEncoder;
        this.properties = properties;
    }

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        if (!properties.enabled()) {
            log.info("Bootstrap de usuario inicial deshabilitado (app.bootstrap.enabled=false)");
            return;
        }

        if (usuarioRepository.count() > 0) {
            log.info("Bootstrap omitido: la tabla usuario ya contiene {} registro(s)", usuarioRepository.count());
            return;
        }

        String password = properties.tienePasswordConfigurada()
                ? properties.password()
                : generarPassword();

        Usuario admin = new Usuario();
        admin.setNombre(properties.nombre());
        admin.setApellido(properties.apellido());
        admin.setUsername(properties.username());
        admin.setPasswordHash(passwordEncoder.encode(password));
        admin.setRol(properties.rol());
        admin.setActivo(Boolean.TRUE);
        usuarioRepository.save(admin);

        log.warn("=== USUARIO INICIAL CREADO === username={} rol={} password={}",
                properties.username(), properties.rol(), password);
        log.warn("=== Cambie esta contrasena en el primer acceso ===");
    }

    private String generarPassword() {
        byte[] bytes = new byte[12];
        secureRandom.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

}
