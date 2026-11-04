package Web.Friotrack;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIf;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

import Web.Friotrack.entity.Usuario;
import Web.Friotrack.repository.UsuarioRepository;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Prueba de integracion: levanta el contexto completo contra el esquema real de
 * MySQL (ddl-auto=validate). Se omite automaticamente si no hay una base de datos
 * disponible, de modo que {@code mvn test} no dependa del entorno.
 */
@SpringBootTest(properties = "app.bootstrap.enabled=false")
@EnabledIf("Web.Friotrack.TestDbConfig#available")
class FriotrackApplicationTests {

    @DynamicPropertySource
    static void datasource(DynamicPropertyRegistry registry) {
    registry.add("spring.datasource.url", TestDbConfig::jdbcUrl);
    registry.add("spring.datasource.username", TestDbConfig::usuario);
    registry.add("spring.datasource.password", TestDbConfig::password);
}


    @Autowired
    private UsuarioRepository usuarioRepository;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Test
    @DisplayName("el contexto carga y el esquema valida contra las 9 tablas")
    void contextLoads() {
        assertThat(usuarioRepository).isNotNull();

        Integer tablas = jdbcTemplate.queryForObject("""
                SELECT COUNT(*) FROM information_schema.tables
                WHERE table_schema = DATABASE()
                  AND table_name IN ('usuario','producto','lote','despacho','despacho_lote',
                                     'control','incidencia','evidencia','evento')
                """, Integer.class);

        assertThat(tablas).isEqualTo(9);
    }

    @Test
    @DisplayName("el enum de rol se persiste como literal y se lee de vuelta")
    void enumDeRol() {
        Usuario usuario = usuarioRepository.findByActivoTrue().stream().findFirst().orElse(null);
        if (usuario == null) {
            return;
        }
        assertThat(usuario.getRol()).isIn(Usuario.Rol.ADMIN, Usuario.Rol.OPERADOR,
                Usuario.Rol.CALIDAD, Usuario.Rol.SUPERVISOR);
    }

}