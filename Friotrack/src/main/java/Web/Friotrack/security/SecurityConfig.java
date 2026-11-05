package Web.Friotrack.security;

import java.util.List;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.web.AuthenticationEntryPoint;
import org.springframework.security.authentication.dao.DaoAuthenticationProvider;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.security.web.access.AccessDeniedHandler;

import tools.jackson.databind.ObjectMapper;

import Web.Friotrack.exception.ApiErrorDto;

import jakarta.servlet.http.HttpServletRequest;

@Configuration
@EnableWebSecurity
@EnableMethodSecurity
public class SecurityConfig {

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http,
                                           JwtAuthFilter jwtAuthFilter,
                                           ObjectMapper objectMapper,
                                           @Value("${app.cors.allowed-origins:http://localhost:3000,http://127.0.0.1:3000}")
                                           String origenesPermitidos) throws Exception {

        return http
                .csrf(csrf -> csrf.disable())
                .cors(cors -> cors.configurationSource(corsSource(origenesPermitidos)))
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers("/api/auth/login", "/error", "/actuator/health").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/usuario/**")
                        .hasAnyRole("OPERADOR", "CALIDAD", "SUPERVISOR", "ADMIN")
                        .requestMatchers("/api/usuario/**").hasRole("ADMIN")
                        .requestMatchers("/api/lote/*/bloquear",
                                "/api/lote/*/liberar",
                                "/api/lote/*/descartar").hasAnyRole("CALIDAD", "ADMIN")
                        .requestMatchers(HttpMethod.POST, "/api/producto").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.PUT, "/api/producto/**").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.DELETE, "/api/producto/**").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.POST, "/api/incidencia/**", "/api/evidencia/**")
                        .hasAnyRole("CALIDAD", "ADMIN")
                        .requestMatchers(HttpMethod.PUT, "/api/incidencia/**", "/api/evidencia/**")
                        .hasAnyRole("CALIDAD", "ADMIN")
                        .requestMatchers(HttpMethod.PATCH, "/api/incidencia/**", "/api/evidencia/**")
                        .hasAnyRole("CALIDAD", "ADMIN")
                        .requestMatchers(HttpMethod.DELETE, "/api/evidencia/**").hasAnyRole("CALIDAD", "ADMIN")
                        .requestMatchers(HttpMethod.POST, "/api/comprobante/**").hasAnyRole("OPERADOR", "ADMIN")
                        .requestMatchers(HttpMethod.GET).hasAnyRole("OPERADOR", "CALIDAD", "SUPERVISOR", "ADMIN")
                        .anyRequest().hasAnyRole("OPERADOR", "CALIDAD", "ADMIN"))
                .exceptionHandling(ex -> ex
                        .authenticationEntryPoint(jsonEntryPoint(objectMapper))
                        .accessDeniedHandler(jsonAccessDeniedHandler(objectMapper)))
                .addFilterBefore(jwtAuthFilter, UsernamePasswordAuthenticationFilter.class)
                .build();
    }

    /**
     * Origenes permitidos separados por coma (app.cors.allowed-origins / APP_CORS_ORIGINS).
     * Acepta patrones, por ejemplo https://*.vercel.app o https://*.netlify.app.
     */
    private org.springframework.web.cors.CorsConfigurationSource corsSource(String origenesPermitidos) {
        var config = new org.springframework.web.cors.CorsConfiguration();
        config.setAllowedOriginPatterns(java.util.Arrays.stream(origenesPermitidos.split(","))
                .map(String::trim)
                .filter(o -> !o.isEmpty())
                .toList());
        config.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
        config.setAllowedHeaders(List.of("Authorization", "Content-Type"));
        config.setExposedHeaders(List.of("Authorization"));
        config.setAllowCredentials(true);
        var source = new org.springframework.web.cors.UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/api/**", config);
        return source;
    }

    private AuthenticationEntryPoint jsonEntryPoint(ObjectMapper objectMapper) {
        return (request, response, authException) -> escribirJson(response, objectMapper, HttpStatus.UNAUTHORIZED,
                request, "Credenciales invalidas o token ausente");
    }

    private AccessDeniedHandler jsonAccessDeniedHandler(ObjectMapper objectMapper) {
        return (request, response, ex) -> escribirJson(response, objectMapper, HttpStatus.FORBIDDEN, request,
                "No cuenta con permisos para esta operacion");
    }

    private void escribirJson(jakarta.servlet.http.HttpServletResponse response,
                              ObjectMapper objectMapper,
                              HttpStatus status,
                              HttpServletRequest request,
                              String mensaje) throws java.io.IOException {
        response.setStatus(status.value());
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.setCharacterEncoding("UTF-8");
        objectMapper.writeValue(response.getOutputStream(),
                ApiErrorDto.of(status.value(), status.getReasonPhrase(), mensaje, request.getRequestURI()));
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    public DaoAuthenticationProvider authenticationProvider(UsuarioDetailsService usuarioDetailsService,
                                                            PasswordEncoder passwordEncoder) {
        DaoAuthenticationProvider provider = new DaoAuthenticationProvider(usuarioDetailsService);
        provider.setPasswordEncoder(passwordEncoder);
        return provider;
    }

    @Bean
    public AuthenticationManager authenticationManager(AuthenticationConfiguration configuration) throws Exception {
        return configuration.getAuthenticationManager();
    }

}
