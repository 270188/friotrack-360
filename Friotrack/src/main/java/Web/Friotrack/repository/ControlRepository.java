package Web.Friotrack.repository;

import java.time.LocalDateTime;
import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import Web.Friotrack.entity.Control;

public interface ControlRepository extends JpaRepository<Control, Long> {

    @Query("SELECT c FROM Control c WHERE c.despacho.idDespacho = :idDespacho ORDER BY c.fechaHora ASC")
    List<Control> porDespacho(@Param("idDespacho") Long idDespacho);

    @Query("SELECT c FROM Control c WHERE c.lote.idLote = :idLote ORDER BY c.fechaHora ASC")
    List<Control> porLote(@Param("idLote") Long idLote);

    @Query("""
            SELECT c FROM Control c
            WHERE (:idLote IS NULL OR c.lote.idLote = :idLote)
              AND (:idDespacho IS NULL OR c.despacho.idDespacho = :idDespacho)
            ORDER BY c.fechaHora ASC
            """)
    List<Control> porLoteODespacho(@Param("idLote") Long idLote, @Param("idDespacho") Long idDespacho);

    List<Control> findByResultadoOrderByFechaHoraDesc(Control.Resultado resultado);

    long countByResultado(Control.Resultado resultado);

    long countByResultadoAndFechaHoraBetween(Control.Resultado resultado, LocalDateTime desde, LocalDateTime hasta);

    long countByFechaHoraBetween(LocalDateTime desde, LocalDateTime hasta);

    @Query("""
            SELECT COUNT(c) FROM Control c
            WHERE c.resultado = Web.Friotrack.entity.Control.Resultado.FUERA_RANGO
              AND c.despacho.estado NOT IN (Web.Friotrack.entity.Despacho.Estado.ENTREGADO, Web.Friotrack.entity.Despacho.Estado.CANCELADO)
            """)
    long countDesviacionesEnDespachosActivos();

    @Query("""
            SELECT COALESCE(SUM(CASE WHEN c.resultado = Web.Friotrack.entity.Control.Resultado.FUERA_RANGO THEN 1 ELSE 0 END), 0)
            FROM Control c
            WHERE c.lote.producto.idProducto = :idProducto
            """)
    long countDesviacionesByProducto(@Param("idProducto") Long idProducto);

    @Query("""
            SELECT COUNT(c) FROM Control c
            WHERE c.lote.producto.idProducto = :idProducto
            """)
    long countControlesByProducto(@Param("idProducto") Long idProducto);

}
