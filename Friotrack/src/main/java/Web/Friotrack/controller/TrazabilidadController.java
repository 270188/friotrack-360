package Web.Friotrack.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import Web.Friotrack.dto.TrazabilidadDto;
import Web.Friotrack.service.TrazabilidadService;

@RestController
@RequestMapping("/api/trazabilidad")
public class TrazabilidadController {

    private final TrazabilidadService trazabilidadService;

    public TrazabilidadController(TrazabilidadService trazabilidadService) {
        this.trazabilidadService = trazabilidadService;
    }

    @GetMapping("/lote/{idLote}")
    public ResponseEntity<TrazabilidadDto.LoteView> porLote(@PathVariable Long idLote) {
        return ResponseEntity.ok(trazabilidadService.porLote(idLote));
    }

    @GetMapping("/despacho/{idDespacho}")
    public ResponseEntity<TrazabilidadDto.DespachoView> porDespacho(@PathVariable Long idDespacho) {
        return ResponseEntity.ok(trazabilidadService.porDespacho(idDespacho));
    }

}
