package Web.Friotrack;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.ResultSet;
import java.sql.Statement;
import java.util.List;

/**
 * Parametrizacion de la base de datos usada por las pruebas de integracion.
 *
 * <b>Importante:</b> las pruebas nunca usan la base de desarrollo
 * ({@code friotrack360}); trabajan sobre {@code friotrack360_test} y, si el esquema
 * no esta cargado, se omiten. Para preparar la base de pruebas:
 *
 * <pre>
 * docker run -d --name friotrack-test -e MYSQL_ROOT_PASSWORD=1234 \
 *   -e MYSQL_DATABASE=friotrack360_test -p 3307:3306 mysql:8.0
 * # esperar a que acepte conexiones y cargar el esquema:
 * docker exec -i friotrack-test mysql -uroot -p1234 friotrack360_test \
 *   &lt; ../friotrack360.sql
 * ./mvnw verify -Dfriotrack.test.port=3307
 * </pre>
 *
 * Otros ejemplos:
 * <pre>
 * ./mvnw verify                                   # omite integracion si no hay BD
 * ./mvnw verify -Dfriotrack.test.port=3307        # BD de pruebas en otro puerto
 * ./mvnw verify -Dskiptests                       # solo compilacion
 * </pre>
 */
public final class TestDbConfig {

    private static final List<String> TABLAS = List.of(
            "usuario", "producto", "lote", "despacho", "despacho_lote",
            "control", "incidencia", "evidencia", "evento");

    public static final String HOST = System.getProperty("friotrack.test.host", "127.0.0.1");
    public static final String PUERTO = System.getProperty("friotrack.test.port", "3307");
    public static final String BASE = System.getProperty("friotrack.test.db", "friotrack360_test");
    public static final String USUARIO = System.getProperty("friotrack.test.user", "root");
    public static final String PASSWORD = System.getProperty("friotrack.test.password", "1234");

    private TestDbConfig() {
    }

    public static String jdbcUrl() {
        return "jdbc:mysql://" + HOST + ":" + PUERTO + "/" + BASE
                + "?useSSL=false&allowPublicKeyRetrieval=true&serverTimezone=America/Lima";
    }

    public static String usuario() {
        return USUARIO;
    }

    public static String password() {
        return PASSWORD;
    }

    /**
     * Las pruebas de integracion solo corren contra la base de pruebas y solo si el
     * esquema de {@code friotrack360.sql} esta cargado.
     */
    public static boolean available() {
        try (Connection connection = DriverManager.getConnection(jdbcUrl(), USUARIO, PASSWORD);
             Statement statement = connection.createStatement()) {

            for (String tabla : TABLAS) {
                try (ResultSet rs = statement.executeQuery(
                        "SELECT COUNT(*) FROM information_schema.tables "
                                + "WHERE table_schema = '" + BASE + "' AND table_name = '" + tabla + "'")) {
                    if (!rs.next() || rs.getInt(1) != 1) {
                        return false;
                    }
                }
            }
            return true;

        } catch (Exception ex) {
            return false;
        }
    }

}