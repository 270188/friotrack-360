package Web.Friotrack.entity;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OrderBy;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;

/** Factura (01), boleta (03) o guia de remision remitente (09) electronica. */
@Entity
@Table(name = "comprobante")
public class Comprobante {

    public enum EstadoSunat {
        /** Firmado y guardado, aun sin respuesta de SUNAT. */
        PENDIENTE,
        ACEPTADO,
        OBSERVADO,
        RECHAZADO,
        /** El envio fallo (conexion, credenciales...). Se puede reenviar. */
        ERROR,
        /** Generado y firmado pero no enviado (la guia no tiene entorno de pruebas en SUNAT). */
        NO_ENVIADO
    }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id_comprobante", nullable = false, unique = true)
    private Long idComprobante;

    @Column(name = "tipo", nullable = false, length = 2)
    private String tipo;

    @Column(name = "serie", nullable = false, length = 4)
    private String serie;

    @Column(name = "correlativo", nullable = false)
    private Long correlativo;

    @Column(name = "fecha_emision", nullable = false)
    private LocalDateTime fechaEmision;

    @Column(name = "moneda", nullable = false, length = 3)
    private String moneda = "PEN";

    @Column(name = "cliente_tipo_doc", nullable = false, length = 1)
    private String clienteTipoDoc;

    @Column(name = "cliente_num_doc", nullable = false, length = 15)
    private String clienteNumDoc;

    @Column(name = "cliente_nombre", nullable = false, length = 200)
    private String clienteNombre;

    @Column(name = "cliente_direccion", length = 255)
    private String clienteDireccion;

    @Column(name = "op_gravada", nullable = false, precision = 12, scale = 2)
    private BigDecimal opGravada = BigDecimal.ZERO;

    @Column(name = "igv", nullable = false, precision = 12, scale = 2)
    private BigDecimal igv = BigDecimal.ZERO;

    @Column(name = "total", nullable = false, precision = 12, scale = 2)
    private BigDecimal total = BigDecimal.ZERO;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "id_despacho")
    private Despacho despacho;

    /** Datos del traslado de la guia (JSON). */
    @Column(name = "datos_traslado", columnDefinition = "TEXT")
    private String datosTraslado;

    @Column(name = "observacion", length = 500)
    private String observacion;

    @Column(name = "entorno", nullable = false, length = 12)
    private String entorno = "BETA";

    @Enumerated(EnumType.STRING)
    @Column(name = "estado_sunat", nullable = false, length = 20)
    private EstadoSunat estadoSunat = EstadoSunat.PENDIENTE;

    @Column(name = "codigo_respuesta", length = 10)
    private String codigoRespuesta;

    @Column(name = "descripcion_respuesta", columnDefinition = "TEXT")
    private String descripcionRespuesta;

    /** Observaciones de la CDR, una por linea. */
    @Column(name = "observaciones_sunat", columnDefinition = "TEXT")
    private String observacionesSunat;

    @Column(name = "hash", length = 100)
    private String hash;

    @Column(name = "xml_firmado", columnDefinition = "MEDIUMTEXT")
    private String xmlFirmado;

    @Column(name = "cdr_base64", columnDefinition = "MEDIUMTEXT")
    private String cdrBase64;

    @Column(name = "fecha_envio")
    private LocalDateTime fechaEnvio;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "id_usuario", nullable = false)
    private Usuario usuario;

    @Column(name = "fecha_creacion", nullable = false, updatable = false)
    private LocalDateTime fechaCreacion;

    @OneToMany(mappedBy = "comprobante", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("orden ASC")
    private List<ComprobanteItem> items = new ArrayList<>();

    @PrePersist
    void asignarFechaPorDefecto() {
        if (fechaCreacion == null) {
            fechaCreacion = LocalDateTime.now();
        }
    }

    public String numero() {
        return serie + "-" + correlativo;
    }

    public void agregarItem(ComprobanteItem item) {
        item.setComprobante(this);
        item.setOrden(items.size() + 1);
        items.add(item);
    }

    public Long getIdComprobante() {
        return idComprobante;
    }

    public void setIdComprobante(Long idComprobante) {
        this.idComprobante = idComprobante;
    }

    public String getTipo() {
        return tipo;
    }

    public void setTipo(String tipo) {
        this.tipo = tipo;
    }

    public String getSerie() {
        return serie;
    }

    public void setSerie(String serie) {
        this.serie = serie;
    }

    public Long getCorrelativo() {
        return correlativo;
    }

    public void setCorrelativo(Long correlativo) {
        this.correlativo = correlativo;
    }

    public LocalDateTime getFechaEmision() {
        return fechaEmision;
    }

    public void setFechaEmision(LocalDateTime fechaEmision) {
        this.fechaEmision = fechaEmision;
    }

    public String getMoneda() {
        return moneda;
    }

    public void setMoneda(String moneda) {
        this.moneda = moneda;
    }

    public String getClienteTipoDoc() {
        return clienteTipoDoc;
    }

    public void setClienteTipoDoc(String clienteTipoDoc) {
        this.clienteTipoDoc = clienteTipoDoc;
    }

    public String getClienteNumDoc() {
        return clienteNumDoc;
    }

    public void setClienteNumDoc(String clienteNumDoc) {
        this.clienteNumDoc = clienteNumDoc;
    }

    public String getClienteNombre() {
        return clienteNombre;
    }

    public void setClienteNombre(String clienteNombre) {
        this.clienteNombre = clienteNombre;
    }

    public String getClienteDireccion() {
        return clienteDireccion;
    }

    public void setClienteDireccion(String clienteDireccion) {
        this.clienteDireccion = clienteDireccion;
    }

    public BigDecimal getOpGravada() {
        return opGravada;
    }

    public void setOpGravada(BigDecimal opGravada) {
        this.opGravada = opGravada;
    }

    public BigDecimal getIgv() {
        return igv;
    }

    public void setIgv(BigDecimal igv) {
        this.igv = igv;
    }

    public BigDecimal getTotal() {
        return total;
    }

    public void setTotal(BigDecimal total) {
        this.total = total;
    }

    public Despacho getDespacho() {
        return despacho;
    }

    public void setDespacho(Despacho despacho) {
        this.despacho = despacho;
    }

    public String getDatosTraslado() {
        return datosTraslado;
    }

    public void setDatosTraslado(String datosTraslado) {
        this.datosTraslado = datosTraslado;
    }

    public String getObservacion() {
        return observacion;
    }

    public void setObservacion(String observacion) {
        this.observacion = observacion;
    }

    public String getEntorno() {
        return entorno;
    }

    public void setEntorno(String entorno) {
        this.entorno = entorno;
    }

    public EstadoSunat getEstadoSunat() {
        return estadoSunat;
    }

    public void setEstadoSunat(EstadoSunat estadoSunat) {
        this.estadoSunat = estadoSunat;
    }

    public String getCodigoRespuesta() {
        return codigoRespuesta;
    }

    public void setCodigoRespuesta(String codigoRespuesta) {
        this.codigoRespuesta = codigoRespuesta;
    }

    public String getDescripcionRespuesta() {
        return descripcionRespuesta;
    }

    public void setDescripcionRespuesta(String descripcionRespuesta) {
        this.descripcionRespuesta = descripcionRespuesta;
    }

    public String getObservacionesSunat() {
        return observacionesSunat;
    }

    public void setObservacionesSunat(String observacionesSunat) {
        this.observacionesSunat = observacionesSunat;
    }

    public String getHash() {
        return hash;
    }

    public void setHash(String hash) {
        this.hash = hash;
    }

    public String getXmlFirmado() {
        return xmlFirmado;
    }

    public void setXmlFirmado(String xmlFirmado) {
        this.xmlFirmado = xmlFirmado;
    }

    public String getCdrBase64() {
        return cdrBase64;
    }

    public void setCdrBase64(String cdrBase64) {
        this.cdrBase64 = cdrBase64;
    }

    public LocalDateTime getFechaEnvio() {
        return fechaEnvio;
    }

    public void setFechaEnvio(LocalDateTime fechaEnvio) {
        this.fechaEnvio = fechaEnvio;
    }

    public Usuario getUsuario() {
        return usuario;
    }

    public void setUsuario(Usuario usuario) {
        this.usuario = usuario;
    }

    public LocalDateTime getFechaCreacion() {
        return fechaCreacion;
    }

    public void setFechaCreacion(LocalDateTime fechaCreacion) {
        this.fechaCreacion = fechaCreacion;
    }

    public List<ComprobanteItem> getItems() {
        return items;
    }

    public void setItems(List<ComprobanteItem> items) {
        this.items = items;
    }
}
