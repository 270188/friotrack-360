package Web.Friotrack.repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import Web.Friotrack.entity.Despacho;

public interface DespachoRepository extends JpaRepository<Despacho, Long> {

    Optional<Despacho> findByCodigo(String codigo);

    boolean existsByCodigo(String codigo);

    List<Despacho> findByEstadoOrderByFechaCreacionDesc(Despacho.Estado estado);

    List<Despacho> findByFechaProgramadaBetweenOrderByFechaProgramadaAsc(LocalDateTime desde, LocalDateTime hasta);

    long countByEstado(Despacho.Estado estado);

    @Query("""
            SELECT d FROM Despacho d
            WHERE (:estado IS NULL OR d.estado = :estado)
              AND (:q IS NULL OR LOWER(d.codigo) LIKE LOWER(CONCAT('%', :q, '%'))
                   OR LOWER(d.destino) LIKE LOWER(CONCAT('%', :q, '%'))
                   OR LOWER(COALESCE(d.transportista, '')) LIKE LOWER(CONCAT('%', :q, '%')))
            """)
    Page<Despacho> buscar(@Param("q") String q,
                          @Param("estado") Despacho.Estado estado,
                          Pageable pageable);

    @Query("""
            SELECT COUNT(d) FROM Despacho d
            WHERE d.estado NOT IN (Web.Friotrack.entity.Despacho.Estado.ENTREGADO, Web.Friotrack.entity.Despacho.Estado.CANCELADO)
              AND NOT EXISTS (
                  SELECT i FROM Incidencia i
                  WHERE i.despacho = d AND i.estado IN (Web.Friotrack.entity.Incidencia.Estado.ABIERTA, Web.Friotrack.entity.Incidencia.Estado.EN_PROCESO)
              )
            """)
    long countDespachosSinIncidenciasAbiertas();

}
