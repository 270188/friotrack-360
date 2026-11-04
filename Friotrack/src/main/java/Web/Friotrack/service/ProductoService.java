package Web.Friotrack.service;

import java.util.List;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import Web.Friotrack.dto.ProductoDto;
import Web.Friotrack.entity.Producto;
import Web.Friotrack.exception.BusinessRuleException;
import Web.Friotrack.exception.ConflictException;
import Web.Friotrack.exception.NotFoundException;
import Web.Friotrack.repository.LoteRepository;
import Web.Friotrack.repository.ProductoRepository;

@Service
@Transactional
public class ProductoService {

    private final ProductoRepository productoRepository;
    private final LoteRepository loteRepository;

    public ProductoService(ProductoRepository productoRepository, LoteRepository loteRepository) {
        this.productoRepository = productoRepository;
        this.loteRepository = loteRepository;
    }

    public Producto crear(ProductoDto.Request request) {
        validarRangos(request.temperaturaMin(), request.temperaturaMax(),
                request.humedadMin(), request.humedadMax());

        Producto producto = new Producto();
        aplicar(producto, request);
        return productoRepository.save(producto);
    }

    public Producto actualizar(Long id, ProductoDto.Request request) {
        validarRangos(request.temperaturaMin(), request.temperaturaMax(),
                request.humedadMin(), request.humedadMax());

        Producto producto = obtener(id);
        aplicar(producto, request);
        return productoRepository.save(producto);
    }

    @Transactional(readOnly = true)
    public Producto obtener(Long id) {
        return productoRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("Producto", id));
    }

    @Transactional(readOnly = true)
    public Page<Producto> buscar(String q, Boolean activo, Pageable pageable) {
        return productoRepository.buscar(normalizar(q), activo, pageable);
    }

    @Transactional(readOnly = true)
    public List<Producto> activos() {
        return productoRepository.findByActivoTrueOrderByNombreAsc();
    }

    @Transactional(readOnly = true)
    public List<Producto> conLotes() {
        return productoRepository.findConLotes();
    }

    public void desactivar(Long id) {
        Producto producto = obtener(id);
        producto.setActivo(Boolean.FALSE);
        productoRepository.save(producto);
    }

    public void eliminar(Long id) {
        Producto producto = obtener(id);
        if (tieneLotes(id)) {
            throw new ConflictException("El producto tiene lotes asociados: desactivezlo en lugar de eliminarlo");
        }
        productoRepository.delete(producto);
    }

    @Transactional(readOnly = true)
    public boolean tieneLotes(Long idProducto) {
        return !loteRepository.porProducto(idProducto).isEmpty();
    }

    private void aplicar(Producto producto, ProductoDto.Request request) {
        producto.setNombre(request.nombre());
        producto.setCategoria(request.categoria());
        producto.setDescripcion(request.descripcion());
        producto.setTemperaturaMin(request.temperaturaMin());
        producto.setTemperaturaMax(request.temperaturaMax());
        producto.setHumedadMin(request.humedadMin());
        producto.setHumedadMax(request.humedadMax());
        if (request.activo() != null) {
            producto.setActivo(request.activo());
        }
    }

    private void validarRangos(java.math.BigDecimal tMin, java.math.BigDecimal tMax,
                              java.math.BigDecimal hMin, java.math.BigDecimal hMax) {
        if (tMin != null && tMax != null && tMin.compareTo(tMax) > 0) {
            throw new BusinessRuleException("temperaturaMin no puede ser mayor que temperaturaMax");
        }
        if (hMin != null && hMax != null && hMin.compareTo(hMax) > 0) {
            throw new BusinessRuleException("humedadMin no puede ser mayor que humedadMax");
        }
    }

    private String normalizar(String q) {
        return q == null || q.isBlank() ? null : q.trim();
    }

}
