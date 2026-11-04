package Web.Friotrack.controller;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import jakarta.validation.Valid;
import Web.Friotrack.dto.EvidenciaDto;
import Web.Friotrack.exception.BusinessRuleException;
import Web.Friotrack.service.EvidenciaService;

@RestController
@RequestMapping("/api/evidencia")
public class EvidenciaController {

    private final EvidenciaService evidenciaService;

    public EvidenciaController(EvidenciaService evidenciaService) {
        this.evidenciaService = evidenciaService;
    }

    @GetMapping
    public ResponseEntity<List<EvidenciaDto.Response>> listar(
            @RequestParam(required = false) Long idIncidencia,
            @RequestParam(required = false) Long idLote,
            @RequestParam(required = false) Long idDespacho) {

        if (idIncidencia != null) {
            return ResponseEntity.ok(evidenciaService.porIncidencia(idIncidencia));
        }
        if (idLote != null) {
            return ResponseEntity.ok(evidenciaService.porLote(idLote));
        }
        if (idDespacho != null) {
            return ResponseEntity.ok(evidenciaService.porDespacho(idDespacho));
        }
        throw new BusinessRuleException("Debe indicar idIncidencia, idLote o idDespacho para listar evidencias");
    }

    @GetMapping("/{id}")
    public ResponseEntity<EvidenciaDto.Response> obtener(@PathVariable Long id) {
        return ResponseEntity.ok(evidenciaService.obtener(id));
    }

    @PostMapping
    public ResponseEntity<EvidenciaDto.Response> registrar(@RequestParam Long idIncidencia,
                                                           @Valid @RequestBody EvidenciaDto.Request request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(evidenciaService.registrar(idIncidencia, request));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> eliminar(@PathVariable Long id) {
        evidenciaService.eliminar(id);
        return ResponseEntity.noContent().build();
    }

}
