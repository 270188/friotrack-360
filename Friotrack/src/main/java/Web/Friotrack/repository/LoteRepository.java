package Web.Friotrack.repository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import Web.Friotrack.entity.Lote;

public interface LoteRepository extends JpaRepository<Lote, Long> {

    Optional<Lote> findByCodigoLote(String codigoLote);

    boolean existsByCodigoLote(String codigoLote);

    List<Lote> findByEstadoOrderByFechaCreacionDesc(Lote.Estado estado);

    List<Lote> findByFechaVencimientoBeforeOrderByFechaVencimientoAsc(LocalDate limite);

    long countByEstado(Lote.Estado estado);

    @Query("SELECT l FROM Lote l WHERE l.producto.idProducto = :idProducto ORDER BY l.codigoLote ASC")
    List<Lote> porProducto(@Param("idProducto") Long idProducto);

    @Query("""
            SELECT l FROM Lote l
            WHERE (:estado IS NULL OR l.estado = :estado)
              AND (:idProducto IS NULL OR l.producto.idProducto = :idProducto)
              AND (:q IS NULL OR LOWER(l.codigoLote) LIKE LOWER(CONCAT('%', :q, '%')))
            """)
    Page<Lote> buscar(@Param("q") String q,
                      @Param("estado") Lote.Estado estado,
                      @Param("idProducto") Long idProducto,
                      Pageable pageable);

}
