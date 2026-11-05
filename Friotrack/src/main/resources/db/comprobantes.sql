-- ============================================================
-- Comprobantes electronicos (factura, boleta, guia de remision)
-- Se ejecuta al arrancar el backend (spring.sql.init) para crear las tablas
-- en bases que ya existian. Es idempotente: CREATE TABLE IF NOT EXISTS.
-- ============================================================

CREATE TABLE IF NOT EXISTS comprobante (
    id_comprobante BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

    tipo VARCHAR(2) NOT NULL,
    serie VARCHAR(4) NOT NULL,
    correlativo BIGINT NOT NULL,
    fecha_emision DATETIME NOT NULL,
    moneda VARCHAR(3) NOT NULL DEFAULT 'PEN',

    cliente_tipo_doc VARCHAR(1) NOT NULL,
    cliente_num_doc VARCHAR(15) NOT NULL,
    cliente_nombre VARCHAR(200) NOT NULL,
    cliente_direccion VARCHAR(255),

    op_gravada DECIMAL(12,2) NOT NULL DEFAULT 0,
    igv DECIMAL(12,2) NOT NULL DEFAULT 0,
    total DECIMAL(12,2) NOT NULL DEFAULT 0,

    id_despacho BIGINT UNSIGNED,
    datos_traslado TEXT,
    observacion VARCHAR(500),

    entorno VARCHAR(12) NOT NULL DEFAULT 'BETA',
    estado_sunat ENUM('PENDIENTE', 'ACEPTADO', 'OBSERVADO', 'RECHAZADO', 'ERROR', 'NO_ENVIADO') NOT NULL,
    codigo_respuesta VARCHAR(10),
    descripcion_respuesta TEXT,
    observaciones_sunat TEXT,
    hash VARCHAR(100),
    xml_firmado MEDIUMTEXT,
    cdr_base64 MEDIUMTEXT,
    fecha_envio DATETIME,

    id_usuario BIGINT UNSIGNED NOT NULL,
    fecha_creacion DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT uk_comprobante_numero UNIQUE (tipo, serie, correlativo),
    CONSTRAINT fk_comprobante_despacho FOREIGN KEY (id_despacho) REFERENCES despacho(id_despacho),
    CONSTRAINT fk_comprobante_usuario FOREIGN KEY (id_usuario) REFERENCES usuario(id_usuario),

    INDEX idx_comprobante_tipo_fecha (tipo, fecha_emision),
    INDEX idx_comprobante_cliente (cliente_num_doc)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS comprobante_item (
    id_item BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    id_comprobante BIGINT UNSIGNED NOT NULL,
    orden INT NOT NULL,

    codigo VARCHAR(50),
    descripcion VARCHAR(500) NOT NULL,
    unidad VARCHAR(5) NOT NULL,
    cantidad DECIMAL(12,3) NOT NULL,
    valor_unitario DECIMAL(16,6) NOT NULL DEFAULT 0,
    precio_unitario DECIMAL(12,2) NOT NULL DEFAULT 0,
    valor_venta DECIMAL(12,2) NOT NULL DEFAULT 0,
    igv DECIMAL(12,2) NOT NULL DEFAULT 0,

    CONSTRAINT fk_item_comprobante FOREIGN KEY (id_comprobante)
        REFERENCES comprobante(id_comprobante) ON DELETE CASCADE,

    INDEX idx_item_comprobante (id_comprobante)
) ENGINE=InnoDB;
