package Web.Friotrack.security;

import java.nio.charset.StandardCharsets;
import java.util.Date;

import javax.crypto.SecretKey;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import Web.Friotrack.config.JwtProperties;

@Component
public class JwtService {

    private static final Logger log = LoggerFactory.getLogger(JwtService.class);

    private final SecretKey key;
    private final long expirationSegundos;

    public JwtService(JwtProperties properties) {
        this.key = construirClave(properties.secret());
        this.expirationSegundos = properties.expirationSegundos();
        if (properties.usaSecretPorDefecto()) {
            log.warn("app.jwt.secret usa el valor por defecto: define APP_JWT_SECRET antes de exponer la API");
        }
    }

    public String generarToken(String username, Long idUsuario, String rol) {
        Date ahora = new Date();
        return Jwts.builder()
                .subject(username)
                .claim("id", idUsuario)
                .claim("rol", rol)
                .issuedAt(ahora)
                .expiration(new Date(ahora.getTime() + expirationSegundos * 1000L))
                .signWith(key, Jwts.SIG.HS256)
                .compact();
    }

    public String getUsername(String token) {
        return parse(token).getSubject();
    }

    public Long getIdUsuario(String token) {
        Object id = parse(token).get("id");
        return id == null ? null : Long.valueOf(id.toString());
    }

    public String getRol(String token) {
        Object rol = parse(token).get("rol");
        return rol == null ? null : rol.toString();
    }

    public boolean esValido(String token, String username) {
        try {
            Claims claims = parse(token);
            return username.equals(claims.getSubject()) && claims.getExpiration().after(new Date());
        } catch (JwtException | IllegalArgumentException ex) {
            return false;
        }
    }

    public long getExpirationSegundos() {
        return expirationSegundos;
    }

    private Claims parse(String token) {
        return Jwts.parser()
                .verifyWith(key)
                .build()
                .parseSignedClaims(token)
                .getPayload();
    }

    private static SecretKey construirClave(String secret) {
        byte[] bytes = secret.getBytes(StandardCharsets.UTF_8);
        if (bytes.length < 32) {
            throw new IllegalStateException("app.jwt.secret debe tener al menos 32 bytes para firmar con HS256");
        }
        return Keys.hmacShaKeyFor(bytes);
    }

}
