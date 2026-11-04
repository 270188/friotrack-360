package Web.Friotrack.controller;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import jakarta.validation.Valid;
import Web.Friotrack.dto.EvidenciaDto;
import Web.Friotrack.dto.IncidenciaDto;
import Web.Friotrack.entity.Incidencia;
import Web.Friotrack.exception.BusinessRuleException;
import Web.Friotrack.service.EvidenciaService;
import Web.Friotrack.service.IncidenciaService;

@RestController
@RequestMapping("/api/incidencia")
public class IncidenciaController {

    private final IncidenciaService incidenciaService;
    private final EvidenciaService evidenciaService;

    public IncidenciaController(IncidenciaService incidenciaService, EvidenciaService evidenciaService) {
        this.incidenciaService = incidenciaService;
        this.evidenciaService = evidenciaService;
    }

    @GetMapping
    public ResponseEntity<List<IncidenciaDto.Resumen>> listar(
            @RequestParam(required = false) Incidencia.Estado estado,
            @RequestParam(required = false) Incidencia.Prioridad prioridad,
            @RequestParam(required = false) Incidencia.Tipo tipo,
            @RequestParam(required = false) Long idLote,
            @RequestParam(required = false) Long idDespacho) {

        List<IncidenciaDto.Resumen> incidencias;
        if (idLote != null) {
            incidencias = incidenciaService.resumenPorLote(idLote);
        } else if (idDespacho != null) {
            incidencias = incidenciaService.resumenPorDespacho(idDespacho);
        } else if (tipo != null) {
            incidencias = incidenciaService.resumenPorTipo(tipo);
        } else if (estado != null) {
            incidencias = incidenciaService.porEstado(estado);
        } else {
            throw new BusinessRuleException(
                    "Debe indicar estado, tipo, idLote o idDespacho para listar incidencias");
        }

        if (prioridad != null) {
            incidencias = incidencias.stream()
                    .filter(i -> i.prioridad() == prioridad).toList();
        }

        return ResponseEntity.ok(incidencias);
    }

    @GetMapping("/abiertas")
    public ResponseEntity<List<IncidenciaDto.Response>> abiertas() {
        return ResponseEntity.ok(incidenciaService.abiertas());
    }

    @GetMapping("/{id}")
    public ResponseEntity<IncidenciaDto.Response> obtener(@PathVariable Long id) {
        return ResponseEntity.ok(incidenciaService.obtener(id));
    }

    @PostMapping
    public ResponseEntity<IncidenciaDto.Response> crear(@Valid @RequestBody IncidenciaDto.Request request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(incidenciaService.crear(request));
    }

    @PutMapping("/{id}")
    public ResponseEntity<IncidenciaDto.Response> actualizar(@PathVariable Long id,
                                                             @Valid @RequestBody IncidenciaDto.Actualizacion request) {
        return ResponseEntity.ok(incidenciaService.actualizar(id, request));
    }

    @PatchMapping("/{id}/estado")
    public ResponseEntity<IncidenciaDto.Response> cambiarEstado(@PathVariable Long id,
                                                               @Valid @RequestBody IncidenciaDto.CambioEstado request) {
        return ResponseEntity.ok(incidenciaService.cambiarEstado(id, request));
    }

    @GetMapping("/{id}/evidencias")
    public ResponseEntity<List<EvidenciaDto.Response>> evidencias(@PathVariable Long id) {
        return ResponseEntity.ok(evidenciaService.porIncidencia(id));
    }

    @PostMapping("/{id}/evidencias")
    public ResponseEntity<EvidenciaDto.Response> agregarEvidencia(@PathVariable Long id,
                                                                  @Valid @RequestBody EvidenciaDto.Request request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(evidenciaService.registrar(id, request));
    }

}
