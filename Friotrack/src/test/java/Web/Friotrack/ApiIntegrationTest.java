package Web.Friotrack;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

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
 * Prueba de la API REST sobre el servidor real (puerto aleatorio) contra el esquema
 * de MySQL. Se omite automaticamente si no hay una base de datos disponible.
 *
 * Cada test es autonomo: crea sus propios datos con codigos unicos, de modo que el
 * orden de ejecucion no altera el resultado.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
        properties = {
                "app.bootstrap.enabled=true",
                "app.bootstrap.username=admin",
                "app.bootstrap.password=admin123",
                "app.bootstrap.nombre=Administrador",
                "app.bootstrap.apellido=Sistema"
        })
@EnabledIf("Web.Friotrack.TestDbConfig#available")
class ApiIntegrationTest {

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

    // ---------------------------------------------------------------- helpers

    private RestTestClient.ResponseSpec enviar(HttpMethod metodo, String ruta, String token, Object cuerpo) {
        var spec = api.method(metodo).uri(ruta);
        if (token != null) {
            spec = spec.header(AUTH, BEARER + token);
        }
        if (cuerpo == null) {
            return spec.exchange();
        }
        return spec.body(cuerpo).exchange();
    }

    private JsonNode leerJson(RestTestClient.ResponseSpec spec) {
        return mapper.readTree(spec.returnResult().getResponseBodyContent());
    }

    private String tokenAdmin() {
        return login("admin", "admin123");
    }

    private String login(String username, String password) {
        var spec = enviar(HttpMethod.POST, "/api/auth/login", null,
                Map.of("username", username, "password", password))
                .expectStatus().isOk();
        return leerJson(spec).get("token").asText();
    }

    private long crearProducto(String token, String nombre, String tMin, String tMax) {
        return crearProducto(token, nombre, tMin, tMax, null, null);
    }

    private long crearProducto(String token, String nombre, String tMin, String tMax,
                               String hMin, String hMax) {
        Map<String, Object> cuerpo = new LinkedHashMap<>();
        cuerpo.put("nombre", nombre);
        cuerpo.put("temperatura_min", new java.math.BigDecimal(tMin));
        cuerpo.put("temperatura_max", new java.math.BigDecimal(tMax));
        if (hMin != null) {
            cuerpo.put("humedad_min", new java.math.BigDecimal(hMin));
            cuerpo.put("humedad_max", new java.math.BigDecimal(hMax));
        }
        var spec = enviar(HttpMethod.POST, "/api/producto", token, cuerpo)
                .expectStatus().isEqualTo(HttpStatus.CREATED);
        return leerJson(spec).get("id_producto").asLong();
    }

    private String crearUsuario(String token, String rol) {
        String username = "usr_" + rol.toLowerCase() + "_" + UUID.randomUUID().toString().substring(0, 8);
        var spec = enviar(HttpMethod.POST, "/api/usuario", token, Map.of(
                "nombre", "Usuario", "apellido", "Prueba",
                "username", username, "password", "clave12345", "rol", rol))
                .expectStatus().isEqualTo(HttpStatus.CREATED);
        return username;
    }

    private long crearLote(String token, long idProducto, String codigo, String cantidad) {
        var spec = enviar(HttpMethod.POST, "/api/lote", token, Map.of(
                "id_producto", idProducto,
                "codigo_lote", codigo,
                "cantidad", new java.math.BigDecimal(cantidad)))
                .expectStatus().isEqualTo(HttpStatus.CREATED);
        return leerJson(spec).get("id_lote").asLong();
    }

    private long crearDespacho(String token, String codigo) {
        var spec = enviar(HttpMethod.POST, "/api/despacho", token, Map.of(
                "codigo", codigo, "destino", "Cliente Prueba",
                "transportista", "Transportista SAC", "vehiculo", "VEH-001", "placa", "ABC-123"))
                .expectStatus().isEqualTo(HttpStatus.CREATED);
        return leerJson(spec).get("id_despacho").asLong();
    }

    private long asociarLote(String token, long idDespacho, long idLote, String cantidad) {
        var spec = enviar(HttpMethod.POST, "/api/despacho/" + idDespacho + "/lotes", token,
                Map.of("id_lote", idLote, "cantidad", new java.math.BigDecimal(cantidad)))
                .expectStatus().isEqualTo(HttpStatus.CREATED);
        return leerJson(spec).get("id_despacho_lote").asLong();
    }

    private JsonNode registrarControl(String token, long idDespacho, long idLote, String temperatura) {
        Map<String, Object> cuerpo = new LinkedHashMap<>();
        cuerpo.put("id_despacho", idDespacho);
        cuerpo.put("id_lote", idLote);
        cuerpo.put("temperatura", new java.math.BigDecimal(temperatura));
        return leerJson(enviar(HttpMethod.POST, "/api/control", token, cuerpo)
                .expectStatus().isEqualTo(HttpStatus.CREATED));
    }

    private String sufijo() {
        return UUID.randomUUID().toString().substring(0, 8).toUpperCase();
    }

    // ------------------------------------------------------- seguridad / auth

    @Test
    @DisplayName("login emite token y no expone el hash de la contrasena")
    void loginEmiteToken() {
        var spec = enviar(HttpMethod.POST, "/api/auth/login", null,
                Map.of("username", "admin", "password", "admin123"))
                .expectStatus().isOk();

        JsonNode respuesta = leerJson(spec);

        assertThat(respuesta.get("token").asText()).isNotBlank();
        assertThat(respuesta.get("tipo").asText()).isEqualTo("Bearer");
        assertThat(respuesta.get("rol").asText()).isEqualTo("ADMIN");
        assertThat(respuesta.toString()).doesNotContain("password_hash");
    }

    @Test
    @DisplayName("credenciales invalidas -> 422 con mensaje claro")
    void loginConCredencialesInvalidas() {
        enviar(HttpMethod.POST, "/api/auth/login", null,
                Map.of("username", "admin", "password", "incorrecta"))
                .expectStatus().isEqualTo(HttpStatusCode.valueOf(422))
                .expectBody().jsonPath("$.mensaje").value(String.class, m -> assertThat(m).contains("incorrectos"));
    }

    @Test
    @DisplayName("sin token -> 401")
    void sinToken() {
        enviar(HttpMethod.GET, "/api/lote", null, null)
                .expectStatus().isEqualTo(HttpStatus.UNAUTHORIZED)
                .expectBody().jsonPath("$.ruta").value(String.class, m -> assertThat(m).isEqualTo("/api/lote"));
    }

    @Test
    @DisplayName("token invalido o manipulado -> 401, no 500")
    void tokenInvalido() {
        enviar(HttpMethod.GET, "/api/lote", "no.es.un.jwt", null)
                .expectStatus().isEqualTo(HttpStatus.UNAUTHORIZED);
    }

    // ----------------------------------------------------------- validaciones

    @Test
    @DisplayName("rango de temperatura invertido -> 422")
    void rangoInvertido() {
        var spec = enviar(HttpMethod.POST, "/api/producto", tokenAdmin(),
                Map.of("nombre", "Invertido " + sufijo(), "temperatura_min", 10, "temperatura_max", 2))
                .expectStatus().isEqualTo(HttpStatusCode.valueOf(422));

        assertThat(leerJson(spec).get("mensaje").asText()).contains("temperaturaMin");
    }

    @Test
    @DisplayName("body incompleto -> 400 con errores por campo")
    void bodyIncompleto() {
        var spec = enviar(HttpMethod.POST, "/api/producto", tokenAdmin(), Map.of("nombre", ""))
                .expectStatus().isEqualTo(HttpStatus.BAD_REQUEST);

        JsonNode campos = leerJson(spec).get("campos");

        assertThat(campos.has("nombre")).isTrue();
    }

    @Test
    @DisplayName("codigo de lote duplicado -> 409")
    void loteDuplicado() {
        String token = tokenAdmin();
        long producto = crearProducto(token, "Dup " + sufijo(), "2", "8");
        String codigo = "LOT-DUP-" + sufijo();
        crearLote(token, producto, codigo, "10");

        enviar(HttpMethod.POST, "/api/lote", token,
                Map.of("id_producto", producto, "codigo_lote", codigo, "cantidad", 5))
                .expectStatus().isEqualTo(HttpStatus.CONFLICT);
    }

    @Test
    @DisplayName("recurso inexistente -> 404")
    void recursoInexistente() {
        enviar(HttpMethod.GET, "/api/lote/999999999", tokenAdmin(), null)
                .expectStatus().isEqualTo(HttpStatus.NOT_FOUND);
    }

    // ---------------------------------------------------------------- negocio

    @Test
    @DisplayName("el JSON usa snake_case igual que las columnas")
    void jsonEnSnakeCase() {
        var spec = enviar(HttpMethod.POST, "/api/producto", tokenAdmin(), Map.of(
                        "nombre", "Snake " + sufijo(),
                        "temperatura_min", 2, "temperatura_max", 8,
                        "humedad_min", 60, "humedad_max", 80))
                .expectStatus().isEqualTo(HttpStatus.CREATED);

        JsonNode producto = leerJson(spec);

        assertThat(producto.has("temperatura_min")).isTrue();
        assertThat(producto.has("define_rango_temperatura")).isTrue();
        assertThat(producto.get("temperatura_min").asDouble()).isEqualTo(2.0);
        assertThat(producto.has("temperaturaMin")).isFalse();
    }

    @Test
    @DisplayName("lectura dentro de rango -> NORMAL y sin incidencia")
    void controlNormal() {
        String token = tokenAdmin();
        String s = sufijo();
        long producto = crearProducto(token, "Normal " + s, "2", "8");
        long lote = crearLote(token, producto, "LOT-N-" + s, "100");
        long despacho = crearDespacho(token, "ENV-N-" + s);
        asociarLote(token, despacho, lote, "100");

        JsonNode control = registrarControl(token, despacho, lote, "5.10");

        assertThat(control.get("resultado").asText()).isEqualTo("NORMAL");
        assertThat(control.get("motivo_desviacion").isNull()).isTrue();

        enviar(HttpMethod.GET, "/api/incidencia?idLote=" + lote, token, null)
                .expectStatus().isOk()
                .expectBody().jsonPath("$.length()").value(Integer.class, m -> assertThat(m).isZero());
    }

    @Test
    @DisplayName("lectura fuera de rango -> FUERA_RANGO, incidencia automatica y evento")
    void controlFueraDeRangoAbreIncidencia() {
        String token = tokenAdmin();
        String s = sufijo();
        long producto = crearProducto(token, "Fuera " + s, "2", "8");
        long lote = crearLote(token, producto, "LOT-F-" + s, "100");
        long despacho = crearDespacho(token, "ENV-F-" + s);
        asociarLote(token, despacho, lote, "100");

        JsonNode control = registrarControl(token, despacho, lote, "10.40");

        assertThat(control.get("resultado").asText()).isEqualTo("FUERA_RANGO");
        assertThat(control.get("motivo_desviacion").asText()).contains("fuera de 2.00-8.00");

        var spec = enviar(HttpMethod.GET, "/api/incidencia?idLote=" + lote, token, null)
                .expectStatus().isOk();

        JsonNode incidencias = leerJson(spec);

        assertThat(incidencias.size()).isEqualTo(1);
        JsonNode incidencia = incidencias.get(0);
        assertThat(incidencia.get("tipo").asText()).isEqualTo("TEMPERATURA");
        assertThat(incidencia.get("estado").asText()).isEqualTo("ABIERTA");
        assertThat(incidencia.get("prioridad").asText()).isEqualTo("ALTA");

        long idIncidencia = incidencia.get("id_incidencia").asLong();
        enviar(HttpMethod.GET, "/api/incidencia/" + idIncidencia, token, null)
                .expectStatus().isOk()
                .expectBody().jsonPath("$.id_control")
                .value(m -> assertThat(((Number) m).longValue()).isEqualTo(control.get("id_control").asLong()));
    }

    @Test
    @DisplayName("desviacion de humedad tipa la incidencia como HUMEDAD")
    void desviacionDeHumedad() {
        String token = tokenAdmin();
        String s = sufijo();
        long producto = crearProducto(token, "Humedad " + s, "2", "8", "60", "80");
        long lote = crearLote(token, producto, "LOT-H-" + s, "50");
        long despacho = crearDespacho(token, "ENV-H-" + s);
        asociarLote(token, despacho, lote, "50");

        var cuerpo = new LinkedHashMap<String, Object>();
        cuerpo.put("id_despacho", despacho);
        cuerpo.put("id_lote", lote);
        cuerpo.put("temperatura", new java.math.BigDecimal("5.00"));
        cuerpo.put("humedad", new java.math.BigDecimal("91.00"));
        var control = leerJson(enviar(HttpMethod.POST, "/api/control", token, cuerpo)
                .expectStatus().isEqualTo(HttpStatus.CREATED));

        assertThat(control.get("resultado").asText()).isEqualTo("FUERA_RANGO");

        JsonNode incidencias = leerJson(enviar(HttpMethod.GET, "/api/incidencia?idLote=" + lote, token, null)
                .expectStatus().isOk());

        assertThat(incidencias.get(0).get("tipo").asText()).isEqualTo("HUMEDAD");
    }

    @Test
    @DisplayName("no se puede leer un lote que no pertenece al despacho")
    void controlDeLoteNoAsociado() {
        String token = tokenAdmin();
        String s = sufijo();
        long producto = crearProducto(token, "Ajeno " + s, "2", "8");
        long lote = crearLote(token, producto, "LOT-A-" + s, "10");
        long despacho = crearDespacho(token, "ENV-A-" + s);

        var cuerpo = Map.of("id_despacho", despacho, "id_lote", lote, "temperatura", 5);
        var spec = enviar(HttpMethod.POST, "/api/control", token, cuerpo)
                .expectStatus().isEqualTo(HttpStatusCode.valueOf(422));

        assertThat(leerJson(spec).get("mensaje").asText()).contains("no esta asociado");
    }

    @Test
    @DisplayName("un lote bloqueado no puede asociarse a un despacho y se libera despues")
    void bloqueoImpideDespacho() {
        String tokenAdmin = tokenAdmin();
        String username = crearUsuario(tokenAdmin, "CALIDAD");
        String tokenCalidad = login(username, "clave12345");
        String s = sufijo();

        long producto = crearProducto(tokenAdmin, "Bloqueo " + s, "2", "8");
        long lote = crearLote(tokenAdmin, producto, "LOT-B-" + s, "100");
        long despachoBloqueado = crearDespacho(tokenAdmin, "ENV-B1-" + s);
        long despachoNuevo = crearDespacho(tokenAdmin, "ENV-B2-" + s);

        JsonNode bloqueado = leerJson(enviar(HttpMethod.PATCH, "/api/lote/" + lote + "/bloquear", tokenCalidad,
                Map.of("motivo", "Desviacion en ruta")).expectStatus().isOk());
        assertThat(bloqueado.get("estado").asText()).isEqualTo("BLOQUEADO");

        enviar(HttpMethod.POST, "/api/despacho/" + despachoNuevo + "/lotes", tokenAdmin,
                        Map.of("id_lote", lote, "cantidad", 10))
                .expectStatus().isEqualTo(HttpStatusCode.valueOf(422))
                .expectBody().jsonPath("$.mensaje")
                .value(String.class, m -> assertThat(m).contains("bloqueado"));

        JsonNode liberado = leerJson(enviar(HttpMethod.PATCH, "/api/lote/" + lote + "/liberar", tokenCalidad,
                Map.of("motivo", "Producto conforme")).expectStatus().isOk());
        assertThat(liberado.get("estado").asText()).isEqualTo("DISPONIBLE");

        assertThat(despachoBloqueado).isPositive();
    }

    @Test
    @DisplayName("el ciclo de la incidencia exige causa para resolver y fija fecha de cierre")
    void cicloDeIncidencia() {
        String tokenAdmin = tokenAdmin();
        String username = crearUsuario(tokenAdmin, "CALIDAD");
        String tokenCalidad = login(username, "clave12345");
        String s = sufijo();

        long producto = crearProducto(tokenAdmin, "Ciclo " + s, "2", "8");
        long lote = crearLote(tokenAdmin, producto, "LOT-C-" + s, "100");
        long despacho = crearDespacho(tokenAdmin, "ENV-C-" + s);
        asociarLote(tokenAdmin, despacho, lote, "100");
        registrarControl(tokenAdmin, despacho, lote, "12.00");

        long incidencia = leerJson(enviar(HttpMethod.GET, "/api/incidencia?idLote=" + lote, tokenAdmin, null)
                .expectStatus().isOk()).get(0).get("id_incidencia").asLong();

        JsonNode enProceso = leerJson(enviar(HttpMethod.PATCH, "/api/incidencia/" + incidencia + "/estado",
                tokenCalidad, Map.of("estado", "EN_PROCESO")).expectStatus().isOk());
        assertThat(enProceso.get("estado").asText()).isEqualTo("EN_PROCESO");

        enviar(HttpMethod.PATCH, "/api/incidencia/" + incidencia + "/estado", tokenCalidad,
                        Map.of("estado", "RESUELTA"))
                .expectStatus().isEqualTo(HttpStatusCode.valueOf(422));

        var resuelta = enviar(HttpMethod.PATCH, "/api/incidencia/" + incidencia + "/estado", tokenCalidad,
                        Map.of("estado", "RESUELTA", "causa", "Puerta abierta", "accion", "Enfriado"))
                .expectStatus().isOk();

        JsonNode json = leerJson(resuelta);

        assertThat(json.get("estado").asText()).isEqualTo("RESUELTA");
        assertThat(json.get("fecha_cierre").isNull()).isFalse();
        assertThat(json.get("causa").asText()).isEqualTo("Puerta abierta");
    }

    @Test
    @DisplayName("la evidencia se adjunta a la incidencia y queda registrada como evento")
    void evidenciaSeAdjunta() {
        String tokenAdmin = tokenAdmin();
        String s = sufijo();
        long producto = crearProducto(tokenAdmin, "Evidencia " + s, "2", "8");
        long lote = crearLote(tokenAdmin, producto, "LOT-E-" + s, "100");
        long despacho = crearDespacho(tokenAdmin, "ENV-E-" + s);
        asociarLote(tokenAdmin, despacho, lote, "100");
        registrarControl(tokenAdmin, despacho, lote, "13.00");

        long incidencia = leerJson(enviar(HttpMethod.GET, "/api/incidencia?idLote=" + lote, tokenAdmin, null)
                .expectStatus().isOk()).get(0).get("id_incidencia").asLong();

        var evidencia = enviar(HttpMethod.POST, "/api/incidencia/" + incidencia + "/evidencias", tokenAdmin,
                        Map.of("tipo", "FOTO", "nombre_archivo", "termo.jpg",
                                "url", "http://localhost:9000/termo.jpg", "descripcion", "Lectura del sensor"))
                .expectStatus().isEqualTo(HttpStatus.CREATED);

        assertThat(leerJson(evidencia).get("nombre_archivo").asText()).isEqualTo("termo.jpg");

        enviar(HttpMethod.GET, "/api/evidencia?idIncidencia=" + incidencia, tokenAdmin, null)
                .expectStatus().isOk()
                .expectBody().jsonPath("$.length()").value(Integer.class, m -> assertThat(m).isEqualTo(1));

        enviar(HttpMethod.GET, "/api/evento?idLote=" + lote, tokenAdmin, null)
                .expectStatus().isOk()
                .expectBody().jsonPath("$.content[?(@.tipo == 'OTRO')]").exists();
    }

    @Test
    @DisplayName("transicion de despacho invalida -> 422 y la entrega propaga el lote")
    void transicionesDeDespacho() {
        String token = tokenAdmin();
        String s = sufijo();
        long producto = crearProducto(token, "Transicion " + s, "2", "8");
        long lote = crearLote(token, producto, "LOT-T-" + s, "100");
        long despacho = crearDespacho(token, "ENV-T-" + s);
        asociarLote(token, despacho, lote, "100");

        enviar(HttpMethod.PATCH, "/api/despacho/" + despacho + "/estado", token, Map.of("estado", "ENTREGADO"))
                .expectStatus().isEqualTo(HttpStatusCode.valueOf(422));

        var salida = enviar(HttpMethod.PATCH, "/api/despacho/" + despacho + "/estado", token,
                Map.of("estado", "EN_TRANSITO")).expectStatus().isOk();
        JsonNode jsonSalida = leerJson(salida);
        assertThat(jsonSalida.get("estado").asText()).isEqualTo("EN_TRANSITO");
        assertThat(jsonSalida.get("fecha_salida").isNull()).isFalse();

        enviar(HttpMethod.GET, "/api/lote/" + lote, token, null)
                .expectStatus().isOk()
                .expectBody().jsonPath("$.estado").value(String.class, m -> assertThat(m).isEqualTo("EN_TRANSITO"));

        enviar(HttpMethod.PATCH, "/api/despacho/" + despacho + "/estado", token, Map.of("estado", "ENTREGADO"))
                .expectStatus().isOk();

        enviar(HttpMethod.GET, "/api/lote/" + lote, token, null)
                .expectStatus().isOk()
                .expectBody().jsonPath("$.estado").value(String.class, m -> assertThat(m).isEqualTo("ENTREGADO"));
    }

    @Test
    @DisplayName("no se puede despachar mas de la cantidad del lote")
    void cantidadExcedeAlLote() {
        String token = tokenAdmin();
        String s = sufijo();
        long producto = crearProducto(token, "Cantidad " + s, "2", "8");
        long lote = crearLote(token, producto, "LOT-Q-" + s, "10");
        long despacho = crearDespacho(token, "ENV-Q-" + s);

        var spec = enviar(HttpMethod.POST, "/api/despacho/" + despacho + "/lotes", token,
                        Map.of("id_lote", lote, "cantidad", 25))
                .expectStatus().isEqualTo(HttpStatusCode.valueOf(422));

        assertThat(leerJson(spec).get("mensaje").asText()).contains("comprometido");
    }

    @Test
    @DisplayName("el lote y el mismo lote no puede repetirse en un despacho")
    void loteRepetidoEnDespacho() {
        String token = tokenAdmin();
        String s = sufijo();
        long producto = crearProducto(token, "Repetido " + s, "2", "8");
        long lote = crearLote(token, producto, "LOT-R-" + s, "100");
        long despacho = crearDespacho(token, "ENV-R-" + s);
        asociarLote(token, despacho, lote, "10");

        enviar(HttpMethod.POST, "/api/despacho/" + despacho + "/lotes", token,
                        Map.of("id_lote", lote, "cantidad", 5))
                .expectStatus().isEqualTo(HttpStatus.CONFLICT);
    }

    // ------------------------------------------------------------- trazabilidad

    @Test
    @DisplayName("la trazabilidad del lote reconstruye despacho, controles, incidencias y timeline")
    void trazabilidadDelLote() {
        String token = tokenAdmin();
        String s = sufijo();
        long producto = crearProducto(token, "Trazabilidad " + s, "2", "8");
        long lote = crearLote(token, producto, "LOT-TZ-" + s, "100");
        long despacho = crearDespacho(token, "ENV-TZ-" + s);
        asociarLote(token, despacho, lote, "100");

        registrarControl(token, despacho, lote, "5.10");
        enviar(HttpMethod.PATCH, "/api/despacho/" + despacho + "/estado", token, Map.of("estado", "EN_TRANSITO"))
                .expectStatus().isOk();
        registrarControl(token, despacho, lote, "10.40");

        long incidencia = leerJson(enviar(HttpMethod.GET, "/api/incidencia?idLote=" + lote, token, null)
                .expectStatus().isOk()).get(0).get("id_incidencia").asLong();

        enviar(HttpMethod.POST, "/api/incidencia/" + incidencia + "/evidencias", token,
                        Map.of("tipo", "FOTO", "nombre_archivo", "foto.jpg"))
                .expectStatus().isEqualTo(HttpStatus.CREATED);

        var spec = enviar(HttpMethod.GET, "/api/trazabilidad/lote/" + lote, token, null)
                .expectStatus().isOk();

        JsonNode trazabilidad = leerJson(spec);

        assertThat(trazabilidad.get("codigo_lote").asText()).isEqualTo("LOT-TZ-" + s);
        assertThat(trazabilidad.get("producto").get("nombre").asText()).isEqualTo("Trazabilidad " + s);
        assertThat(trazabilidad.get("despachos").size()).isEqualTo(1);
        assertThat(trazabilidad.get("despachos").get(0).get("codigo").asText()).isEqualTo("ENV-TZ-" + s);
        assertThat(trazabilidad.get("controles").size()).isEqualTo(2);
        assertThat(trazabilidad.get("incidencias").size()).isEqualTo(1);
        assertThat(trazabilidad.get("evidencias").size()).isEqualTo(1);

        List<String> timeline = new java.util.ArrayList<>();
        trazabilidad.get("timeline").forEach(e -> timeline.add(e.get("tipo").asText()));

        assertThat(timeline).contains("CREACION_LOTE", "PREPARACION", "CONTROL", "SALIDA");
        assertThat(timeline.get(0)).isEqualTo("CREACION_LOTE");
    }

    @Test
    @DisplayName("la trazabilidad del despacho lista sus lotes y controles")
    void trazabilidadDelDespacho() {
        String token = tokenAdmin();
        String s = sufijo();
        long producto = crearProducto(token, "TrazDespacho " + s, "2", "8");
        long lote = crearLote(token, producto, "LOT-TD-" + s, "100");
        long despacho = crearDespacho(token, "ENV-TD-" + s);
        asociarLote(token, despacho, lote, "100");
        registrarControl(token, despacho, lote, "6.00");

        JsonNode trazabilidad = leerJson(enviar(HttpMethod.GET, "/api/trazabilidad/despacho/" + despacho, token, null)
                .expectStatus().isOk());

        assertThat(trazabilidad.get("codigo").asText()).isEqualTo("ENV-TD-" + s);
        assertThat(trazabilidad.get("lotes").size()).isEqualTo(1);
        assertThat(trazabilidad.get("lotes").get(0).get("codigo_lote").asText()).isEqualTo("LOT-TD-" + s);
        assertThat(trazabilidad.get("controles").size()).isEqualTo(1);
        assertThat(trazabilidad.get("controles").get(0).get("resultado").asText()).isEqualTo("NORMAL");
        assertThat(trazabilidad.get("responsable").asText()).isEqualTo("admin");
    }

    // -------------------------------------------------------------- dashboard

    @Test
    @DisplayName("el dashboard agrega cumplimiento, lotes, incidencias y despachos")
    void dashboard() {
        var spec = enviar(HttpMethod.GET, "/api/dashboard", tokenAdmin(), null).expectStatus().isOk();

        JsonNode dashboard = leerJson(spec);

        assertThat(dashboard.get("cumplimiento").has("porcentaje_en_rango")).isTrue();
        assertThat(dashboard.get("lotes").has("bloqueados")).isTrue();
        assertThat(dashboard.get("incidencias").has("abiertas")).isTrue();
        assertThat(dashboard.get("despachos_por_estado").size()).isEqualTo(5);
        assertThat(dashboard.get("cumplimiento_por_producto").isArray()).isTrue();
        assertThat(dashboard.has("eventos_recientes")).isTrue();
    }

    // ----------------------------------------------------------------- roles

    @Test
    @DisplayName("OPERADOR puede operar pero no crear productos ni incidencias")
    void permisosDeOperador() {
        String tokenAdmin = tokenAdmin();
        String operador = crearUsuario(tokenAdmin, "OPERADOR");
        String token = login(operador, "clave12345");
        String s = sufijo();
        long producto = crearProducto(tokenAdmin, "Operador " + s, "2", "8");
        long lote = crearLote(tokenAdmin, producto, "LOT-OP-" + s, "50");
        long despacho = crearDespacho(tokenAdmin, "ENV-OP-" + s);
        asociarLote(tokenAdmin, despacho, lote, "50");

        registrarControl(token, despacho, lote, "5.00");

        enviar(HttpMethod.POST, "/api/producto", token, Map.of("nombre", "No permitido " + s))
                .expectStatus().isEqualTo(HttpStatus.FORBIDDEN);

        enviar(HttpMethod.POST, "/api/incidencia", token, Map.of("id_lote", lote, "descripcion", "x"))
                .expectStatus().isEqualTo(HttpStatus.FORBIDDEN);

        enviar(HttpMethod.PATCH, "/api/lote/" + lote + "/bloquear", token, Map.of("motivo", "x"))
                .expectStatus().isEqualTo(HttpStatus.FORBIDDEN);

        enviar(HttpMethod.GET, "/api/lote/" + lote, token, null)
                .expectStatus().isOk();
    }

    @Test
    @DisplayName("SUPERVISOR lee pero no escribe")
    void permisosDeSupervisor() {
        String tokenAdmin = tokenAdmin();
        String supervisor = crearUsuario(tokenAdmin, "SUPERVISOR");
        String token = login(supervisor, "clave12345");

        enviar(HttpMethod.GET, "/api/dashboard", token, null).expectStatus().isOk();
        enviar(HttpMethod.GET, "/api/trazabilidad/lote/1", token, null)
                .expectStatus().value(status -> assertThat(status).isLessThan(500));
        enviar(HttpMethod.POST, "/api/despacho", token,
                        Map.of("codigo", "ENV-SUP-" + sufijo(), "destino", "X"))
                .expectStatus().isEqualTo(HttpStatus.FORBIDDEN);
        enviar(HttpMethod.POST, "/api/producto", token, Map.of("nombre", "X " + sufijo()))
                .expectStatus().isEqualTo(HttpStatus.FORBIDDEN);
    }

    @Test
    @DisplayName("todos los roles leen el catalogo de usuarios; solo ADMIN lo gestiona")
    void permisosDeCalidadYAdmin() {
        String tokenAdmin = tokenAdmin();
        String calidad = crearUsuario(tokenAdmin, "CALIDAD");
        String tokenCalidad = login(calidad, "clave12345");

        enviar(HttpMethod.GET, "/api/usuario/activos", tokenCalidad, null)
                .expectStatus().isOk();
        enviar(HttpMethod.GET, "/api/usuario/activos", tokenAdmin, null)
                .expectStatus().isOk();

        enviar(HttpMethod.POST, "/api/usuario", tokenCalidad, Map.of(
                "nombre", "No", "apellido", "Permitido", "username", "x_" + sufijo(),
                "password", "clave12345", "rol", "ADMIN"))
                .expectStatus().isEqualTo(HttpStatus.FORBIDDEN);
    }

    @Test
    @DisplayName("GET /api/usuario nunca devuelve el hash de la contrasena")
    void usuarioNoExponePasswordHash() {
        var spec = enviar(HttpMethod.GET, "/api/usuario/activos", tokenAdmin(), null).expectStatus().isOk();

        assertThat(leerJson(spec).toString()).doesNotContain("password_hash");
    }

    @Test
    @DisplayName("un evento manual debe anclarse a un lote o a un despacho")
    void eventoManualValidado() {
        String token = tokenAdmin();

        enviar(HttpMethod.POST, "/api/evento", token,
                        Map.of("tipo", "CAMBIO_UBICACION", "descripcion", "sin ancla"))
                .expectStatus().isEqualTo(HttpStatusCode.valueOf(422));

        long producto = crearProducto(token, "Evento " + sufijo(), "2", "8");
        long lote = crearLote(token, producto, "LOT-EV-" + sufijo(), "1");

        JsonNode evento = leerJson(enviar(HttpMethod.POST, "/api/evento", token,
                Map.of("id_lote", lote, "tipo", "CAMBIO_UBICACION",
                        "descripcion", "Recepcion en punto de descarga", "ubicacion", "Almacen X"))
                .expectStatus().isEqualTo(HttpStatus.CREATED));
        assertThat(evento.get("ubicacion").asText()).isEqualTo("Almacen X");
    }

}