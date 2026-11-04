package Web.Friotrack.controller;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import jakarta.validation.Valid;
import Web.Friotrack.dto.ControlDto;
import Web.Friotrack.exception.BusinessRuleException;
import Web.Friotrack.entity.Control;
import Web.Friotrack.service.ControlService;

@RestController
@RequestMapping("/api/control")
public class ControlController {

    private final ControlService controlService;

    public ControlController(ControlService controlService) {
        this.controlService = controlService;
    }

    @GetMapping
    public ResponseEntity<List<ControlDto.Response>> listar(
            @RequestParam(required = false) Long idDespacho,
            @RequestParam(required = false) Long idLote) {

        if (idDespacho == null && idLote == null) {
            throw new BusinessRuleException("Debe indicar idDespacho o idLote para listar controles");
        }

        return ResponseEntity.ok(idDespacho != null && idLote != null
                ? controlService.porLoteODespacho(idLote, idDespacho)
                : idDespacho != null
                ? controlService.porDespacho(idDespacho)
                : controlService.porLote(idLote));
    }

    @GetMapping("/fuera-de-rango")
    public ResponseEntity<List<ControlDto.Response>> fueraDeRango() {
        return ResponseEntity.ok(controlService.fueraDeRango());
    }

    @GetMapping("/{id}")
    public ResponseEntity<ControlDto.Response> obtener(@PathVariable Long id) {
        return ResponseEntity.ok(controlService.obtener(id));
    }

    @PostMapping
    public ResponseEntity<ControlDto.Response> registrar(@Valid @RequestBody ControlDto.Request request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(controlService.registrar(request));
    }

}
