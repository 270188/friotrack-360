package Web.Friotrack.controller;

import java.util.List;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import jakarta.validation.Valid;
import Web.Friotrack.dto.ComprobanteDto;
import Web.Friotrack.service.ComprobanteService;

@RestController
@RequestMapping("/api/comprobante")
public class ComprobanteController {

    private final ComprobanteService comprobanteService;

    public ComprobanteController(ComprobanteService comprobanteService) {
        this.comprobanteService = comprobanteService;
    }

    @GetMapping
    public ResponseEntity<Page<ComprobanteDto.Resumen>> listar(
            @RequestParam(required = false) String tipo,
            @RequestParam(required = false) String q,
            @PageableDefault(size = 20, sort = "idComprobante", direction = Sort.Direction.DESC) Pageable pageable) {
        return ResponseEntity.ok(comprobanteService.buscar(tipo, q, pageable));
    }

    @GetMapping("/emisor")
    public ResponseEntity<ComprobanteDto.Emisor> emisor() {
        return ResponseEntity.ok(comprobanteService.emisor());
    }

    @GetMapping("/despacho/{idDespacho}")
    public ResponseEntity<List<ComprobanteDto.Resumen>> porDespacho(@PathVariable Long idDespacho) {
        return ResponseEntity.ok(comprobanteService.porDespacho(idDespacho));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ComprobanteDto.Detalle> obtener(@PathVariable Long id) {
        return ResponseEntity.ok(comprobanteService.obtener(id));
    }

    @PostMapping("/venta")
    public ResponseEntity<ComprobanteDto.Detalle> emitirVenta(@Valid @RequestBody ComprobanteDto.VentaRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(comprobanteService.emitirVenta(request));
    }

    @PostMapping("/guia")
    public ResponseEntity<ComprobanteDto.Detalle> emitirGuia(@Valid @RequestBody ComprobanteDto.GuiaRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(comprobanteService.emitirGuia(request));
    }

    @PostMapping("/{id}/reenviar")
    public ResponseEntity<ComprobanteDto.Detalle> reenviar(@PathVariable Long id) {
        return ResponseEntity.ok(comprobanteService.reenviar(id));
    }

    @GetMapping("/{id}/xml")
    public ResponseEntity<byte[]> xml(@PathVariable Long id) {
        return descarga(comprobanteService.xml(id));
    }

    @GetMapping("/{id}/cdr")
    public ResponseEntity<byte[]> cdr(@PathVariable Long id) {
        return descarga(comprobanteService.cdr(id));
    }

    private static ResponseEntity<byte[]> descarga(ComprobanteService.Archivo a) {
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.attachment().filename(a.nombre()).build().toString())
                .contentType(MediaType.parseMediaType(a.tipoContenido()))
                .body(a.contenido());
    }
}
