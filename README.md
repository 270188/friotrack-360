# FrioTrack 360

Sistema web de **trazabilidad de productos perecibles en la cadena de frío**. Registra lotes, despachos, lecturas de temperatura y humedad, desviaciones, no conformidades, acciones correctivas y evidencias. Con eso se puede reconstruir la historia completa de un lote o envío: qué ocurrió, cuándo, quién intervino y qué decisión se tomó.

Proyecto del curso **Desarrollo Web Integrado** · Facultad de Ingeniería de Sistemas e Informática · Universidad Tecnológica del Perú · Lima 2026.

## Arquitectura

```text
┌───────────────────────────────┐
│ Frontend — Angular 21         │  front-friotrack/   (nginx en Docker · Vercel/Netlify)
│ Standalone, signals, Tailwind │
└──────────────┬────────────────┘
               │ HTTP/JSON (snake_case) + JWT  ·  URL configurable con API_URL
               ▼
┌───────────────────────────────┐
│ Backend — Spring Boot 4.1     │  Friotrack/   (Java 21, JPA/Hibernate, Spring Security)
│ API REST bajo /api            │
└──────────────┬────────────────┘
               │ JDBC
               ▼
┌───────────────────────────────┐
│ MySQL 8 — friotrack360        │  friotrack360.sql   (9 tablas, fuente de verdad del esquema)
└───────────────────────────────┘
```

| Carpeta / archivo | Contenido |
|---|---|
| `Friotrack/` | Backend Spring Boot: `controller`, `service`, `repository`, `entity`, `dto`, `security`, `exception`, `support` |
| `front-friotrack/` | Frontend Angular (ver su [README](front-friotrack/README.md)) |
| `friotrack360.sql` | Esquema de la base de datos (Hibernate solo lo valida: `ddl-auto=validate`) |
| `docker-compose.yml` | Levanta MySQL, backend y frontend juntos |
| `db/` | Imagen de MySQL con el esquema precargado, para desplegar la base en la nube |
| `context.md` | Referencia técnica: modelo de datos, estados, reglas y contrato de la API |
| `DESPLIEGUE.md` | Guía para publicar el sistema (Railway + Vercel) |

## Levantar todo con Docker

Requisitos: Docker Desktop.

```bash
git clone https://github.com/270188/friotrack-360.git
cd friotrack-360
docker compose up --build
```

| Servicio | URL |
|---|---|
| Frontend | http://localhost:3000 |
| Backend (API) | http://localhost:8080/api |
| MySQL | `localhost:3308` · base `friotrack360` · usuario `friotrack` / `friotrack123` |

**Usuario inicial:** `admin` / `admin123`. Si la tabla `usuario` está vacía, el backend lo crea al arrancar. Desde la pantalla **Usuarios** se crean los demás.

## Desarrollo sin Docker

**Base de datos:** MySQL 8 con una base `friotrack360` y el esquema cargado:

```bash
mysql -u root -p -e "CREATE DATABASE friotrack360"
mysql -u root -p friotrack360 < friotrack360.sql
```

**Backend** (Java 21), en http://localhost:8080:

```bash
cd Friotrack
./mvnw spring-boot:run
```

La conexión por defecto está en `src/main/resources/application.properties` (`root` / `1234` en `localhost:3306`).

**Frontend** (Node 20.19 o superior), en http://localhost:3000:

```bash
cd front-friotrack
npm install
npm start
```

## Escáner y etiquetas

- **Escanear** (menú *Operación*): lee con la cámara del celular o de la PC el QR o el código de barras de un lote o despacho y muestra su estado con acceso directo a la trazabilidad. También acepta pistolas lectoras USB/Bluetooth, que escriben el código en el campo de búsqueda.
- **Etiqueta QR** (detalle de cada lote y despacho): genera una etiqueta de 90 × 56 mm con QR, código de barras Code 128 y los datos principales, lista para imprimir en varias copias.
- El QR lleva la dirección `…/escanear?tipo=lote&codigo=LOT-…`: si se lee con la cámara nativa del celular, abre el sistema directamente en ese lote (tras iniciar sesión).
- La cámara del navegador solo funciona con HTTPS (Vercel) o en `localhost`.

## Facturación electrónica SUNAT (modo prueba)

Menú **Facturación → Comprobantes**: facturas, boletas y guías de remisión con el nombre de la empresa emisora (variables `SUNAT_*`).

| Comprobante | Qué hace el sistema | Estado en modo prueba |
|---|---|---|
| Factura (01) y boleta (03) | Arma el XML UBL 2.1, lo firma, lo envía al **entorno beta de SUNAT** (`sendBill`) y guarda la constancia de recepción (CDR) | SUNAT la valida y responde *aceptada*, *observada* o *rechazada*; no tiene valor tributario |
| Guía de remisión remitente (09) | Arma y firma el XML (desde un despacho: destino, placa y lotes se completan solos) | *No enviada*: SUNAT no ofrece entorno de pruebas para guías |

- Cada comprobante se descarga en **PDF** (representación impresa con QR y hash, con la marca *DOCUMENTO DE PRUEBA*), **XML** firmado y **CDR**.
- Emiten `ADMIN` y `OPERADOR`; los demás roles solo consultan.
- El núcleo está en `Friotrack/src/main/java/Web/Friotrack/sunat` (Java puro: XML, firma XMLDSig, SOAP y CDR). Incluye un certificado de prueba autofirmado (`resources/sunat/certificado-prueba.p12`), que el entorno beta acepta.
- Para emitir **de verdad** haría falta el RUC real, el usuario y la clave SOL, un certificado digital vigente y `SUNAT_ENTORNO=PRODUCCION` con la URL de producción. Ver `DESPLIEGUE.md`.

## Roles

| Rol | Puede |
|---|---|
| `ADMIN` | Todo, incluidos usuarios y umbrales de productos |
| `OPERADOR` | Registrar y modificar lotes, despachos, lecturas y eventos |
| `CALIDAD` | Lo del operador + incidencias, evidencias, bloqueo y liberación de lotes |
| `SUPERVISOR` | Solo lectura: panel, trazabilidad e historial |

## API (resumen)

Todas las rutas, salvo el login, exigen `Authorization: Bearer <token>`. El JSON usa `snake_case`.

| Recurso | Endpoints principales |
|---|---|
| Autenticación | `POST /api/auth/login` |
| Panel | `GET /api/dashboard?desde&hasta` |
| Trazabilidad | `GET /api/trazabilidad/lote/{id}` · `GET /api/trazabilidad/despacho/{id}` |
| Productos | `GET/POST /api/producto` · `PUT/DELETE /api/producto/{id}` · `GET /api/producto/activos` |
| Lotes | `GET/POST /api/lote` · `PUT /api/lote/{id}` · `PATCH /api/lote/{id}/bloquear` · `/liberar` · `/descartar` |
| Despachos | `GET/POST /api/despacho` · `PATCH /api/despacho/{id}/estado` · `GET/POST /api/despacho/{id}/lotes` |
| Controles | `POST /api/control` · `GET /api/control?idDespacho&idLote` · `GET /api/control/fuera-de-rango` |
| Incidencias | `GET/POST /api/incidencia` · `PATCH /api/incidencia/{id}/estado` · `GET/POST /api/incidencia/{id}/evidencias` |
| Eventos | `GET/POST /api/evento` · `GET /api/evento/timeline/lote/{id}` |
| Comprobantes | `GET /api/comprobante?tipo&q` · `GET /api/comprobante/emisor` · `POST /api/comprobante/venta` · `POST /api/comprobante/guia` · `GET /api/comprobante/{id}` · `/{id}/xml` · `/{id}/cdr` · `POST /api/comprobante/{id}/reenviar` |
| Usuarios | `GET/POST /api/usuario` · `PUT/DELETE /api/usuario/{id}` · `PATCH /api/usuario/{id}/activar` |

El detalle completo (permisos por rol, estados y reglas de negocio) está en [`context.md`](context.md).

## Pruebas

```bash
# Frontend: pruebas unitarias (Vitest)
cd front-friotrack && npm test

# Backend: pruebas unitarias + integración (requieren una MySQL de pruebas en el puerto 3307)
docker run -d --name friotrack-test -e MYSQL_ROOT_PASSWORD=1234 -e MYSQL_DATABASE=friotrack360_test -p 3307:3306 mysql:8.0
docker exec -i friotrack-test mysql -uroot -p1234 friotrack360_test < friotrack360.sql   # esperar unos segundos a que arranque
cd Friotrack && ./mvnw verify -Dfriotrack.test.port=3307
```

Sin la base de pruebas, las pruebas de integración se omiten y solo corren las unitarias.

## Variables de entorno

| Variable | Dónde | Para qué | Por defecto |
|---|---|---|---|
| `SPRING_DATASOURCE_URL` / `_USERNAME` / `_PASSWORD` | backend | Conexión a MySQL | `localhost:3306`, `root` / `1234` |
| `APP_JWT_SECRET` | backend | Firma de los tokens (mínimo 32 bytes) | valor de desarrollo |
| `APP_CORS_ORIGINS` | backend | Dominios del frontend permitidos, separados por coma (acepta `https://*.vercel.app`) | `http://localhost:3000` |
| `APP_BOOTSTRAP_USERNAME` / `_PASSWORD` | backend | Usuario inicial si la tabla está vacía | `admin` / `admin123` |
| `PORT` | backend | Puerto HTTP (lo fijan Railway, Render, etc.) | `8080` |
| `API_URL` | frontend | URL del backend vista desde el navegador | `http://localhost:8080` |
| `SUNAT_RAZON_SOCIAL`, `SUNAT_NOMBRE_COMERCIAL`, `SUNAT_RUC` | backend | Emisor de los comprobantes | `EMPRESA DE PRUEBA S.A.C.`, RUC `20000000001` |
| `SUNAT_DIRECCION`, `SUNAT_UBIGEO`, `SUNAT_DEPARTAMENTO` / `_PROVINCIA` / `_DISTRITO` | backend | Domicilio fiscal del emisor | Lima |
| `SUNAT_SERIE_FACTURA` / `_BOLETA` / `_GUIA` | backend | Series de numeración | `F001`, `B001`, `T001` |
| `SUNAT_ENTORNO`, `SUNAT_URL`, `SUNAT_USUARIO_SOL`, `SUNAT_CLAVE_SOL` | backend | Conexión con SUNAT | `BETA`, servicio beta, `MODDATOS` / `moddatos` |
| `SUNAT_CERTIFICADO`, `SUNAT_CERTIFICADO_CLAVE` | backend | Certificado PKCS#12 (`classpath:` o `file:`) | certificado de prueba incluido |
| `APP_NAME` | frontend | Nombre que se muestra en el menú, el login y la pestaña (por ejemplo, el de la empresa cliente) | `FrioTrack 360` |

## Despliegue

Ver [`DESPLIEGUE.md`](DESPLIEGUE.md): backend y MySQL en Railway, frontend en Vercel.

## Equipo

Espinoza Saravia, Jeremy Javier · Palomino Cabrera, Mc Stvn · Ruiz León, Angela Valeria · Silva Atto, Christopher

Docente: Huamani Uriarte, Enrique Lee · Sección 34953
