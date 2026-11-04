package Web.Friotrack.exception;

public class NotFoundException extends RuntimeException {

    public NotFoundException(String recurso, Object id) {
        super(recurso + " con id " + id + " no encontrado");
    }

    public NotFoundException(String mensaje) {
        super(mensaje);
    }

}
