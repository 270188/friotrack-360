package Web.Friotrack.repository;

import java.util.Collection;
import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import Web.Friotrack.entity.Evidencia;

public interface EvidenciaRepository extends JpaRepository<Evidencia, Long> {

    @Query("SELECT e FROM Evidencia e WHERE e.incidencia.idIncidencia = :idIncidencia ORDER BY e.fechaCreacion ASC")
    List<Evidencia> porIncidencia(@Param("idIncidencia") Long idIncidencia);

    @Query("SELECT COUNT(e) FROM Evidencia e WHERE e.incidencia.idIncidencia = :idIncidencia")
    long contarPorIncidencia(@Param("idIncidencia") Long idIncidencia);

    @Query("""
            SELECT e.incidencia.idIncidencia, COUNT(e) FROM Evidencia e
            WHERE e.incidencia.idIncidencia IN :ids
            GROUP BY e.incidencia.idIncidencia
            """)
    List<Object[]> contarPorIncidencias(@Param("ids") Collection<Long> ids);

}