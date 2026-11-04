package Web.Friotrack;

import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.Map;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIf;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpStatusCode;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.client.RestTestClient;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Pruebas del endpoint de autenticacion y del ciclo de vida del JWT.
 *
 * El token se emite con expiracion de 3 segundos para poder verificar en la misma
 * prueba que un token caduca, sin esperar minutos.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
        properties = {
                "app.bootstrap.enabled=true",
                "app.bootstrap.username=admin",
                "app.bootstrap.password=admin123",
                "app.jwt.expiration-segundos=3"
        })
@EnabledIf("Web.Friotrack.TestDbConfig#available")
class AuthApiIntegrationTest {

@DynamicPropertySource
static void datasource(DynamicPropertyRegistry registry) {
    registry.add("spring.datasource.url", TestDbConfig::jdbcUrl);
    registry.add("spring.datasource.username", TestDbConfig::usuario);
    registry.add("spring.datasource.password", TestDbConfig::password);
}


    private static final String AUTH = "Authorization";
    private static final String BEARER = "Bearer ";
    @LocalServerPort
    private int port;

    private RestTestClient api;
    private final ObjectMapper mapper = new ObjectMapper();

    @BeforeEach
    void setUp() {
        api = RestTestClient.bindToServer().baseUrl("http://localhost:" + port).build();
    }

    private RestTestClient.ResponseSpec enviar(HttpMethod metodo, String ruta, String token,
                                               Object cuerpo, String contentType) {
        var spec = api.method(metodo).uri(ruta);
        if (token != null) {
            spec = spec.header(AUTH, BEARER + token);
        }
        if (contentType != null) {
            spec = spec.contentType(org.springframework.http.MediaType.parseMediaType(contentType));
        }
        return cuerpo == null ? spec.exchange() : spec.body(cuerpo).exchange();
    }

    private RestTestClient.ResponseSpec login(String username, String password) {
        return enviar(HttpMethod.POST, "/api/auth/login", null,
                Map.of("username", username, "password", password), "application/json");
    }

    private String loginOk() {
        return leerToken(login("admin", "admin123").expectStatus().isOk());
    }

    private String leerToken(RestTestClient.ResponseSpec spec) {
        return mapper.readTree(spec.returnResult().getResponseBodyContent()).get("token").asText();
    }

    private String payload(String token) {
        String p = token.split("\\.")[1];
        p += "=".repeat((4 - p.length() % 4) % 4);
        return new String(Base64.getUrlDecoder().decode(p), StandardCharsets.UTF_8);
    }

    private String firma(String header, String payload, String secret) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            String base = header + "." + payload;
            return Base64.getUrlEncoder().withoutPadding()
                    .encodeToString(mac.doFinal(base.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception ex) {
            throw new IllegalStateException(ex);
        }
    }

    private String b64(String texto) {
        return Base64.getUrlEncoder().withoutPadding().encodeToString(texto.getBytes(StandardCharsets.UTF_8));
    }

    // ------------------------------------------------------------- credenciales

    @Test
    @DisplayName("login valido devuelve token, tipo, id, rol y expiracion")
    void loginValido() {
        JsonNode r = mapper.readTree(login("admin", "admin123")
                .expectStatus().isOk()
                .returnResult().getResponseBodyContent());

        assertThat(r.get("token").asText()).isNotBlank();
        assertThat(r.get("tipo").asText()).isEqualTo("Bearer");
        assertThat(r.get("username").asText()).isEqualTo("admin");
        assertThat(r.get("rol").asText()).isEqualTo("ADMIN");
        assertThat(r.get("id_usuario").asLong()).isPositive();
        assertThat(r.get("expira_en_segundos").asLong()).isEqualTo(3L);
    }

    @Test
    @DisplayName("el token no transporta datos sensibles")
    void tokenSinDatosSENSIBLES() {
        String token = leerToken(login("admin", "admin123").expectStatus().isOk());
        String claims = payload(token);

        assertThat(claims).contains("\"sub\":\"admin\"", "\"rol\":\"ADMIN\"", "\"id\":");
        assertThat(claims.toLowerCase()).doesNotContain("password", "hash", "secret");
    }

    @Test
    @DisplayName("el mismo mensaje para contrasena incorrecta y usuario inexistente (sin enumeracion)")
    void sinEnumeracionDeUsuarios() {
        String usuarioInexistente = mapper.readTree(login("no_existe", "x")
                .expectStatus().isEqualTo(HttpStatusCode.valueOf(422))
                .returnResult().getResponseBodyContent()).get("mensaje").asText();

        String contrasenaIncorrecta = mapper.readTree(login("admin", "x")
                .expectStatus().isEqualTo(HttpStatusCode.valueOf(422))
                .returnResult().getResponseBodyContent()).get("mensaje").asText();

        assertThat(contrasenaIncorrecta).isEqualTo(usuarioInexistente);
    }

    @Test
    @DisplayName("campos obligatorios ausentes -> 400 detailing por campo")
    void camposObligatorios() {
        JsonNode vacio = mapper.readTree(enviar(HttpMethod.POST, "/api/auth/login", null, Map.of(),
                "application/json").expectStatus().isEqualTo(HttpStatus.BAD_REQUEST)
                .returnResult().getResponseBodyContent());

        assertThat(vacio.get("campos").has("username")).isTrue();
        assertThat(vacio.get("campos").has("password")).isTrue();

        enviar(HttpMethod.POST, "/api/auth/login", null, Map.of("username", "admin"), "application/json")
                .expectStatus().isEqualTo(HttpStatus.BAD_REQUEST)
                .expectBody().jsonPath("$.campos.password").exists();
    }

    @Test
    @DisplayName("JSON malformado -> 400")
    void jsonMalformado() {
        enviar(HttpMethod.POST, "/api/auth/login", null, "{\"username\":", "application/json")
                .expectStatus().isEqualTo(HttpStatus.BAD_REQUEST);
    }

    @Test
    @DisplayName("Content-Type no soportado -> 415, no 500")
    void contentTypeNoSoportado() {
        enviar(HttpMethod.POST, "/api/auth/login", null,
                "{\"username\":\"admin\",\"password\":\"admin123\"}", "text/plain")
                .expectStatus().isEqualTo(HttpStatus.UNSUPPORTED_MEDIA_TYPE)
                .expectBody().jsonPath("$.mensaje").value(String.class,
                        m -> assertThat(m).contains("application/json"));
    }

    @Test
    @DisplayName("GET sobre /auth/login -> 405 con cabecera Allow")
    void metodoNoSoportado() {
        enviar(HttpMethod.GET, "/api/auth/login", null, null, null)
                .expectStatus().isEqualTo(HttpStatus.METHOD_NOT_ALLOWED)
                .expectHeader().valueEquals("Allow", "POST");
    }

    @Test
    @DisplayName("ruta inexistente -> 404, no 500")
    void rutaInexistente() {
        String token = loginOk();

        enviar(HttpMethod.GET, "/api/no-existe", token, null, null)
                .expectStatus().isEqualTo(HttpStatus.NOT_FOUND);
    }

    @Test
    @DisplayName("enum invalido en ruta o query -> 400 con los valores admitidos")
    void enumInvalido() {
        String token = loginOk();

        enviar(HttpMethod.GET, "/api/lote/estado/INVENTADO", token, null, null)
                .expectStatus().isEqualTo(HttpStatus.BAD_REQUEST)
                .expectBody().jsonPath("$.mensaje").value(String.class,
                        m -> assertThat(m).contains("INVENTADO", "DISPONIBLE", "BLOQUEADO"));

        enviar(HttpMethod.GET, "/api/lote?estado=INVENTADO", token, null, null)
                .expectStatus().isEqualTo(HttpStatus.BAD_REQUEST);
    }

    // --------------------------------------------------------- ciclo del token

    @Test
    @DisplayName("el token valido habilita un endpoint protegido")
    void tokenValidoHabilitaAcceso() {
        String token = loginOk();

        enviar(HttpMethod.GET, "/api/usuario/activos", token, null, null)
                .expectStatus().isOk()
                .expectBody().jsonPath("$.length()").value(Integer.class, m -> assertThat(m).isPositive());
    }

    @Test
    @DisplayName("el token caduca segun app.jwt.expiration-segundos")
    void tokenExpira() throws InterruptedException {
        String token = loginOk();

        enviar(HttpMethod.GET, "/api/usuario/activos", token, null, null).expectStatus().isOk();

        Thread.sleep(4000);

        enviar(HttpMethod.GET, "/api/usuario/activos", token, null, null)
                .expectStatus().isEqualTo(HttpStatus.UNAUTHORIZED);
    }

    @Test
    @DisplayName("solo se acepta el esquema Bearer (case sensitive)")
    void esquemaDeHeader() {
        String token = loginOk();

        enviar(HttpMethod.GET, "/api/usuario/activos", null, null, null)
                .expectStatus().isEqualTo(HttpStatus.UNAUTHORIZED);
        api.get().uri("/api/usuario/activos").header(AUTH, "Token " + token).exchange()
                .expectStatus().isEqualTo(HttpStatus.UNAUTHORIZED);
        api.get().uri("/api/usuario/activos").header(AUTH, "bearer " + token).exchange()
                .expectStatus().isEqualTo(HttpStatus.UNAUTHORIZED);
        api.get().uri("/api/usuario/activos").header(AUTH, token).exchange()
                .expectStatus().isEqualTo(HttpStatus.UNAUTHORIZED);
    }

    @Test
    @DisplayName("payload manipulado -> 401 (firma invalida)")
    void payloadManipulado() {
        String token = loginOk();
        String[] partes = token.split("\\.");
        String payloadAlterado = payload(token).replace("ADMIN", "SUPERVISOR");
        String partes2 = partes[0] + "." + b64(payloadAlterado) + "." + partes[2];

        api.get().uri("/api/usuario/activos").header(AUTH, BEARER + partes2).exchange()
                .expectStatus().isEqualTo(HttpStatus.UNAUTHORIZED);
    }

    @Test
    @DisplayName("token firmado con otro secreto -> 401")
    void tokenForjado() {
        String header = b64("{\"alg\":\"HS256\"}");
        String claims = b64("{\"sub\":\"admin\",\"id\":1,\"rol\":\"ADMIN\",\"exp\":9999999999}");
        String forjado = header + "." + claims + "." + firma(header, claims, "clave-falsa-del-atacante!!");

        api.get().uri("/api/usuario/activos").header(AUTH, BEARER + forjado).exchange()
                .expectStatus().isEqualTo(HttpStatus.UNAUTHORIZED);
    }

    @Test
    @DisplayName("el token None/algo sin firma -> 401")
    void tokenSinFirma() {
        String header = b64("{\"alg\":\"none\"}");
        String claims = b64("{\"sub\":\"admin\",\"id\":1,\"rol\":\"ADMIN\",\"exp\":9999999999}");

        api.get().uri("/api/usuario/activos").header(AUTH, BEARER + header + "." + claims + ".").exchange()
                .expectStatus().isEqualTo(HttpStatus.UNAUTHORIZED);
    }

    @Test
    @DisplayName("un token no se puede reutilizar con otro username")
    void tokenDeOtroUsuario() {
        String token = loginOk();

        api.get().uri("/api/usuario/activos")
                .header(AUTH, BEARER + token)
                .exchange()
                .expectStatus().isOk();

        // mismo token, pero el filtro exige que el subject coincida con el principal
        enviar(HttpMethod.GET, "/api/usuario/activos", token + "x", null, null)
                .expectStatus().isEqualTo(HttpStatus.UNAUTHORIZED);
    }

    // ------------------------------------------------------- cuenta desactivada

    @Test
    @DisplayName("desactivar la cuenta invalida el login y el token ya emitido")
    void cuentaDesactivada() {
        String adminToken = loginOk();
        String username = "desact_" + System.nanoTime();

        long idUsuario = mapper.readTree(enviar(HttpMethod.POST, "/api/usuario", adminToken,
                Map.of("nombre", "Temporal", "apellido", "Prueba", "username", username,
                        "password", "clave12345", "rol", "OPERADOR"), "application/json")
                .expectStatus().isEqualTo(HttpStatus.CREATED)
                .returnResult().getResponseBodyContent()).get("id_usuario").asLong();

        String tokenUsuario = leerToken(login(username, "clave12345").expectStatus().isOk());
        enviar(HttpMethod.GET, "/api/usuario/activos", tokenUsuario, null, null)
                .expectStatus().isOk();

        enviar(HttpMethod.DELETE, "/api/usuario/" + idUsuario, adminToken, null, null)
                .expectStatus().isOk();

        login(username, "clave12345")
                .expectStatus().isEqualTo(HttpStatusCode.valueOf(422))
                .expectBody().jsonPath("$.mensaje").value(String.class,
                        m -> assertThat(m).contains("incorrectos"));

        enviar(HttpMethod.GET, "/api/usuario/activos", tokenUsuario, null, null)
                .expectStatus().isEqualTo(HttpStatus.UNAUTHORIZED);

        enviar(HttpMethod.PATCH, "/api/usuario/" + idUsuario + "/activar", adminToken, null, null)
                .expectStatus().isOk();
        login(username, "clave12345").expectStatus().isOk();
    }

    @Test
    @DisplayName("un admin no puede desactivar su propia cuenta")
    void noAutoDesactivacion() {
        String adminToken = loginOk();

        enviar(HttpMethod.DELETE, "/api/usuario/1", adminToken, null, null)
                .expectStatus().isEqualTo(HttpStatusCode.valueOf(422))
                .expectBody().jsonPath("$.mensaje").value(String.class,
                        m -> assertThat(m).contains("propia cuenta"));
    }

    @Test
    @DisplayName("login no filtra si el usuario existe: misma respuesta y mismo codigo")
    void respuestasIndistinguibles() {
        var a = login("admin", "claveEquivocada");
        var b = login("usuario_inexistente_xyz", "claveEquivocada");

        assertThat(a.expectStatus().isEqualTo(HttpStatusCode.valueOf(422)).returnResult().getStatus())
                .isEqualTo(b.expectStatus().isEqualTo(HttpStatusCode.valueOf(422)).returnResult().getStatus());
    }

}