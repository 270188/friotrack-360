
-- ============================================================
-- 1. USUARIOS
-- ============================================================

CREATE TABLE usuario (
    id_usuario BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    apellido VARCHAR(100) NOT NULL,
    username VARCHAR(80) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    rol ENUM('ADMIN', 'OPERADOR', 'CALIDAD', 'SUPERVISOR')
        NOT NULL DEFAULT 'OPERADOR',
    activo BOOLEAN NOT NULL DEFAULT TRUE,
    fecha_creacion DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ============================================================
-- 2. PRODUCTOS
-- Aquí se define el rango aceptable de temperatura/humedad.
-- ============================================================

CREATE TABLE producto (
    id_producto BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(150) NOT NULL,
    categoria VARCHAR(100),
    descripcion TEXT,

    temperatura_min DECIMAL(5,2),
    temperatura_max DECIMAL(5,2),
    humedad_min DECIMAL(5,2),
    humedad_max DECIMAL(5,2),

    activo BOOLEAN NOT NULL DEFAULT TRUE,
    fecha_creacion DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT chk_producto_temperatura
        CHECK (
            temperatura_min IS NULL
            OR temperatura_max IS NULL
            OR temperatura_min <= temperatura_max
        ),

    CONSTRAINT chk_producto_humedad
        CHECK (
            humedad_min IS NULL
            OR humedad_max IS NULL
            OR humedad_min <= humedad_max
        ),

    CONSTRAINT chk_producto_humedad_rango
        CHECK (
            humedad_min IS NULL
            OR (humedad_min >= 0 AND humedad_min <= 100)
        ),

    CONSTRAINT chk_producto_humedad_max_rango
        CHECK (
            humedad_max IS NULL
            OR (humedad_max >= 0 AND humedad_max <= 100)
        )
) ENGINE=InnoDB;

-- ============================================================
-- 3. LOTES
-- ============================================================

CREATE TABLE lote (
    id_lote BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    id_producto BIGINT UNSIGNED NOT NULL,

    codigo_lote VARCHAR(80) NOT NULL UNIQUE,
    fecha_produccion DATE,
    fecha_vencimiento DATE,
    cantidad DECIMAL(12,3) NOT NULL DEFAULT 0,
    unidad VARCHAR(30) NOT NULL DEFAULT 'UNIDAD',

    estado ENUM(
        'DISPONIBLE',
        'BLOQUEADO',
        'EN_TRANSITO',
        'ENTREGADO',
        'DESCARTADO'
    ) NOT NULL DEFAULT 'DISPONIBLE',

    fecha_creacion DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_lote_producto
        FOREIGN KEY (id_producto)
        REFERENCES producto(id_producto),

    CONSTRAINT chk_lote_cantidad
        CHECK (cantidad >= 0),

    CONSTRAINT chk_lote_fechas
        CHECK (
            fecha_produccion IS NULL
            OR fecha_vencimiento IS NULL
            OR fecha_produccion <= fecha_vencimiento
        ),

    INDEX idx_lote_producto (id_producto),
    INDEX idx_lote_estado (estado),
    INDEX idx_lote_vencimiento (fecha_vencimiento)
) ENGINE=InnoDB;

-- ============================================================
-- 4. DESPACHOS
-- Se concentran aquí los datos del transportista y destino
-- para evitar tablas adicionales en la primera versión.
-- ============================================================

CREATE TABLE despacho (
    id_despacho BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

    codigo VARCHAR(80) NOT NULL UNIQUE,

    transportista VARCHAR(150),
    vehiculo VARCHAR(100),
    placa VARCHAR(20),

    destino VARCHAR(150) NOT NULL,
    direccion_destino VARCHAR(255),
    contacto_destino VARCHAR(150),

    fecha_programada DATETIME,
    fecha_salida DATETIME,
    fecha_llegada DATETIME,

    estado ENUM(
        'PENDIENTE',
        'PREPARACION',
        'EN_TRANSITO',
        'ENTREGADO',
        'CANCELADO'
    ) NOT NULL DEFAULT 'PENDIENTE',

    observacion TEXT,

    id_usuario BIGINT UNSIGNED NOT NULL,
    fecha_creacion DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_despacho_usuario
        FOREIGN KEY (id_usuario)
        REFERENCES usuario(id_usuario),

    INDEX idx_despacho_estado (estado),
    INDEX idx_despacho_fecha_programada (fecha_programada)
) ENGINE=InnoDB;

-- ============================================================
-- 5. LOTES POR DESPACHO
-- Relación N:M entre despacho y lote.
-- ============================================================

CREATE TABLE despacho_lote (
    id_despacho_lote BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    id_despacho BIGINT UNSIGNED NOT NULL,
    id_lote BIGINT UNSIGNED NOT NULL,

    cantidad DECIMAL(12,3) NOT NULL,

    CONSTRAINT fk_despacho_lote_despacho
        FOREIGN KEY (id_despacho)
        REFERENCES despacho(id_despacho)
        ON DELETE CASCADE,

    CONSTRAINT fk_despacho_lote_lote
        FOREIGN KEY (id_lote)
        REFERENCES lote(id_lote),

    CONSTRAINT uq_despacho_lote
        UNIQUE (id_despacho, id_lote),

    CONSTRAINT chk_despacho_lote_cantidad
        CHECK (cantidad > 0),

    INDEX idx_despacho_lote_despacho (id_despacho),
    INDEX idx_despacho_lote_lote (id_lote)
) ENGINE=InnoDB;

-- ============================================================
-- 6. CONTROLES
-- Registra temperatura/humedad y determina si están dentro
-- del rango configurado en el producto.
-- ============================================================

CREATE TABLE control (
    id_control BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

    id_despacho BIGINT UNSIGNED NOT NULL,
    id_lote BIGINT UNSIGNED NOT NULL,

    fecha_hora DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    temperatura DECIMAL(5,2),
    humedad DECIMAL(5,2),

    resultado ENUM('NORMAL', 'FUERA_RANGO') NOT NULL,

    observacion TEXT,

    id_usuario BIGINT UNSIGNED NOT NULL,

    CONSTRAINT fk_control_despacho
        FOREIGN KEY (id_despacho)
        REFERENCES despacho(id_despacho),

    CONSTRAINT fk_control_lote
        FOREIGN KEY (id_lote)
        REFERENCES lote(id_lote),

    CONSTRAINT fk_control_usuario
        FOREIGN KEY (id_usuario)
        REFERENCES usuario(id_usuario),

    CONSTRAINT chk_control_humedad
        CHECK (
            humedad IS NULL
            OR (humedad >= 0 AND humedad <= 100)
        ),

    INDEX idx_control_despacho (id_despacho),
    INDEX idx_control_lote (id_lote),
    INDEX idx_control_fecha (fecha_hora),
    INDEX idx_control_resultado (resultado)
) ENGINE=InnoDB;

-- ============================================================
-- 7. INCIDENCIAS
-- Agrupa alerta + no conformidad + acción correctiva.
-- ============================================================

CREATE TABLE incidencia (
    id_incidencia BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

    id_control BIGINT UNSIGNED NULL,
    id_lote BIGINT UNSIGNED NOT NULL,
    id_despacho BIGINT UNSIGNED NULL,

    tipo ENUM(
        'TEMPERATURA',
        'HUMEDAD',
        'CALIDAD',
        'LOGISTICA',
        'OTRA'
    ) NOT NULL DEFAULT 'OTRA',

    descripcion TEXT NOT NULL,

    prioridad ENUM(
        'BAJA',
        'MEDIA',
        'ALTA',
        'CRITICA'
    ) NOT NULL DEFAULT 'MEDIA',

    estado ENUM(
        'ABIERTA',
        'EN_PROCESO',
        'RESUELTA',
        'CERRADA'
    ) NOT NULL DEFAULT 'ABIERTA',

    causa TEXT,
    accion TEXT,

    responsable BIGINT UNSIGNED NULL,

    fecha_creacion DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fecha_cierre DATETIME,

    CONSTRAINT fk_incidencia_control
        FOREIGN KEY (id_control)
        REFERENCES control(id_control),

    CONSTRAINT fk_incidencia_lote
        FOREIGN KEY (id_lote)
        REFERENCES lote(id_lote),

    CONSTRAINT fk_incidencia_despacho
        FOREIGN KEY (id_despacho)
        REFERENCES despacho(id_despacho),

    CONSTRAINT fk_incidencia_responsable
        FOREIGN KEY (responsable)
        REFERENCES usuario(id_usuario),

    INDEX idx_incidencia_estado (estado),
    INDEX idx_incidencia_prioridad (prioridad),
    INDEX idx_incidencia_lote (id_lote),
    INDEX idx_incidencia_despacho (id_despacho)
) ENGINE=InnoDB;

-- ============================================================
-- 8. EVIDENCIAS
-- Una incidencia puede tener fotografías/documentos/evidencias.
-- ============================================================

CREATE TABLE evidencia (
    id_evidencia BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

    id_incidencia BIGINT UNSIGNED NOT NULL,

    tipo VARCHAR(50) NOT NULL,
    nombre_archivo VARCHAR(255) NOT NULL,
    url VARCHAR(500),

    descripcion VARCHAR(500),

    fecha_creacion DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    id_usuario BIGINT UNSIGNED NOT NULL,

    CONSTRAINT fk_evidencia_incidencia
        FOREIGN KEY (id_incidencia)
        REFERENCES incidencia(id_incidencia)
        ON DELETE CASCADE,

    CONSTRAINT fk_evidencia_usuario
        FOREIGN KEY (id_usuario)
        REFERENCES usuario(id_usuario),

    INDEX idx_evidencia_incidencia (id_incidencia)
) ENGINE=InnoDB;

-- ============================================================
-- 9. EVENTOS / TRAZABILIDAD
-- Una única tabla para la línea de tiempo del lote/despacho.
-- ============================================================

CREATE TABLE evento (
    id_evento BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,

    id_lote BIGINT UNSIGNED NULL,
    id_despacho BIGINT UNSIGNED NULL,

    tipo ENUM(
        'CREACION_LOTE',
        'PREPARACION',
        'CONTROL',
        'SALIDA',
        'CAMBIO_UBICACION',
        'LLEGADA',
        'BLOQUEO_LOTE',
        'LIBERACION_LOTE',
        'DESCARTE_LOTE',
        'ENTREGA',
        'OTRO'
    ) NOT NULL,

    descripcion TEXT,

    ubicacion VARCHAR(255),

    fecha_hora DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    id_usuario BIGINT UNSIGNED NOT NULL,

    CONSTRAINT fk_evento_lote
        FOREIGN KEY (id_lote)
        REFERENCES lote(id_lote),

    CONSTRAINT fk_evento_despacho
        FOREIGN KEY (id_despacho)
        REFERENCES despacho(id_despacho),

    CONSTRAINT fk_evento_usuario
        FOREIGN KEY (id_usuario)
        REFERENCES usuario(id_usuario),

    INDEX idx_evento_lote_fecha (id_lote, fecha_hora),
    INDEX idx_evento_despacho_fecha (id_despacho, fecha_hora),
    INDEX idx_evento_tipo (tipo)
) ENGINE=InnoDB;


-- ============================================================
-- Comprobantes electronicos (factura, boleta, guia de remision)
-- El backend tambien las crea al arrancar si la base ya existia (db/comprobantes.sql).
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


-- ============================================================
-- Inmutabilidad (RB-07): evento y control son append-only
-- ============================================================
DELIMITER $$

CREATE TRIGGER trg_evento_no_update BEFORE UPDATE ON evento FOR EACH ROW
BEGIN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Los eventos son inmutables: no se pueden modificar.';
END$$

CREATE TRIGGER trg_evento_no_delete BEFORE DELETE ON evento FOR EACH ROW
BEGIN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Los eventos son inmutables: no se pueden eliminar.';
END$$

CREATE TRIGGER trg_control_no_update BEFORE UPDATE ON control FOR EACH ROW
BEGIN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Los controles son inmutables: no se pueden modificar.';
END$$

CREATE TRIGGER trg_control_no_delete BEFORE DELETE ON control FOR EACH ROW
BEGIN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Los controles son inmutables: no se pueden eliminar.';
END$$

DELIMITER ;
