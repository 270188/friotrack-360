package Web.Friotrack.support;

import static org.assertj.core.api.Assertions.assertThat;

import java.math.BigDecimal;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

import Web.Friotrack.entity.Control;
import Web.Friotrack.entity.Lote;
import Web.Friotrack.entity.Producto;

class EvaluadorRangoTest {

    private Producto producto(String tMin, String tMax, String hMin, String hMax) {
        Producto producto = new Producto();
        producto.setTemperaturaMin(decimal(tMin));
        producto.setTemperaturaMax(decimal(tMax));
        producto.setHumedadMin(decimal(hMin));
        producto.setHumedadMax(decimal(hMax));
        return producto;
    }

    private BigDecimal decimal(String valor) {
        return valor == null ? null : new BigDecimal(valor);
    }

    @ParameterizedTest
    @CsvSource({
            "5.0,  NORMAL",
            "2.0,  NORMAL",
            "8.0,  NORMAL",
            "1.9,  FUERA_RANGO",
            "8.1,  FUERA_RANGO",
            "-40,  FUERA_RANGO",
            "50,   FUERA_RANGO"
    })
    @DisplayName("compara la temperatura contra el rango del producto")
    void evaluaTemperatura(String temperatura, Control.Resultado esperado) {
        Producto producto = producto("2.00", "8.00", null, null);

        Control.Resultado resultado = EvaluadorRango.evaluar(decimal(temperatura), null, producto);

        assertThat(resultado).isEqualTo(esperado);
    }

    @Test
    @DisplayName("un limite nulo no se evalua")
    void limiteNuloNoSeEvalua() {
        Producto producto = producto(null, "8.00", null, "80.00");

        assertThat(EvaluadorRango.evaluar(decimal("40.00"), decimal("95.00"), producto))
                .isEqualTo(Control.Resultado.FUERA_RANGO);
        assertThat(EvaluadorRango.evaluar(decimal("-40.00"), decimal("10.00"), producto))
                .isEqualTo(Control.Resultado.NORMAL);
    }

    @Test
    @DisplayName("sin limites definidos no hay desviacion posible")
    void productoSinRangosNoSeDesvia() {
        Producto producto = producto(null, null, null, null);

        assertThat(EvaluadorRango.evaluar(decimal("90.00"), decimal("99.00"), producto))
                .isEqualTo(Control.Resultado.NORMAL);
        assertThat(producto.defineRangoTemperatura()).isFalse();
        assertThat(producto.defineRangoHumedad()).isFalse();
    }

    @Test
    @DisplayName("una medida nula no genera desviacion")
    void medidaNulaNoSeDesvia() {
        Producto producto = producto("2.00", "8.00", "60.00", "80.00");

        assertThat(EvaluadorRango.evaluar(null, null, producto)).isEqualTo(Control.Resultado.NORMAL);
    }

    @Test
    @DisplayName("temperatura y humedad se evaluan juntas")
    void evaluaAmbasVariables() {
        Producto producto = producto("2.00", "8.00", "60.00", "80.00");

        assertThat(EvaluadorRango.evaluar(decimal("5.00"), decimal("91.00"), producto))
                .isEqualTo(Control.Resultado.FUERA_RANGO);
        assertThat(EvaluadorRango.evaluar(decimal("5.00"), decimal("70.00"), producto))
                .isEqualTo(Control.Resultado.NORMAL);
    }

    @Test
    @DisplayName("describe el motivo de la desviacion con los limites aplicados")
    void describeMotivo() {
        Producto producto = producto("2.00", "8.00", "60.00", "80.00");

        Control control = new Control();
        control.setResultado(Control.Resultado.FUERA_RANGO);
        control.setTemperatura(decimal("10.40"));
        control.setLote(lote(producto));

        assertThat(EvaluadorRango.motivo(control))
                .isEqualTo("temperatura 10.40 °C fuera de 2.00-8.00 °C");
    }

    @Test
    @DisplayName("el motivo es null cuando la lectura fue normal")
    void motivoNullEnControlNormal() {
        Control control = new Control();
        control.setResultado(Control.Resultado.NORMAL);

        assertThat(EvaluadorRango.motivo(control)).isNull();
    }

    @Test
    @DisplayName("los extremos del rango son validos (min <= x <= max)")
    void extremosDelRangoSonValidos() {
        assertThat(EvaluadorRango.fueraDeRango(decimal("2.00"), decimal("2.00"), decimal("8.00"))).isFalse();
        assertThat(EvaluadorRango.fueraDeRango(decimal("8.00"), decimal("2.00"), decimal("8.00"))).isFalse();
        assertThat(EvaluadorRango.fueraDeRango(decimal("2.01"), decimal("2.00"), decimal("8.00"))).isFalse();
        assertThat(EvaluadorRango.fueraDeRango(decimal("1.99"), decimal("2.00"), decimal("8.00"))).isTrue();
    }

    private Lote lote(Producto producto) {
        Lote lote = new Lote();
        lote.setProducto(producto);
        return lote;
    }

}