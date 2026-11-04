package Web.Friotrack.exception;

import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.AuthenticationException;
import org.springframework.validation.FieldError;
import org.springframework.web.HttpMediaTypeNotSupportedException;
import org.springframework.web.HttpRequestMethodNotSupportedException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.servlet.NoHandlerFoundException;
import org.springframework.web.servlet.resource.NoResourceFoundException;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.ConstraintViolationException;

@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    @ExceptionHandler(NotFoundException.class)
    public ResponseEntity<ApiErrorDto> notFound(NotFoundException ex, HttpServletRequest req) {
        return responder(HttpStatus.NOT_FOUND, ex.getMessage(), req);
    }

    @ExceptionHandler(BusinessRuleException.class)
    public ResponseEntity<ApiErrorDto> businessRule(BusinessRuleException ex, HttpServletRequest req) {
        return responder(HttpStatus.UNPROCESSABLE_ENTITY, ex.getMessage(), req);
    }

    @ExceptionHandler(ConflictException.class)
    public ResponseEntity<ApiErrorDto> conflict(ConflictException ex, HttpServletRequest req) {
        return responder(HttpStatus.CONFLICT, ex.getMessage(), req);
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ApiErrorDto> validacion(MethodArgumentNotValidException ex, HttpServletRequest req) {
        Map<String, String> campos = new LinkedHashMap<>();
        for (FieldError fe : ex.getBindingResult().getFieldErrors()) {
            campos.putIfAbsent(fe.getField(), fe.getDefaultMessage());
        }
        return ResponseEntity.badRequest()
                .body(ApiErrorDto.of(400, "Bad Request", "Datos invalidos en la solicitud", ruta(req), campos));
    }

    @ExceptionHandler(ConstraintViolationException.class)
    public ResponseEntity<ApiErrorDto> constraint(ConstraintViolationException ex, HttpServletRequest req) {
        Map<String, String> campos = new LinkedHashMap<>();
        ex.getConstraintViolations().forEach(v -> campos.put(v.getPropertyPath().toString(), v.getMessage()));
        return ResponseEntity.badRequest()
                .body(ApiErrorDto.of(400, "Bad Request", "Datos invalidos en la solicitud", ruta(req), campos));
    }

    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<ApiErrorDto> noLegible(HttpMessageNotReadableException ex, HttpServletRequest req) {
        return responder(HttpStatus.BAD_REQUEST, "Cuerpo de la solicitud invalido o valor de enum desconocido", req);
    }

    @ExceptionHandler(DataIntegrityViolationException.class)
    public ResponseEntity<ApiErrorDto> integridad(DataIntegrityViolationException ex, HttpServletRequest req) {
        log.warn("Violacion de integridad en {}: {}", ruta(req), ex.getMostSpecificCause().getMessage());
        return responder(HttpStatus.CONFLICT,
                "La operacion viola una restriccion de integridad (valor duplicado o referencia invalida)", req);
    }

    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<ApiErrorDto> prohibido(AccessDeniedException ex, HttpServletRequest req) {
        return responder(HttpStatus.FORBIDDEN, "No cuenta con permisos para esta operacion", req);
    }

    @ExceptionHandler(AuthenticationException.class)
    public ResponseEntity<ApiErrorDto> noAutenticado(AuthenticationException ex, HttpServletRequest req) {
        return responder(HttpStatus.UNAUTHORIZED, "Credenciales invalidas o token ausente", req);
    }

    @ExceptionHandler(HttpMediaTypeNotSupportedException.class)
    public ResponseEntity<ApiErrorDto> mediaTypeNoSoportado(HttpMediaTypeNotSupportedException ex,
                                                            HttpServletRequest req) {
        return responder(HttpStatus.UNSUPPORTED_MEDIA_TYPE,
                "Content-Type no soportado: use application/json", req);
    }

    @ExceptionHandler(HttpRequestMethodNotSupportedException.class)
    public ResponseEntity<ApiErrorDto> metodoNoSoportado(HttpRequestMethodNotSupportedException ex,
                                                         HttpServletRequest req) {
        return ResponseEntity.status(HttpStatus.METHOD_NOT_ALLOWED)
                .header("Allow", String.join(", ", ex.getSupportedHttpMethods() != null
                        ? ex.getSupportedHttpMethods().stream().map(Object::toString).toList()
                        : java.util.List.of()))
                .body(ApiErrorDto.of(405, HttpStatus.METHOD_NOT_ALLOWED.getReasonPhrase(),
                        "Metodo " + ex.getMethod() + " no permitido en esta ruta", ruta(req)));
    }

    @ExceptionHandler({NoResourceFoundException.class, NoHandlerFoundException.class})
    public ResponseEntity<ApiErrorDto> rutaNoEncontrada(Exception ex, HttpServletRequest req) {
        return responder(HttpStatus.NOT_FOUND, "El recurso solicitado no existe", req);
    }

    @ExceptionHandler(MethodArgumentTypeMismatchException.class)
    public ResponseEntity<ApiErrorDto> tipoInvalido(MethodArgumentTypeMismatchException ex,
                                                   HttpServletRequest req) {
        String requerido = ex.getRequiredType() == null
                ? "el tipo esperado"
                : (ex.getRequiredType().isEnum()
                        ? "uno de " + Arrays.toString(ex.getRequiredType().getEnumConstants())
                        : ex.getRequiredType().getSimpleName());
        return responder(HttpStatus.BAD_REQUEST,
                "Valor invalido para '" + ex.getName() + "': " + ex.getValue() + ". Se esperaba " + requerido,
                req);
    }

    @ExceptionHandler(MissingServletRequestParameterException.class)
    public ResponseEntity<ApiErrorDto> parametroFaltante(MissingServletRequestParameterException ex,
                                                          HttpServletRequest req) {
        return responder(HttpStatus.BAD_REQUEST, "Falta el parametro obligatorio '" + ex.getParameterName() + "'", req);
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiErrorDto> inesperado(Exception ex, HttpServletRequest req) {
        log.error("Error inesperado en {}", ruta(req), ex);
        return responder(HttpStatus.INTERNAL_SERVER_ERROR, "Error interno del servidor", req);
    }

    private ResponseEntity<ApiErrorDto> responder(HttpStatus status, String mensaje, HttpServletRequest req) {
        return ResponseEntity.status(status)
                .body(ApiErrorDto.of(status.value(), status.getReasonPhrase(), mensaje, ruta(req)));
    }

    private String ruta(HttpServletRequest req) {
        return req.getRequestURI();
    }

}
