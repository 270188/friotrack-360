package Web.Friotrack.repository;

import java.util.Collection;
import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import Web.Friotrack.entity.Incidencia;

public interface IncidenciaRepository extends JpaRepository<Incidencia, Long> {

    List<Incidencia> findByEstadoOrderByPrioridadDescFechaCreacionAsc(Incidencia.Estado estado);

    List<Incidencia> findByEstadoOrderByFechaCierreDesc(Incidencia.Estado estado);

    List<Incidencia> findByEstadoInOrderByPrioridadDescFechaCreacionAsc(Collection<Incidencia.Estado> estados);

    List<Incidencia> findByTipoOrderByFechaCreacionDesc(Incidencia.Tipo tipo);

    long countByEstado(Incidencia.Estado estado);

    long countByPrioridad(Incidencia.Prioridad prioridad);

    long countByEstadoIn(Collection<Incidencia.Estado> estados);

    long countByTipo(Incidencia.Tipo tipo);

    @Query("SELECT i FROM Incidencia i WHERE i.lote.idLote = :idLote ORDER BY i.fechaCreacion DESC")
    List<Incidencia> porLote(@Param("idLote") Long idLote);

    @Query("SELECT i FROM Incidencia i WHERE i.despacho.idDespacho = :idDespacho ORDER BY i.fechaCreacion DESC")
    List<Incidencia> porDespacho(@Param("idDespacho") Long idDespacho);

    @Query("SELECT i FROM Incidencia i WHERE i.control.idControl = :idControl ORDER BY i.fechaCreacion ASC")
    List<Incidencia> porControl(@Param("idControl") Long idControl);

    @Query("""
            SELECT COALESCE(AVG(TIMESTAMPDIFF(MINUTE, i.fechaCreacion, i.fechaCierre)), 0)
            FROM Incidencia i
            WHERE i.fechaCierre IS NOT NULL
            """)
    double promedioMinutosResolucion();

}