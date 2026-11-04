package Web.Friotrack.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.math.BigDecimal;
import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import Web.Friotrack.dto.ControlDto;
import Web.Friotrack.entity.Control;
import Web.Friotrack.entity.Despacho;
import Web.Friotrack.entity.Evento;
import Web.Friotrack.entity.Lote;
import Web.Friotrack.entity.Producto;
import Web.Friotrack.entity.Usuario;
import Web.Friotrack.exception.BusinessRuleException;
import Web.Friotrack.repository.ControlRepository;
import Web.Friotrack.repository.DespachoLoteRepository;
import Web.Friotrack.repository.DespachoRepository;
import Web.Friotrack.repository.LoteRepository;
import Web.Friotrack.security.UsuarioActualProvider;

@ExtendWith(MockitoExtension.class)
class ControlServiceTest {

    @Mock
    private ControlRepository controlRepository;
    @Mock
    private DespachoRepository despachoRepository;
    @Mock
    private DespachoLoteRepository despachoLoteRepository;
    @Mock
    private LoteRepository loteRepository;
    @Mock
    private IncidenciaService incidenciaService;
    @Mock
    private EventoService eventoService;
    @Mock
    private UsuarioActualProvider usuarioActual;

    private ControlService controlService;
    private Usuario operador;
    private Despacho despacho;
    private Lote lote;

    @BeforeEach
    void setUp() {
        controlService = new ControlService(controlRepository, despachoRepository, despachoLoteRepository,
                loteRepository, incidenciaService, eventoService, usuarioActual);

        operador = new Usuario();
        operador.setIdUsuario(7L);
        operador.setUsername("operador");
        operador.setRol(Usuario.Rol.OPERADOR);

        Producto producto = new Producto();
        producto.setIdProducto(1L);
        producto.setNombre("Refrigerado A");
        producto.setTemperaturaMin(new BigDecimal("2.00"));
        producto.setTemperaturaMax(new BigDecimal("8.00"));
        producto.setHumedadMin(new BigDecimal("60.00"));
        producto.setHumedadMax(new BigDecimal("80.00"));

        despacho = new Despacho();
        despacho.setIdDespacho(10L);
        despacho.setCodigo("ENV-2026-00125");
        despacho.setEstado(Despacho.Estado.EN_TRANSITO);

        lote = new Lote();
        lote.setIdLote(20L);
        lote.setCodigoLote("LOT-2026-0045");
        lote.setProducto(producto);

        lenient().when(despachoRepository.findById(10L)).thenReturn(Optional.of(despacho));
        lenient().when(loteRepository.findById(20L)).thenReturn(Optional.of(lote));
        lenient().when(usuarioActual.obtener()).thenReturn(operador);
        lenient().when(controlRepository.save(any(Control.class))).thenAnswer(i -> i.getArgument(0));
    }

    private void loteAsociado() {
        when(despachoLoteRepository.existe(10L, 20L)).thenReturn(true);
    }

    private ControlDto.Request request(BigDecimal temperatura, BigDecimal humedad) {
        return new ControlDto.Request(10L, 20L, null, temperatura, humedad, null);
    }

    @Test
    @DisplayName("una lectura dentro de rango queda NORMAL y no genera incidencia")
    void lecturaNormalNoGeneraIncidencia() {
        loteAsociado();
        var respuesta = controlService.registrar(request(new BigDecimal("5.10"), new BigDecimal("70.00")));

        assertThat(respuesta.resultado()).isEqualTo(Control.Resultado.NORMAL);
        assertThat(respuesta.motivoDesviacion()).isNull();
        verify(incidenciaService, never()).registrarDesviacion(any(), any());
        verify(eventoService).registrar(eq(Evento.Tipo.CONTROL), eq(lote), eq(despacho), eq(operador),
                org.mockito.ArgumentMatchers.contains("NORMAL"));
    }

    @Test
    @DisplayName("una lectura fuera de rango queda FUERA_RANGO y abre incidencia")
    void lecturaFueraDeRangoAbreIncidencia() {
        loteAsociado();
        var respuesta = controlService.registrar(request(new BigDecimal("10.40"), null));

        assertThat(respuesta.resultado()).isEqualTo(Control.Resultado.FUERA_RANGO);
        assertThat(respuesta.motivoDesviacion())
                .isEqualTo("temperatura 10.40 °C fuera de 2.00-8.00 °C");
        verify(incidenciaService).registrarDesviacion(any(Control.class), eq(operador));
    }

    @Test
    @DisplayName("una lectura solo de humedad fuera de rango tambien abre incidencia")
    void desviacionDeHumedadAbreIncidencia() {
        loteAsociado();
        var respuesta = controlService.registrar(request(new BigDecimal("5.00"), new BigDecimal("91.00")));

        assertThat(respuesta.resultado()).isEqualTo(Control.Resultado.FUERA_RANGO);
        verify(incidenciaService).registrarDesviacion(any(Control.class), eq(operador));
    }

    @Test
    @DisplayName("no se puede leer un lote que no pertenece al despacho")
    void rechazaLoteNoAsociado() {
        when(despachoLoteRepository.existe(10L, 20L)).thenReturn(false);

        assertThatThrownBy(() -> controlService.registrar(request(new BigDecimal("5.00"), null)))
                .isInstanceOf(BusinessRuleException.class)
                .hasMessageContaining("no esta asociado al despacho");
    }

    @Test
    @DisplayName("no se puede leer un despacho ya entregado")
    void rechazaDespachoTerminal() {
        loteAsociado();
        despacho.setEstado(Despacho.Estado.ENTREGADO);

        assertThatThrownBy(() -> controlService.registrar(request(new BigDecimal("5.00"), null)))
                .isInstanceOf(BusinessRuleException.class)
                .hasMessageContaining("cerrado");
    }

    @Test
    @DisplayName("la lectura queda firmada por el usuario autenticado")
    void registraAutorDeLaLectura() {
        loteAsociado();
        ArgumentCaptor<Control> captor = ArgumentCaptor.forClass(Control.class);

        controlService.registrar(request(new BigDecimal("5.00"), null));

        verify(controlRepository).save(captor.capture());
        assertThat(captor.getValue().getUsuario()).isEqualTo(operador);
        assertThat(captor.getValue().getFechaHora()).isNotNull();
    }

}