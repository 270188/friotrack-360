# FrioTrack 360 — Frontend (Angular)

Interfaz web de FrioTrack 360 hecha con **Angular 21** (componentes standalone, signals, control de flujo `@if`/`@for`) y **Tailwind CSS 4**. Consume la API REST del backend Spring Boot (`../Friotrack`) con autenticación JWT.

## Ejecutar

**Con Docker (todo el sistema):** desde la raíz del repositorio

```bash
docker compose up --build
```

- Frontend: http://localhost:3000
- Backend: http://localhost:8080
- Usuario inicial: `admin` / `admin123` (lo crea el backend si la tabla `usuario` está vacía)

**En desarrollo:** con el backend corriendo en `localhost:8080`

```bash
cd front-friotrack
npm install
npm start            # http://localhost:3000
```

> Se usa el puerto 3000 porque es el origen que el backend permite en CORS (`SecurityConfig`).

**Pruebas unitarias:** `npm test` (Vitest).

## URL del backend y nombre de la marca

Se leen al iniciar la aplicación desde `public/config.json`:

```json
{ "apiUrl": "http://localhost:8080", "nombre": "FrioTrack 360" }
```

Al publicar se cambian con las variables `API_URL` y `APP_NAME`.

En Docker ese archivo se genera al arrancar el contenedor a partir de la variable de entorno `API_URL` (ver `docker/40-config.sh`), así que no hace falta recompilar para apuntar a otro backend.

## Despliegue del frontend (Vercel o Netlify)

El frontend es un sitio estático: se puede publicar solo, apuntando a un backend que esté en otro lugar.

**1. Backend accesible.** El sitio publicado se abre en el navegador de cualquier persona, así que el backend debe tener una URL pública con **HTTPS** (un sitio HTTPS no puede llamar a una API HTTP). Si el backend corre en tu PC, puedes exponerlo con un túnel:

```bash
cloudflared tunnel --url http://localhost:8080      # o: ngrok http 8080
```

Eso entrega una URL tipo `https://xxxx.trycloudflare.com`. Apuntar a `http://localhost:8080` solo funciona en tu propia máquina.

**2. Permitir el dominio del frontend en el backend (CORS).** Arranca el backend con la variable `APP_CORS_ORIGINS`, por ejemplo:

```bash
APP_CORS_ORIGINS=http://localhost:3000,https://friotrack360.vercel.app
```

Acepta patrones (`https://*.vercel.app`, `https://*.netlify.app`). En Docker se define en `docker-compose.yml`.

**3a. Vercel.** Importa el repositorio → *Root Directory* = `front-friotrack` → variable de entorno `API_URL` = URL del backend → Deploy. `vercel.json` ya define la compilación, la carpeta de salida y la redirección de rutas.

**3b. Netlify.** Importa el repositorio → *Base directory* = `front-friotrack` → variable `API_URL` → Deploy. `netlify.toml` ya trae el resto.

**3c. Netlify Drop (sin GitHub).** Ejecuta `API_URL=https://tu-backend npm run build` y arrastra la carpeta `dist/front-friotrack/browser` a https://app.netlify.com/drop. También puedes editar `config.json` dentro de esa carpeta antes de arrastrarla.

`API_URL` se escribe en `config.json` al terminar la compilación (`scripts/config.mjs`); si no se define, queda `http://localhost:8080`.

## Pantallas

| Ruta | Contenido | Endpoints |
|---|---|---|
| `/login` | Inicio de sesión | `POST /api/auth/login` |
| `/dashboard` | Indicadores de cumplimiento, lotes, despachos, incidencias y eventos recientes | `GET /api/dashboard` |
| `/escanear` | Lectura de QR / código de barras con la cámara (zxing) o pistola lectora; resuelve lotes y despachos | `/api/lote/codigo`, `/api/despacho/codigo` |
| `/lotes`, `/lotes/:id` | Listado, registro y edición; ficha con gráfico de temperatura, despachos, lecturas, no conformidades, evidencias y línea de tiempo; bloquear / liberar / descartar | `/api/lote`, `/api/trazabilidad/lote/{id}` |
| `/despachos`, `/despachos/:id` | Listado, registro; lotes asociados, salida, entrega, cancelación, lecturas y cadena de custodia | `/api/despacho`, `/api/trazabilidad/despacho/{id}` |
| `/controles` | Registro de lecturas y lecturas fuera de rango | `/api/control` |
| `/incidencias`, `/incidencias/:id` | Cola por estado y prioridad; causa, acción correctiva, cambio de estado y evidencias | `/api/incidencia` |
| `/trazabilidad` | Búsqueda por código de lote o despacho | `/api/lote/codigo`, `/api/despacho/codigo` |
| `/eventos` | Historial de auditoría con filtros y registro de eventos manuales | `/api/evento` |
| `/productos` | Productos y umbrales de temperatura/humedad | `/api/producto` |
| `/usuarios` | Gestión de usuarios y roles (solo ADMIN) | `/api/usuario` |

## Roles en la interfaz

La interfaz oculta las acciones que el rol no puede ejecutar; el backend (`SecurityConfig`) sigue siendo quien decide.

| Rol | Puede |
|---|---|
| ADMIN | Todo, incluidos productos y usuarios |
| OPERADOR | Registrar lotes, despachos, lecturas y eventos |
| CALIDAD | Lo del operador + incidencias, evidencias, bloqueo y liberación de lotes |
| SUPERVISOR | Solo lectura |

## Estructura

```
src/app/
  core/
    api.ts        cliente HTTP (promesas), errores uniformes del backend, paginación
    auth.ts       sesión JWT (signals), interceptor, guards y permisos por rol
    carga.ts      estado de carga/envío con signals
    config.ts     URL del backend y nombre de la marca leídos de config.json
    codigos.ts    lectura de códigos escaneados, QR y Code 128 para etiquetas
    types.ts      tipos de los DTOs (JSON snake_case)
    format.ts     fechas, números y etiquetas; pipes en pipes.ts
  shared/
    ui.ts         insignias, alertas, modal, paginación, KPI, iconos
    dominio.ts    gráfico de temperatura, línea de tiempo, tablas y listas
    formularios.ts  lote, despacho, lectura de control, no conformidad
    etiqueta.ts   etiqueta imprimible con QR y código de barras
  features/       una página por ruta (lazy loading) + shell con el menú lateral
docker/           nginx y script de configuración en tiempo de ejecución
```
