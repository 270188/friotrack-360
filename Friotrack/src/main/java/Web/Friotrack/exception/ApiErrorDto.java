package Web.Friotrack.exception;

import java.time.LocalDateTime;
import java.util.Map;

public record ApiErrorDto(
        LocalDateTime timestamp,
        int status,
        String error,
        String mensaje,
        String ruta,
        Map<String, String> campos) {

    public static ApiErrorDto of(int status, String error, String mensaje, String ruta) {
        return new ApiErrorDto(LocalDateTime.now(), status, error, mensaje, ruta, null);
    }

    public static ApiErrorDto of(int status, String error, String mensaje, String ruta, Map<String, String> campos) {
        return new ApiErrorDto(LocalDateTime.now(), status, error, mensaje, ruta, campos);
    }

}
