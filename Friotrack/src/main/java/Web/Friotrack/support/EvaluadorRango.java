package Web.Friotrack.support;

import java.math.BigDecimal;

import Web.Friotrack.entity.Control;
import Web.Friotrack.entity.Producto;

/**
 * Evaluacion de una lectura contra los limites configurados en el producto.
 * Regla: un limite NULO no se evalua. Si el producto no define ningun limite,
 * o el valor medido es NULO, no hay desviacion posible.
 */
public final class EvaluadorRango {

    private EvaluadorRango() {
    }

    public static boolean fueraDeRango(BigDecimal valor, BigDecimal min, BigDecimal max) {
        if (valor == null) {
            return false;
        }
        if (min != null && valor.compareTo(min) < 0) {
            return true;
        }
        return max != null && valor.compareTo(max) > 0;
    }

    public static boolean hayDesviacion(BigDecimal temperatura, BigDecimal humedad, Producto producto) {
        if (producto == null) {
            return false;
        }
        return fueraDeRango(temperatura, producto.getTemperaturaMin(), producto.getTemperaturaMax())
                || fueraDeRango(humedad, producto.getHumedadMin(), producto.getHumedadMax());
    }

    public static Control.Resultado evaluar(BigDecimal temperatura, BigDecimal humedad, Producto producto) {
        return hayDesviacion(temperatura, humedad, producto)
                ? Control.Resultado.FUERA_RANGO
                : Control.Resultado.NORMAL;
    }

    public static String motivo(Control control) {
        if (control.getResultado() != Control.Resultado.FUERA_RANGO) {
            return null;
        }
        Producto producto = control.getLote().getProducto();
        StringBuilder motivo = new StringBuilder();
        if (fueraDeRango(control.getTemperatura(), producto.getTemperaturaMin(), producto.getTemperaturaMax())) {
            motivo.append("temperatura ").append(control.getTemperatura()).append(" °C fuera de ")
                    .append(producto.getTemperaturaMin()).append("-")
                    .append(producto.getTemperaturaMax()).append(" °C");
        }
        if (fueraDeRango(control.getHumedad(), producto.getHumedadMin(), producto.getHumedadMax())) {
            if (motivo.length() > 0) {
                motivo.append("; ");
            }
            motivo.append("humedad ").append(control.getHumedad()).append(" % fuera de ")
                    .append(producto.getHumedadMin()).append("-")
                    .append(producto.getHumedadMax()).append(" %");
        }
        return motivo.toString();
    }

}
