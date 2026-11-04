package Web.Friotrack.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import Web.Friotrack.config.JwtProperties;

class JwtServiceTest {

    private static final String SECRETO = "friotrack360-test-secret-de-al-menos-32-bytes!!";

    private JwtService jwtService(String expiracion) {
        return new JwtService(new JwtProperties(SECRETO, Long.parseLong(expiracion)));
    }

    @Test
    @DisplayName("firma un token con subject, id y rol")
    void firmaToken() {
        JwtService jwtService = jwtService("7200");

        String token = jwtService.generarToken("admin", 1L, "ADMIN");

        assertThat(jwtService.getUsername(token)).isEqualTo("admin");
        assertThat(jwtService.getIdUsuario(token)).isEqualTo(1L);
        assertThat(jwtService.getRol(token)).isEqualTo("ADMIN");
        assertThat(jwtService.esValido(token, "admin")).isTrue();
    }

    @Test
    @DisplayName("rechaza un token firmado con otro secreto")
    void rechazaTokenDeOtroSecreto() {
        JwtService emisor = jwtService("7200");
        JwtService verificador = new JwtService(new JwtProperties(
                "otro-secreto-distinto-de-al-menos-32-bytes-x", 7200));

        String token = emisor.generarToken("admin", 1L, "ADMIN");

        assertThat(verificador.esValido(token, "admin")).isFalse();
    }

    @Test
    @DisplayName("rechaza un token manipulado")
    void rechazaTokenManipulado() {
        JwtService jwtService = jwtService("7200");
        String token = jwtService.generarToken("admin", 1L, "ADMIN");

        String manipulado = token.substring(0, token.lastIndexOf('.') + 1) + "abc123";

        assertThat(jwtService.esValido(manipulado, "admin")).isFalse();
    }

    @Test
    @DisplayName("rechaza un token expirado")
    void rechazaTokenExpirado() throws InterruptedException {
        JwtService jwtService = jwtService("1");
        String token = jwtService.generarToken("admin", 1L, "ADMIN");

        Thread.sleep(1500);

        assertThat(jwtService.esValido(token, "admin")).isFalse();
    }

    @Test
    @DisplayName("un token no es valido para otro usuario")
    void tokenNoValidoParaOtroUsuario() {
        JwtService jwtService = jwtService("7200");
        String token = jwtService.generarToken("admin", 1L, "ADMIN");

        assertThat(jwtService.esValido(token, "operador")).isFalse();
    }

    @Test
    @DisplayName("un secreto corto impide arrancar")
    void secretoCortoEsRechazado() {
        assertThatThrownBy(() -> new JwtService(new JwtProperties("corto", 7200)))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("32 bytes");
    }

    @Test
    @DisplayName("sin secreto configurado usa el de desarrollo y lo advierte")
    void usaSecretoPorDefecto() {
        JwtProperties properties = new JwtProperties(null, 0);

        assertThat(properties.usaSecretPorDefecto()).isTrue();
        assertThat(properties.expirationSegundos()).isEqualTo(7200);
    }

}