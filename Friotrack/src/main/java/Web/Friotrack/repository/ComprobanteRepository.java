package Web.Friotrack.repository;

import java.util.List;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import Web.Friotrack.entity.Comprobante;

public interface ComprobanteRepository extends JpaRepository<Comprobante, Long> {

    @Query("SELECT COALESCE(MAX(c.correlativo), 0) FROM Comprobante c WHERE c.tipo = :tipo AND c.serie = :serie")
    Long ultimoCorrelativo(@Param("tipo") String tipo, @Param("serie") String serie);

    @Query("""
            SELECT c FROM Comprobante c
            WHERE (:tipo IS NULL OR c.tipo = :tipo)
              AND (CAST(:q AS String) IS NULL OR LOWER(c.clienteNombre) LIKE LOWER(CONCAT('%', CAST(:q AS String), '%'))
                   OR c.clienteNumDoc LIKE CONCAT('%', CAST(:q AS String), '%')
                   OR LOWER(CONCAT(c.serie, '-', CAST(c.correlativo AS String))) LIKE LOWER(CONCAT('%', CAST(:q AS String), '%')))
            """)
    Page<Comprobante> buscar(@Param("tipo") String tipo, @Param("q") String q, Pageable pageable);

    List<Comprobante> findByDespachoIdDespachoOrderByFechaEmisionDesc(Long idDespacho);
}
