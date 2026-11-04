package Web.Friotrack.repository;

import java.util.List;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import Web.Friotrack.entity.Producto;

public interface ProductoRepository extends JpaRepository<Producto, Long> {

    List<Producto> findByActivoTrueOrderByNombreAsc();

    @Query("""
            SELECT p FROM Producto p
            WHERE (:activo IS NULL OR p.activo = :activo)
              AND (:q IS NULL OR LOWER(p.nombre) LIKE LOWER(CONCAT('%', :q, '%'))
                   OR LOWER(COALESCE(p.categoria, '')) LIKE LOWER(CONCAT('%', :q, '%')))
            """)
    Page<Producto> buscar(@Param("q") String q, @Param("activo") Boolean activo, Pageable pageable);

    @Query("""
            SELECT p FROM Producto p
            WHERE p.idProducto IN (SELECT l.producto.idProducto FROM Lote l)
            """)
    List<Producto> findConLotes();

}
