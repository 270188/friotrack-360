package Web.Friotrack.repository;

import java.math.BigDecimal;
import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import Web.Friotrack.entity.DespachoLote;

public interface DespachoLoteRepository extends JpaRepository<DespachoLote, Long> {

    @Query("SELECT dl FROM DespachoLote dl WHERE dl.despacho.idDespacho = :idDespacho ORDER BY dl.idDespachoLote ASC")
    List<DespachoLote> porDespacho(@Param("idDespacho") Long idDespacho);

    @Query("SELECT dl FROM DespachoLote dl WHERE dl.lote.idLote = :idLote ORDER BY dl.idDespachoLote ASC")
    List<DespachoLote> porLote(@Param("idLote") Long idLote);

    @Query("SELECT dl FROM DespachoLote dl WHERE dl.despacho.idDespacho = :idDespacho AND dl.lote.idLote = :idLote")
    List<DespachoLote> buscar(@Param("idDespacho") Long idDespacho, @Param("idLote") Long idLote);

    @Query("""
            SELECT COUNT(dl) > 0 FROM DespachoLote dl
            WHERE dl.despacho.idDespacho = :idDespacho AND dl.lote.idLote = :idLote
            """)
    boolean existe(@Param("idDespacho") Long idDespacho, @Param("idLote") Long idLote);

    @Query("""
            SELECT COALESCE(SUM(dl.cantidad), 0) FROM DespachoLote dl
            WHERE dl.lote.idLote = :idLote
              AND dl.despacho.estado NOT IN (Web.Friotrack.entity.Despacho.Estado.ENTREGADO,
                                              Web.Friotrack.entity.Despacho.Estado.CANCELADO)
            """)
    BigDecimal cantidadPendiente(@Param("idLote") Long idLote);

}
