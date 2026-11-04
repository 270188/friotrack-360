package Web.Friotrack.entity;

import java.math.BigDecimal;
import java.time.LocalDateTime;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;

@Entity
@Table(name = "producto")
public class Producto {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id_producto", nullable = false, unique = true)
    private Long idProducto;

    @Column(name = "nombre", nullable = false, length = 150)
    private String nombre;

    @Column(name = "categoria", length = 100)
    private String categoria;

    @Column(name = "descripcion", columnDefinition = "TEXT")
    private String descripcion;

    @Column(name = "temperatura_min", precision = 5, scale = 2)
    private BigDecimal temperaturaMin;

    @Column(name = "temperatura_max", precision = 5, scale = 2)
    private BigDecimal temperaturaMax;

    @Column(name = "humedad_min", precision = 5, scale = 2)
    private BigDecimal humedadMin;

    @Column(name = "humedad_max", precision = 5, scale = 2)
    private BigDecimal humedadMax;

    @Column(name = "activo", nullable = false)
    private Boolean activo = Boolean.TRUE;

    @Column(name = "fecha_creacion", nullable = false, updatable = false)
    private LocalDateTime fechaCreacion;

    public Long getIdProducto() {
        return idProducto;
    }

    public void setIdProducto(Long idProducto) {
        this.idProducto = idProducto;
    }

    public String getNombre() {
        return nombre;
    }

    public void setNombre(String nombre) {
        this.nombre = nombre;
    }

    public String getCategoria() {
        return categoria;
    }

    public void setCategoria(String categoria) {
        this.categoria = categoria;
    }

    public String getDescripcion() {
        return descripcion;
    }

    public void setDescripcion(String descripcion) {
        this.descripcion = descripcion;
    }

    public BigDecimal getTemperaturaMin() {
        return temperaturaMin;
    }

    public void setTemperaturaMin(BigDecimal temperaturaMin) {
        this.temperaturaMin = temperaturaMin;
    }

    public BigDecimal getTemperaturaMax() {
        return temperaturaMax;
    }

    public void setTemperaturaMax(BigDecimal temperaturaMax) {
        this.temperaturaMax = temperaturaMax;
    }

    public BigDecimal getHumedadMin() {
        return humedadMin;
    }

    public void setHumedadMin(BigDecimal humedadMin) {
        this.humedadMin = humedadMin;
    }

    public BigDecimal getHumedadMax() {
        return humedadMax;
    }

    public void setHumedadMax(BigDecimal humedadMax) {
        this.humedadMax = humedadMax;
    }

    public Boolean getActivo() {
        return activo;
    }

    public void setActivo(Boolean activo) {
        this.activo = activo;
    }

    public LocalDateTime getFechaCreacion() {
        return fechaCreacion;
    }

    public void setFechaCreacion(LocalDateTime fechaCreacion) {
        this.fechaCreacion = fechaCreacion;
    }

    /**
     * Rango de humedad vigente: ambos limites o ninguno.
     */
    public boolean defineRangoHumedad() {
        return humedadMin != null && humedadMax != null;
    }

    /**
     * Rango de temperatura vigente: ambos limites o ninguno.
     */
    public boolean defineRangoTemperatura() {
        return temperaturaMin != null && temperaturaMax != null;
    }


    @PrePersist
    void asignarFechaPorDefecto() {
        if (fechaCreacion == null) {
            fechaCreacion = LocalDateTime.now();
        }
    }
}
