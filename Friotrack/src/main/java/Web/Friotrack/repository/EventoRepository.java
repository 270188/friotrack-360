package Web.Friotrack.repository;

import java.time.LocalDateTime;
import java.util.List;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import Web.Friotrack.entity.Evento;

public interface EventoRepository extends JpaRepository<Evento, Long> {

    @Query("SELECT e FROM Evento e WHERE e.lote.idLote = :idLote ORDER BY e.fechaHora ASC, e.idEvento ASC")
    List<Evento> porLote(@Param("idLote") Long idLote);

    @Query("SELECT e FROM Evento e WHERE e.despacho.idDespacho = :idDespacho ORDER BY e.fechaHora ASC, e.idEvento ASC")
    List<Evento> porDespacho(@Param("idDespacho") Long idDespacho);

    @Query("""
            SELECT e FROM Evento e
            WHERE (:idLote IS NULL OR e.lote.idLote = :idLote)
              AND (:idDespacho IS NULL OR e.despacho.idDespacho = :idDespacho)
            ORDER BY e.fechaHora ASC, e.idEvento ASC
            """)
    List<Evento> porLoteODespacho(@Param("idLote") Long idLote, @Param("idDespacho") Long idDespacho);

    List<Evento> findByTipoOrderByFechaHoraDesc(Evento.Tipo tipo);

    List<Evento> findTop10ByOrderByFechaHoraDescIdEventoDesc();

    long countByTipo(Evento.Tipo tipo);

    long countByFechaHoraBetween(LocalDateTime desde, LocalDateTime hasta);

    @Query("""
            SELECT e FROM Evento e
            WHERE (:idLote IS NULL OR e.lote.idLote = :idLote)
              AND (:idDespacho IS NULL OR e.despacho.idDespacho = :idDespacho)
              AND (:tipo IS NULL OR e.tipo = :tipo)
              AND (:desde IS NULL OR e.fechaHora >= :desde)
              AND (:hasta IS NULL OR e.fechaHora <= :hasta)
            """)
    Page<Evento> buscar(@Param("idLote") Long idLote,
                        @Param("idDespacho") Long idDespacho,
                        @Param("tipo") Evento.Tipo tipo,
                        @Param("desde") LocalDateTime desde,
                        @Param("hasta") LocalDateTime hasta,
                        Pageable pageable);

}