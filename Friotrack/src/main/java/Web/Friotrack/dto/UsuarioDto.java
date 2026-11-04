package Web.Friotrack.dto;

import java.time.LocalDateTime;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import Web.Friotrack.entity.Usuario;

public class UsuarioDto {

    public record Request(
            @NotBlank @Size(max = 100) String nombre,
            @NotBlank @Size(max = 100) String apellido,
            @NotBlank @Size(max = 80) String username,
            @Size(min = 8, max = 255) String password,
            Usuario.Rol rol,
            Boolean activo) {
    }

    public record Actualizacion(
            @NotBlank @Size(max = 100) String nombre,
            @NotBlank @Size(max = 100) String apellido,
            Usuario.Rol rol,
            Boolean activo) {
    }

    public record Response(
            Long idUsuario,
            String nombre,
            String apellido,
            String username,
            Usuario.Rol rol,
            Boolean activo,
            LocalDateTime fechaCreacion) {

        public static Response of(Usuario usuario) {
            return new Response(usuario.getIdUsuario(), usuario.getNombre(), usuario.getApellido(),
                    usuario.getUsername(), usuario.getRol(), usuario.getActivo(), usuario.getFechaCreacion());
        }
    }

    public record CambioPassword(
            @NotBlank @Size(min = 8, max = 255) String passwordActual,
            @NotBlank @Size(min = 8, max = 255) String passwordNuevo) {
    }

    public record Credenciales(
            String token,
            String tipo,
            Long idUsuario,
            String username,
            Usuario.Rol rol,
            long expiraEnSegundos) {
    }

    public record LoginRequest(
            @NotBlank String username,
            @NotBlank String password) {
    }

}
