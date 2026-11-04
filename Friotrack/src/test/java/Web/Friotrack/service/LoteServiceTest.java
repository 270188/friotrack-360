package Web.Friotrack.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
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

import Web.Friotrack.entity.Evento;
import Web.Friotrack.entity.Lote;
import Web.Friotrack.entity.Usuario;
import Web.Friotrack.exception.BusinessRuleException;
import Web.Friotrack.repository.DespachoLoteRepository;
import Web.Friotrack.repository.LoteRepository;
import Web.Friotrack.security.UsuarioActualProvider;

@ExtendWith(MockitoExtension.class)
class LoteServiceTest {

    @Mock
    private LoteRepository loteRepository;
    @Mock
    private DespachoLoteRepository despachoLoteRepository;
    @Mock
    private EventoService eventoService;
    @Mock
    private UsuarioActualProvider usuarioActual;

    private LoteService loteService;
    private Lote lote;
    private Usuario calidad;

    @BeforeEach
    void setUp() {
        loteService = new LoteService(loteRepository, null, despachoLoteRepository, eventoService, usuarioActual);

        Web.Friotrack.entity.Producto producto = new Web.Friotrack.entity.Producto();
        producto.setIdProducto(1L);
        producto.setNombre("Refrigerado A");

        lote = new Lote();
        lote.setProducto(producto);
        lote.setIdLote(1L);
        lote.setCodigoLote("LOT-2026-0045");
        lote.setEstado(Lote.Estado.DISPONIBLE);
        lote.setCantidad(new BigDecimal("100"));

        calidad = new Usuario();
        calidad.setIdUsuario(3L);
        calidad.setUsername("calidad");
        calidad.setRol(Usuario.Rol.CALIDAD);

        lenient().when(loteRepository.findById(1L)).thenReturn(Optional.of(lote));
        lenient().when(loteRepository.save(any(Lote.class))).thenAnswer(i -> i.getArgument(0));
        lenient().when(usuarioActual.obtener()).thenReturn(calidad);
    }

    @Test
    @DisplayName("bloquear deja el lote en BLOQUEADO y registra el motivo")
    void bloquearRegistraMotivo() {
        var respuesta = loteService.bloquear(1L, "Desviacion de temperatura en ruta");

        assertThat(respuesta.estado()).isEqualTo(Lote.Estado.BLOQUEADO);

        ArgumentCaptor<String> descripcion = ArgumentCaptor.forClass(String.class);
        verify(eventoService).registrar(eq(Evento.Tipo.BLOQUEO_LOTE), eq(lote), eq(null), eq(calidad),
                descripcion.capture());
        assertThat(descripcion.getValue())
                .contains("DISPONIBLE -> BLOQUEADO")
                .contains("Desviacion de temperatura en ruta");
    }

    @Test
    @DisplayName("no se bloquea dos veces el mismo lote")
    void rechazaDobleBloqueo() {
        lote.setEstado(Lote.Estado.BLOQUEADO);

        assertThatThrownBy(() -> loteService.bloquear(1L, "otro motivo"))
                .isInstanceOf(BusinessRuleException.class)
                .hasMessageContaining("ya esta bloqueado");
    }

    @Test
    @DisplayName("un lote entregado no puede bloquearse")
    void rechazaBloqueoDeLoteTerminal() {
        lote.setEstado(Lote.Estado.ENTREGADO);

        assertThatThrownBy(() -> loteService.bloquear(1L, "motivo"))
                .isInstanceOf(BusinessRuleException.class)
                .hasMessageContaining("estado terminal");

        verify(eventoService, never()).registrar(any(), any(), any(), any(), anyString());
    }

    @Test
    @DisplayName("liberar devuelve el lote a DISPONIBLE y nombra al autor")
    void liberarRegistraAutor() {
        lote.setEstado(Lote.Estado.BLOQUEADO);

        var respuesta = loteService.liberar(1L, "Producto conforme");

        assertThat(respuesta.estado()).isEqualTo(Lote.Estado.DISPONIBLE);

        ArgumentCaptor<String> descripcion = ArgumentCaptor.forClass(String.class);
        verify(eventoService).registrar(eq(Evento.Tipo.LIBERACION_LOTE), eq(lote), eq(null), eq(calidad),
                descripcion.capture());
        assertThat(descripcion.getValue())
                .contains("BLOQUEADO -> DISPONIBLE")
                .contains("calidad");
    }

    @Test
    @DisplayName("solo se libera un lote bloqueado")
    void rechazaLiberarLoteNoBloqueado() {
        assertThatThrownBy(() -> loteService.liberar(1L, "motivo"))
                .isInstanceOf(BusinessRuleException.class)
                .hasMessageContaining("no esta bloqueado");
    }

    @Test
    @DisplayName("descartar es terminal")
    void descartarLote() {
        var respuesta = loteService.descartar(1L, "Producto no conforme");

        assertThat(respuesta.estado()).isEqualTo(Lote.Estado.DESCARTADO);
        verify(eventoService).registrar(eq(Evento.Tipo.DESCARTE_LOTE), eq(lote), eq(null), eq(calidad),
                anyString());
    }

    @Test
    @DisplayName("un lote bloqueado no pasa a EN_TRANSITO")
    void loteBloqueadoNoSeEnvIa() {
        lote.setEstado(Lote.Estado.BLOQUEADO);

        assertThatThrownBy(() -> loteService.marcarEnTransito(lote))
                .isInstanceOf(BusinessRuleException.class)
                .hasMessageContaining("esta bloqueado: no puede enviarse");

        verify(loteRepository, never()).save(any(Lote.class));
    }

}