package Web.Friotrack.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "app.jwt")
public record JwtProperties(String secret, long expirationSegundos) {

    public static final String SECRET_POR_DEFECTO = "b260a64be60f4f2f51303b3c2186ecaabfb2937be1f8bc94eb93e23a7c7e9672";

    public JwtProperties {
        if (secret == null || secret.isBlank()) {
            secret = SECRET_POR_DEFECTO;
        }
        if (expirationSegundos <= 0) {
            expirationSegundos = 7200;
        }
    }

    public boolean usaSecretPorDefecto() {
        return SECRET_POR_DEFECTO.equals(secret);
    }

}
