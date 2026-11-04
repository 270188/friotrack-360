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

## Despliegue

Ver [`DESPLIEGUE.md`](DESPLIEGUE.md): backend y MySQL en Railway, frontend en Vercel.

## Equipo

Espinoza Saravia, Jeremy Javier · Palomino Cabrera, Mc Stvn · Ruiz León, Angela Valeria · Silva Atto, Christopher

Docente: Huamani Uriarte, Enrique Lee · Sección 34953
