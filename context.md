# FrioTrack 360 — Contexto de Implementación

> Documento de referencia técnica. Describe **lo que está implementado**: el modelo de datos de `friotrack360_simplificado.sql` (9 tablas, MySQL 8) y el contrato que el backend y el frontend deben respetar.
>
> El documento original de alcance del proyecto (`FrioTrack 360 — Contexto del Proyecto.md`) permanece como especificación académica. Cuando diverjan, **manda este documento** para la implementación y `friotrack360_simplificado.sql` para el esquema.

---

## 1. Propósito

FrioTrack 360 centraliza la trazabilidad de productos perecibles: qué lote salió, en qué despacho, qué temperatura registró, en qué momento se desvió, quién lo atiende y con qué evidencia se cerró.

El valor del sistema no está en el CRUD sino en poder reconstruir la historia de un lote o un despacho. Por eso el modelo es **append-oriented**: `evento`, `control`, `incidencia` y `evidencia` concentran el histórico, y las entidades de estado (`lote`, `despacho`, `incidencia`) son la foto actual.

---

## 2. Stack

```text
┌──────────────────────────┐
│  Frontend — Angular 21   │   Standalone, signals, Tailwind
└────────────┬─────────────┘
             │ HTTP / JSON  (config.json → API_URL)
             ▼
┌──────────────────────────┐
│  Backend — Spring Boot   │   JPA / Hibernate, JWT
└────────────┬─────────────┘
             │ JDBC
             ▼
┌──────────────────────────┐
│  MySQL 8 — friotrack360  │   InnoDB, snake_case
└──────────────────────────┘
```

| Capa | Decisión |
|---|---|
| Persistencia | MySQL 8 (no PostgreSQL). `ENGINE=InnoDB` en todas las tablas. |
| Idempotencia del esquema | `spring.jpa.hibernate.ddl-auto=validate` → **el SQL es la fuente de verdad**. Hibernate nunca crea ni altera tablas; una columna de más o de menos impide arrancar el backend. |
| Nombres | Tablas y columnas en `snake_case`; claves foráneas con sufijo `_id` salvo `incidencia.responsable`. |
| Mapeo JPA | `@GeneratedValue(strategy = IDENTITY)` (todos los PK son `AUTO_INCREMENT`). Los `ENUM` se mapean con `@Enumerated(EnumType.STRING)`: el valor persistido es el literal del ENUM, sin prefijo. |
| Identificadores | `BIGINT UNSIGNED` mapeados a `Long` en Java. |
| Autorización | JWT + rol del usuario (`usuario.rol`). |

### Carga de la base

```bash
mysql -u root -p friotrack360 < friotrack360_simplificado.sql
```

El script no incluye `CREATE DATABASE` ni `USE`; la base debe existir antes (la crea el servicio `mysql` de `docker-compose.yml`, que monta este mismo script en `docker-entrypoint-initdb.d`). El script **no inserta datos**: el primer usuario lo crea el backend al arrancar (§10, *Primer usuario*).

---

## 3. Modelo de datos

### 3.1 Resumen de las 9 tablas

| Tabla | Propósito | Filas de referencia |
|---|---|---|
| `usuario` | Quién opera el sistema. | `ADMIN`, `OPERADOR`, `CALIDAD`, `SUPERVISOR` |
| `producto` | Catálogo de perecibles **y sus rangos de conservación**. | — |
| `lote` | Unidad de inventario trazable. | `DISPONIBLE`, `BLOQUEADO`, `EN_TRANSITO`, `ENTREGADO`, `DESCARTADO` |
| `despacho` | Operación de envío, con transportista y destino. | `PENDIENTE`, `PREPARACION`, `EN_TRANSITO`, `ENTREGADO`, `CANCELADO` |
| `despacho_lote` | N:M entre despacho y lote, con la cantidad enviada. | — |
| `control` | Lectura de temperatura/humedad y su veredicto. | `NORMAL`, `FUERA_RANGO` |
| `incidencia` | Alerta + no conformidad + acción correctiva en un solo registro. | tipo / prioridad / estado |
| `evidencia` | Archivo que respalda una incidencia. | — |
| `evento` | Línea de tiempo de custodia y trazabilidad. | 11 tipos |

### 3.2 Diagrama

```text
USUARIO ──┬──< DESPACHO ──< DESPACHO_LOTE >── LOTE >── PRODUCTO
          │        │              │            │  │
          │        │              │            │  └─ umbrales (temp/hum)
          │        └──< CONTROL >─┴────────────┘
          │                 │
          │                 └──< INCIDENCIA >── EVIDENCIA
          │                          │
          └──────────────────────────┴──< EVENTO >── LOTE / DESPACHO
```

`evento` y `control` cuelgan de `usuario`; toda escritura registra el actor.

### 3.3 `usuario`

| Columna | Tipo | Notas |
|---|---|---|
| `id_usuario` | `BIGINT UNSIGNED` | PK, `AUTO_INCREMENT` |
| `nombre` / `apellido` | `VARCHAR(100)` | `NOT NULL` |
| `username` | `VARCHAR(80)` | `NOT NULL UNIQUE` |
| `password_hash` | `VARCHAR(255)` | `NOT NULL`. Se almacena el hash, nunca la contraseña. |
| `rol` | `ENUM` | `NOT NULL DEFAULT 'OPERADOR'`. Ver §5. |
| `activo` | `BOOLEAN` | `NOT NULL DEFAULT TRUE`. Baja lógica, no borrado físico. |
| `fecha_creacion` | `DATETIME` | `DEFAULT CURRENT_TIMESTAMP`, no editable |

**No existe columna `email`.** La identidad del usuario es `username`.

### 3.4 `producto`

Identificación del perecedible y de sus límites aceptables. Los umbrales viven **en el producto**, no en una tabla de reglas: no hay historial de versiones de un rango.

| Columna | Tipo | Notas |
|---|---|---|
| `id_producto` | `BIGINT UNSIGNED` | PK |
| `nombre` | `VARCHAR(150)` | `NOT NULL` |
| `categoria` / `descripcion` | `VARCHAR(100)` / `TEXT` | Opcionales |
| `temperatura_min` / `temperatura_max` | `DECIMAL(5,2)` | Opcionales e independientes: un límite `NULL` significa "sin cota en ese extremo" |
| `humedad_min` / `humedad_max` | `DECIMAL(5,2)` | Opcionales, rango físico 0–100 |
| `activo` | `BOOLEAN` | `NOT NULL DEFAULT TRUE` |
| `fecha_creacion` | `DATETIME` | `DEFAULT CURRENT_TIMESTAMP` |

Restricciones: `chk_producto_temperatura` (min ≤ max), `chk_producto_humedad` (min ≤ max), `chk_producto_humedad_rango` y `chk_producto_humedad_max_rango` (0 ≤ valor ≤ 100).

La semántica de un umbral es: `NULL` = no evaluable. Un producto sin ningún par de límites no genera desviaciones porque no hay contra qué comparar.

### 3.5 `lote`

| Columna | Tipo | Notas |
|---|---|---|
| `id_lote` | `BIGINT UNSIGNED` | PK |
| `id_producto` | `BIGINT UNSIGNED` | `NOT NULL`, FK → `producto` |
| `codigo_lote` | `VARCHAR(80)` | `NOT NULL UNIQUE`. Identificador de negocio. |
| `fecha_produccion` / `fecha_vencimiento` | `DATE` | Opcionales |
| `cantidad` | `DECIMAL(12,3)` | `NOT NULL DEFAULT 0`, `CHECK (cantidad >= 0)` |
| `unidad` | `VARCHAR(30)` | `NOT NULL DEFAULT 'UNIDAD'` |
| `estado` | `ENUM` | `NOT NULL DEFAULT 'DISPONIBLE'` |
| `fecha_creacion` | `DATETIME` | `DEFAULT CURRENT_TIMESTAMP` |

Restricciones: `chk_lote_cantidad`, `chk_lote_fechas` (producción ≤ vencimiento).
Índices: `idx_lote_producto`, `idx_lote_estado`, `idx_lote_vencimiento` (soporta el filtro de lotes por vencer del dashboard).

El lote **no** guarda `id_despacho`: el vínculo con el envío se resuelve por `despacho_lote`, que además es quien registra la cantidad despachada.

### 3.6 `despacho`

Concentra transportista y destino en la propia tabla; no hay entidad `transportista` ni `punto_recepcion`.

| Columna | Tipo | Notas |
|---|---|---|
| `id_despacho` | `BIGINT UNSIGNED` | PK |
| `codigo` | `VARCHAR(80)` | `NOT NULL UNIQUE`. Identificador de envío. |
| `transportista` / `vehiculo` / `placa` | `VARCHAR(150/100/20)` | Texto libre. El transportista **no** es un `usuario` del sistema. |
| `destino` | `VARCHAR(150)` | `NOT NULL` |
| `direccion_destino` / `contacto_destino` | `VARCHAR(255/150)` | Opcionales |
| `fecha_programada` / `fecha_salida` / `fecha_llegada` | `DATETIME` | Opcionales. Los trestimestamps son la evidencia objective del tránsito. |
| `estado` | `ENUM` | `NOT NULL DEFAULT 'PENDIENTE'` |
| `observacion` | `TEXT` | Opcional |
| `id_usuario` | `BIGINT UNSIGNED` | `NOT NULL`, FK → `usuario`. Responsable de la operación. |
| `fecha_creacion` | `DATETIME` | `DEFAULT CURRENT_TIMESTAMP` |

Índices: `idx_despacho_estado`, `idx_despacho_fecha_programada`.

### 3.7 `despacho_lote`

| Columna | Tipo | Notas |
|---|---|---|
| `id_despacho_lote` | `BIGINT UNSIGNED` | PK |
| `id_despacho` | `BIGINT UNSIGNED` | `NOT NULL`, FK → `despacho` **`ON DELETE CASCADE`** |
| `id_lote` | `BIGINT UNSIGNED` | `NOT NULL`, FK → `lote` (sin cascade: no se borra un lote historizado) |
| `cantidad` | `DECIMAL(12,3)` | `NOT NULL`, `CHECK (cantidad > 0)` |

`uq_despacho_lote (id_despacho, id_lote)` impide duplicar el mismo lote en un envío; para repartir un mismo lote en dos envíos se requiere crear un segundo despacho.

`cantidad` es la cantidad de ese lote en ese despacho. No hay validación a nivel de BD que sume contra `lote.cantidad`: esa consistencia es responsabilidad del servicio.

### 3.8 `control`

Una fila por lectura. Sustituye a `lectura_condicion` e incorpora el veredicto.

| Columna | Tipo | Notas |
|---|---|---|
| `id_control` | `BIGINT UNSIGNED` | PK |
| `id_despacho` | `BIGINT UNSIGNED` | `NOT NULL`, FK → `despacho` |
| `id_lote` | `BIGINT UNSIGNED` | `NOT NULL`, FK → `lote` |
| `fecha_hora` | `DATETIME` | `NOT NULL DEFAULT CURRENT_TIMESTAMP` |
| `temperatura` / `humedad` | `DECIMAL(5,2)` | Opcionales. `CHECK` de humedad 0–100. |
| `resultado` | `ENUM('NORMAL','FUERA_RANGO')` | `NOT NULL`, sin default: **lo calcula la aplicación** |
| `observacion` | `TEXT` | Opcional |
| `id_usuario` | `BIGINT UNSIGNED` | `NOT NULL`, FK → `usuario` |

Índices: `idx_control_despacho`, `idx_control_lote`, `idx_control_fecha`, `idx_control_resultado`.

Puntos que condicionan el código:
- Ambos `id_despacho` e `id_lote` son obligatorios. Toda lectura pertenece a un envío en curso. No se modelan lecturas en almacén o en reception sin despacho.
- `resultado` no guarda copia del umbral con el que se juzgó. Se evalúa contra `producto` en el momento del insert; si después se edita el rango, el histórico no se recalcula y no se puede reconstruir el criterio aplicado.

### 3.9 `incidencia`

Tabla única que absorbe alerta, no conformidad y acción correctiva.

| Columna | Tipo | Notas |
|---|---|---|
| `id_incidencia` | `BIGINT UNSIGNED` | PK |
| `id_control` | `BIGINT UNSIGNED` | FK nullable → `control`. Origen de la desviación. |
| `id_lote` | `BIGINT UNSIGNED` | `NOT NULL`, FK → `lote`. Toda incidencia es de un lote. |
| `id_despacho` | `BIGINT UNSIGNED` | FK nullable → `despacho` |
| `tipo` | `ENUM('TEMPERATURA','HUMEDAD','CALIDAD','LOGISTICA','OTRA')` | `NOT NULL DEFAULT 'OTRA'` |
| `descripcion` | `TEXT` | `NOT NULL` |
| `prioridad` | `ENUM('BAJA','MEDIA','ALTA','CRITICA')` | `NOT NULL DEFAULT 'MEDIA'` |
| `estado` | `ENUM('ABIERTA','EN_PROCESO','RESUELTA','CERRADA')` | `NOT NULL DEFAULT 'ABIERTA'` |
| `causa` | `TEXT` | Análisis de causa (absorbe la investigación) |
| `accion` | `TEXT` | Acción correctiva, **texto libre** |
| `responsable` | `BIGINT UNSIGNED` | FK nullable → `usuario`. Único nombre sin sufijo `_id`. |
| `fecha_creacion` | `DATETIME` | `DEFAULT CURRENT_TIMESTAMP` |
| `fecha_cierre` | `DATETIME` | Nullable. Se seta al pasar a `RESUELTA`/`CERRADA`. |

Índices: `idx_incidencia_estado`, `idx_incidencia_prioridad`, `idx_incidencia_lote`, `idx_incidencia_despacho`.

Consecuencias del aplanamiento:
- El ciclo se expresa con el enum `estado`: `ABIERTA` → `EN_PROCESO` → `RESUELTA` → `CERRADA`.
- `accion` es un único campo de texto: no hay responsable, fecha límite, avance ni validación de la acción correctiva (RB-10 del documento original no es representable).
- No se puede crear una incidencia "suelta" sin lote, aunque el enunciado original la contemplaba para desvíos de proceso.

### 3.10 `evidencia`

| Columna | Tipo | Notas |
|---|---|---|
| `id_evidencia` | `BIGINT UNSIGNED` | PK |
| `id_incidencia` | `BIGINT UNSIGNED` | `NOT NULL`, FK → `incidencia` **`ON DELETE CASCADE`** |
| `tipo` | `VARCHAR(50)` | `NOT NULL`. Texto libre (`FOTO`, `DOCUMENTO`, `LECTURA`, …), no ENUM. |
| `nombre_archivo` | `VARCHAR(255)` | `NOT NULL` |
| `url` | `VARCHAR(500)` | Nullable. Ruta o enlace al archivo. |
| `descripcion` | `VARCHAR(500)` | Opcional |
| `fecha_creacion` | `DATETIME` | `DEFAULT CURRENT_TIMESTAMP` |
| `id_usuario` | `BIGINT UNSIGNED` | `NOT NULL`, FK → `usuario`. Autor de la evidencia. |

Índice: `idx_evidencia_incidencia`.

`evidencia` solo se ancla a `incidencia`. No hay ruta directa desde `evidencia` a `evento` ni a `lote`.

### 3.11 `evento`

Tabla única de línea de tiempo: absorbe `evento_custodia` y `evento_trazabilidad`.

| Columna | Tipo | Notas |
|---|---|---|
| `id_evento` | `BIGINT UNSIGNED` | PK |
| `id_lote` | `BIGINT UNSIGNED` | FK nullable → `lote` |
| `id_despacho` | `BIGINT UNSIGNED` | FK nullable → `despacho` |
| `tipo` | `ENUM` (11 valores) | `NOT NULL`. Ver §5. |
| `descripcion` | `TEXT` | Detalle libre del evento |
| `ubicacion` | `VARCHAR(255)` | Opcional |
| `fecha_hora` | `DATETIME` | `NOT NULL DEFAULT CURRENT_TIMESTAMP` |
| `id_usuario` | `BIGINT UNSIGNED` | `NOT NULL`, FK → `usuario` |

Índices: `idx_evento_lote_fecha (id_lote, fecha_hora)`, `idx_evento_despacho_fecha (id_despacho, fecha_hora)`, `idx_evento_tipo`.

Los índices compuestos están diseñados para el patrón de consulta principal: timeline de un lote o de un despacho, ya ordenado por fecha. `id_lote` e `id_despacho` son ambos opcionales y no hay `CHECK` que exija al menos uno: un evento sin anclaje es representable y no aparecerá en ninguna trazabilidad.

No hay columnas de estado anterior / nuevo: los cambios de estado se documentan en `descripcion`.

---

## 4. Vocabulario

| Término | Significado en el sistema |
|---|---|
| **Producto** | Perecedible del catálogo. Dueño de los umbrales de temperatura y humedad. |
| **Lote** | Unidad de inventario con código único. Es el sujeto central de la trazabilidad. |
| **Despacho** | Envío con destino, transportista y vehículo. |
| **Despacho de un lote** | La fila de `despacho_lote` que lo incluye. Un lote puede Viajar en varios envíos; cada uno con su propia cantidad. |
| **Control** | Lectura de temperatura/humedad con veredicto `NORMAL` / `FUERA_RANGO`. |
| **Desviación** | Un `control` con `resultado = 'FUERA_RANGO'`. |
| **Incidencia** | Registro único de alerta + no conformidad + acción correctiva, ligado al control que la originó. |
| **Evidencia** | Archivo que respalda una incidencia. |
| **Evento** | Entrada de la línea de tiempo, con tipo, actor, lugar y fecha. |
| **Trazabilidad** | Reconstrucción ordenada de eventos + controles + incidencias de un lote o despacho. |

---

## 5. Estados

### `usuario.rol`

| Valor | Puede |
|---|---|
| `ADMIN` | Todo, incluidos usuarios y umbrales. |
| `OPERADOR` | Registrar y modificar lotes, despachos, controles y eventos. |
| `CALIDAD` | Lo de `OPERADOR` + incidencias, causa, acción correctiva, bloqueo y liberación de lotes. |
| `SUPERVISOR` | Lectura: dashboard, trazabilidad e historial. |

La separación de permisos es de aplicación: el ENUM no impone nada por sí solo.

### `lote.estado`

```text
DISPONIBLE ──► EN_TRANSITO ──► ENTREGADO
     │              │
     │              └──────► DESCARTADO
     │
     ├──► BLOQUEADO ──► DISPONIBLE     (liberación autorizada)
     └──► DESCARTADO
```

- `BLOQUEADO` impide asociar el lote a un despacho nuevo. Esa regla es de servicio (`lote.estado != 'BLOQUEADO'` al crear `despacho_lote`), no un trigger.
- Solo `CALIDAD` y `ADMIN` mueven el lote a `DISPONIBLE` desde `BLOQUEADO`.
- Todo cambio de estado escribe un `evento` de tipo `BLOQUEO_LOTE`, `LIBERACION_LOTE`, `DESCARTE_LOTE`, `SALIDA` o `ENTREGA`.
- No existe estado `VENCIDO`: un lote vencido se detecta comparando `fecha_vencimiento` con la fecha actual.

### `despacho.estado`

```text
PENDIENTE ──► PREPARACION ──► EN_TRANSITO ──► ENTREGADO
     └───────────────────────────────► CANCELADO
```

Transición Terminal: `ENTREGADO` y `CANCELADO`. `EN_TRANSITO` marca la ventana en la que se registran controles.

### `control.resultado`

`NORMAL` (dentro de los límites del producto) · `FUERA_RANGO` (fuera de al menos un límite definido).

Regla de evaluación: se compara contra los límites **no nulos** del producto del lote. Si el producto no define límites, o el valor medido es `NULL`, el resultado es `NORMAL` — no hay contra qué comparar.

### `incidencia.estado`

```text
ABIERTA ──► EN_PROCESO ──► RESUELTA ──► CERRADA
```

`ABIERTA` + `ALTA|CRITICA` es la cola de trabajo del dashboard. `fecha_cierre` se escribe al entrar en `RESUELTA`.

### `evento.tipo`

`CREACION_LOTE` · `PREPARACION` · `CONTROL` · `SALIDA` · `CAMBIO_UBICACION` · `LLEGADA` · `BLOQUEO_LOTE` · `LIBERACION_LOTE` · `DESCARTE_LOTE` · `ENTREGA` · `OTRO`

Los tipos de estado de `lote`, `despacho` y `incidencia` se alinean con este enum para que la línea de tiempo sea legible sin lógica adicional.

---

## 6. Reglas de negocio

| # | Regla | Dónde se garantiza |
|---|---|---|
| RB-01 | Un lote `BLOQUEADO` no puede asociarse a un despacho nuevo. | Servicio |
| RB-02 | Solo `CALIDAD`/`ADMIN` liberan un lote bloqueado. | Servicio + `SecurityConfig` |
| RB-03 | Cada cambio de estado de lote o despacho deja un `evento` con `id_usuario` y `fecha_hora`. | Servicio |
| RB-04 | `control.resultado` se calcula comparando con los límites no nulos de `producto`. | Servicio |
| RB-05 | Un `FUERA_RANGO` genera una `incidencia` de tipo `TEMPERATURA` o `HUMEDAD` según la variable afectada, enlazada por `id_control`. | Servicio |
| RB-06 | Toda escritura registra el `id_usuario` actor. | Columnas `NOT NULL` + FK |
| RB-07 | Los eventos y controles son append-only: no se editan ni se borran. | Servicio (sin endpoint de borrado) |
| RB-08 | `despacho_lote` no admite `cantidad <= 0` ni el mismo lote dos veces en un envío. | `chk_despacho_lote_cantidad`, `uq_despacho_lote` |
| RB-09 | La trazabilidad se consulta por `id_lote` o `id_despacho` en orden `fecha_hora`. | Índices compuestos de `evento` |
| RB-10 | Las contraseñas se almacenan hasheadas en `password_hash`. | Servicio de autenticación |

Las reglas de umbral y rango del producto (`min <= max`, humedad 0–100) están delegadas en los `CHECK` de la tabla, no en Java.

---

## 7. Trazabilidad

Dado un lote o un despacho, la vista de trazabilidad se compone de cuatro fuentes, unidas por el mismo par de identificadores:

```sql
-- 1. Línea de tiempo (eventos)
SELECT * FROM evento
WHERE id_lote = :id OR id_despacho = :id
ORDER BY fecha_hora;

-- 2. Evolución de la condición
SELECT fecha_hora, temperatura, humedad, resultado
FROM control
WHERE id_lote = :id OR id_despacho = :id
ORDER BY fecha_hora;

-- 3. Incidencias del lote / envío
SELECT * FROM incidencia
WHERE id_lote = :id OR id_despacho = :id
ORDER BY fecha_creacion;

-- 4. Evidencias de esas incidencias
SELECT e.* FROM evidencia e
JOIN incidencia i ON i.id_incidencia = e.id_incidencia
WHERE i.id_lote = :id OR i.id_despacho = :id;
```

Encabezado de contexto, para responder "¿de qué producto y hacia dónde va?":

```sql
SELECT l.codigo_lote, p.nombre AS producto, p.categoria,
       d.codigo AS despacho, d.destino, d.transportista, d.vehiculo, d.placa,
       l.estado AS estado_lote, d.estado AS estado_despacho
FROM lote l
JOIN producto p ON p.id_producto = l.id_producto
LEFT JOIN despacho_lote dl ON dl.id_lote = l.id_lote
LEFT JOIN despacho d ON d.id_despacho = dl.id_despacho
WHERE l.id_lote = :id;
```

Esta composición responde las preguntas centrales del proyecto: qué pasó, cuándo, en qué envío, qué temperatura había, quién actuó y con qué evidencia.

---

## 8. Flujo principal

```text
Registrar producto (con rangos temp/hum)
        ↓
Registrar lote  ─────────────────► evento CREACION_LOTE
        ↓
Crear despacho (destino, transportista, vehículo)
        ↓
Asociar lotes con cantidad  ──────► evento PREPARACION
        ↓
Registrar salida  ──────────────► evento SALIDA · despacho EN_TRANSITO
        ↓
Registrar lectura  ──────────────► control (NORMAL | FUERA_RANGO)
        ↓                     ─────► evento CONTROL
   ¿FUERA_RANGO?
    NO │        SÍ
    │          └──► crear incidencia (ABIERTA, prioridad)
    │                    ↓
    │              evidencia adjunta
    │                    ↓
    │              EN_PROCESO · causa · accion · responsable
    │                    ↓
    │              ¿Requiere detener el lote?
    │                 NO │        SÍ
    │                    │          └──► BLOQUEO_LOTE
    │                    │                   ↓
    │              RESUELTA            investigación
    │                    ↓                   ↓
    │              fecha_cierre      LIBERACION_LOTE ó DESCARTE_LOTE
    ↓                    ↓
   ...              CERRADA
```

Cada transición de la rama derecha escribe su `evento`; la decisión queda fechada y con autor.

---

## 9. Indicadores

No hay tablas de agregación: el dashboard se calcula por consulta sobre el modelo.

| Indicador | Origen |
|---|---|
| % lecturas en rango | `COUNT(*) WHERE resultado='NORMAL'` / total en `control`, con filtro por `fecha_hora` |
| Lecturas fuera de rango | `control` por `idx_control_resultado` |
| Envíos por estado | `despacho` por `idx_despacho_estado` |
| Envíos del día / próximos | `despacho` por `idx_despacho_fecha_programada` |
| Lotes por estado | `lote` por `idx_lote_estado` |
| Lotes por vencer | `lote` por `idx_lote_vencimiento` |
| Cumplimiento por producto | `control` → `lote` → `producto`, agrupado |
| Incidencias abiertas por prioridad | `incidencia` por `idx_incidencia_estado` + `idx_incidencia_prioridad` |
| Tiempo de resolución | `incidencia.fecha_cierre - fecha_creacion` |
| Eventos registrados | `evento` por `idx_evento_tipo` y rango de fechas |

---

## 10. Contrato de API

Implementado en `Friotrack` (Spring Boot 4.1, Java 21). Base: `/api`.

- Prefijo `/api`, recurso en singular.
- JSON en `snake_case`, idéntico a los nombres de columna (`spring.jackson.property-naming-strategy=SNAKE_CASE`). No hay diferencias entre entrada y salida.
- Autenticación `POST /api/auth/login` → `{ "token", "tipo": "Bearer", "id_usuario", "username", "rol", "expira_en_segundos" }`. El token viaja en `Authorization: Bearer <token>`; el resto de endpoints lo exige.
- El usuario autenticado se toma del JWT; `id_usuario` nunca se acepta del body.
- Las operaciones de estado (bloquear, liberar, descartar, cambiar estado) son endpoints dedicados, no `PUT` genéricos: son las que escriben `evento`.
- `spring.jpa.open-in-view=false`: **los servicios devuelven DTOs**, nunca entidades. Mapear dentro del controlador lanzaría `LazyInitializationException` en cualquier relación perezosa.
- Errores uniformes: `{ "timestamp", "status", "error", "mensaje", "ruta", "campos" }`. `400` validación (con errores por campo) o valor de enum inválido, `401` sin token o inválido, `403` rol insuficiente, `404` no existe, `405` método no permitido (con cabecera `Allow`), `409` duplicado, `415` `Content-Type` no soportado, `422` regla de negocio.
- CORS: los orígenes permitidos se configuran con `app.cors.allowed-origins` (variable `APP_CORS_ORIGINS`, separados por coma, admite patrones como `https://*.vercel.app`). Por defecto, `http://localhost:3000`.
- `/api/usuario/**`: lectura permitida a los cuatro roles (el frontend necesita listar responsables); escritura solo `ADMIN`.

### Endpoints

| Método | Ruta | Rol | Efecto |
|---|---|---|---|
| POST | `/api/auth/login` | público | Emite JWT |
| GET | `/api/dashboard?desde&hasta` | todos | Indicadores agregados |
| GET | `/api/trazabilidad/lote/{idLote}` | todos | Trazabilidad completa del lote |
| GET | `/api/trazabilidad/despacho/{idDespacho}` | todos | Trazabilidad completa del envío |
| GET | `/api/producto?activo&q` | todos | Listado paginado |
| GET | `/api/producto/activos`, `/con-lotes` | todos | Catálogo |
| POST | `/api/producto` | ADMIN | Crea producto con umbrales |
| PUT / DELETE | `/api/producto/{id}`, `/definitivo` | ADMIN | Actualiza / desactiva / elimina |
| GET | `/api/lote?estado&idProducto&q` | todos | Listado paginado |
| GET | `/api/lote/estado/{e}`, `/producto/{id}`, `/por-vencer` | todos | Filtros |
| POST / PUT | `/api/lote`, `/api/lote/{id}` | escritura | Crea / actualiza |
| PATCH | `/api/lote/{id}/bloquear`, `/liberar`, `/descartar` | CALIDAD, ADMIN | Cambia estado + escribe `evento` |
| GET | `/api/despacho?estado&q` | todos | Listado paginado |
| POST / PUT | `/api/despacho`, `/api/despacho/{id}` | escritura | Crea / actualiza |
| PATCH | `/api/despacho/{id}/estado` | escritura | Transición válida + `evento` + propaga estado a los lotes |
| GET | `/api/despacho/{id}/lotes` | todos | Lotes del envío |
| POST | `/api/despacho/{id}/lotes` | escritura | Asocia lote con cantidad |
| DELETE | `/api/despacho/lote/{idDespachoLote}` | escritura | Retira el lote |
| POST | `/api/control` | escritura | Registra lectura, calcula `resultado`, abre incidencia si `FUERA_RANGO` |
| GET | `/api/control?idDespacho&idLote`, `/fuera-de-rango` | todos | Histórico |
| GET | `/api/incidencia?estado&tipo&idLote&idDespacho&prioridad` | todos | Incidencias (resumen) |
| GET | `/api/incidencia/abiertas` | todos | Cola de trabajo |
| POST / PUT | `/api/incidencia`, `/api/incidencia/{id}` | CALIDAD, ADMIN | Registra / actualiza |
| PATCH | `/api/incidencia/{id}/estado` | CALIDAD, ADMIN | Ciclo de vida, exige causa para resolver |
| GET / POST | `/api/incidencia/{id}/evidencias` | GET todos · POST CALIDAD/ADMIN | Adjunta evidencia |
| GET / POST / DELETE | `/api/evidencia?idIncidencia\|idLote\|idDespacho`, `/{id}` | CALIDAD, ADMIN | Evidencias |
| GET | `/api/evento?idLote&idDespacho&tipo&desde&hasta` | todos | Historial paginado |
| GET | `/api/evento/timeline/lote/{id}`, `/despacho/{id}` | todos | Línea de tiempo |
| POST | `/api/evento` | escritura | Evento manual (debe anclar lote o despacho) |
| GET / POST / PUT / PATCH / DELETE | `/api/usuario...` | ADMIN | Gestión de usuarios |

`SUPERVISOR` es **solo lectura**: cualquier `POST`, `PUT`, `PATCH` o `DELETE` devuelve `403`.

### Primer usuario (bootstrap)

`BootstrapAdminRunner` se ejecuta al arrancar. Solo actúa si la tabla `usuario` está vacía: nunca sobreescribe datos existentes, por lo que es idempotente.

| Propiedad | Variable de entorno | Defecto |
|---|---|---|
| `app.bootstrap.enabled` | `APP_BOOTSTRAP_ENABLED` | `true` |
| `app.bootstrap.username` | `APP_BOOTSTRAP_USERNAME` | `admin` |
| `app.bootstrap.password` | `APP_BOOTSTRAP_PASSWORD` | vacío → **se genera una contraseña aleatoria** |
| `app.bootstrap.nombre` | `APP_BOOTSTRAP_NOMBRE` | `Administrador` |
| `app.bootstrap.apellido` | `APP_BOOTSTRAP_APELLIDO` | `Sistema` |
| `app.bootstrap.rol` | `APP_BOOTSTRAP_ROL` | `ADMIN` |

La contraseña (configurada o generada) se escribe en el log durante el arranque, una sola vez. Para desactivar el comportamiento: `APP_BOOTSTRAP_ENABLED=false`.

Otras propiedades: `app.jwt.secret` (mínimo 32 bytes; con el valor por defecto emite un aviso en el log) y `app.jwt.expiration-segundos` (por defecto 7200).

### Requisitos que impone `ddl-auto=validate`

Toda entidad JPA debe reproducir exactamente el SQL. Si una entidad declara una columna, un `enum` con un valor o una relación que el script no tiene, **el backend no arranca**. En particular:

- `Usuario` no debe declarar `email` ni `rol` como relación a entidad; `rol` es un `enum` mapeado a la columna `rol`.
- Los repositorios no pueden derivar consultas por rutas de asociación: como las PK no se llaman `id`, Spring Data 4 resuelve `findByDespachoId` contra `despacho.id` y falla. **Toda consulta por id de asociación va en `@Query` explícito** (`porDespacho`, `porLote`, `existe`, `contarPorIncidencia`…).
- Los valores de los enums Java deben coincidir literalmente con los del ENUM, o la lectura de filas existentes falla.
- Las relaciones deben declarar la columna cuando la FK no se llama `<propiedad>_id` (caso de `incidencia.responsable`).
- Las columnas `NOT NULL DEFAULT CURRENT_TIMESTAMP` no se rellenan solas en un `INSERT` de Hibernate: cada entidad tiene un `@PrePersist` que asigna la fecha si viene nula.

---

## 11. Reglas para futuros cambios

1. Toda decisión relevante se registra como `evento` con actor y `fecha_hora`. Sin excepción.
2. No se añaden columnas para guardar datos derivables. `control.resultado` se calcula; `lote.estado` se mantiene con el flujo, no se recalcula en lectura.
3. No se hardcodean reglas de rango en el servicio: los límites se configuran en `producto`.
4. Un cambio de esquema es un cambio de contrato: script y entidades se actualizan juntos, en el mismo commit.
5. No se eliminan ni editan filas históricas (`evento`, `control`, `evidencia`). Las correcciones se registran como un evento nuevo.
6. El historial se reconstruye con índices compuestos `(id_entidad, fecha_hora)`; cualquier consulta nueva de timeline debe respetar ese patrón.
7. No se introduzcan subentidades sin justificar: la consolidación de 17 tablas a 9 es deliberada y responde a la simplicidad de la primera versión.
8. Todo ENUM añadido debe acompañarse de su manejo en el enum Java y en las consultas del dashboard.
9. Los CHECK de negocio que puedan expresarse en DDL van en DDL.
10. Si una funcionalidad no registra, controla, demuestra o reconstruye algo de la cadena de custodia, se evalúa fuera de alcance.
