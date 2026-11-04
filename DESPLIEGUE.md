# Despliegue de FrioTrack 360

Así queda el sistema publicado:

| Pieza | Dónde | Carpeta |
|---|---|---|
| Base de datos MySQL 8 | Railway (servicio con volumen) | `db/Dockerfile` |
| Backend Spring Boot | Railway (servicio Docker) | `Friotrack/` |
| Frontend Angular | Vercel | `front-friotrack/` |

El navegador de cada usuario llama al backend directamente, así que el backend necesita una URL pública **HTTPS** (Railway la da gratis) y debe permitir el dominio del frontend en CORS.

---

## 1. Base de datos en Railway

1. En [railway.com](https://railway.com): **New Project → Deploy from GitHub repo →** `friotrack-360`. Railway crea un servicio; renómbralo a **`db`**.
2. En el servicio `db` → **Settings**:
   - **Root Directory:** vacío (raíz del repo).
   - **Variables:** `RAILWAY_DOCKERFILE_PATH` = `db/Dockerfile`.
3. **Variables** del servicio `db`:

   | Variable | Valor |
   |---|---|
   | `MYSQL_ROOT_PASSWORD` | una contraseña segura |
   | `MYSQL_DATABASE` | `friotrack360` |
   | `MYSQL_USER` | `friotrack` |
   | `MYSQL_PASSWORD` | otra contraseña segura |

4. **Volumen:** clic derecho sobre el servicio → **Attach Volume** → montaje en `/var/lib/mysql`. Sin volumen, los datos se pierden en cada reinicio.
5. Deploy. En el primer arranque MySQL ejecuta `friotrack360.sql` y crea las 9 tablas. Si el volumen ya tiene datos, el script no se vuelve a ejecutar.

## 2. Backend en Railway

1. En el mismo proyecto: **New → GitHub Repo →** `friotrack-360`. Renómbralo a **`backend`**.
2. **Settings → Root Directory:** `Friotrack`. Railway detecta el `Dockerfile`, compila con Maven y arranca el `.jar`.
3. **Variables** del servicio `backend` (las referencias `${{db.…}}` las resuelve Railway):

   | Variable | Valor |
   |---|---|
   | `SPRING_DATASOURCE_URL` | `jdbc:mysql://${{db.RAILWAY_PRIVATE_DOMAIN}}:3306/friotrack360?useSSL=false&allowPublicKeyRetrieval=true&serverTimezone=America/Lima` |
   | `SPRING_DATASOURCE_USERNAME` | `${{db.MYSQL_USER}}` |
   | `SPRING_DATASOURCE_PASSWORD` | `${{db.MYSQL_PASSWORD}}` |
   | `SPRING_JPA_SHOW_SQL` | `false` |
   | `APP_JWT_SECRET` | 64 caracteres aleatorios (por ejemplo, la salida de `openssl rand -hex 32`) |
   | `APP_BOOTSTRAP_PASSWORD` | contraseña del usuario `admin` inicial |
   | `APP_CORS_ORIGINS` | `http://localhost:3000,https://*.vercel.app` (ajústalo cuando tengas el dominio final) |

   El puerto lo fija Railway con `PORT`, y el backend ya lo lee (`server.port=${PORT:8080}`).
4. **Settings → Networking → Generate Domain**. Queda algo como `https://backend-production-xxxx.up.railway.app`. Esa es la **URL del backend**.
5. Prueba rápida: `POST https://<url-backend>/api/auth/login` con `{"username":"admin","password":"<APP_BOOTSTRAP_PASSWORD>"}` debe devolver un `token`.

## 3. Frontend en Vercel

1. En [vercel.com/new](https://vercel.com/new) importa `friotrack-360`.
2. **Root Directory:** `front-friotrack`. `vercel.json` ya define la instalación, la compilación, la carpeta de salida y la redirección de rutas.
3. **Environment Variables:** `API_URL` = URL del backend del paso 2 (sin `/` final).
   Opcional: `APP_NAME` = nombre que mostrará la interfaz (por ejemplo, `POLAR PIURA SAC`).
4. Deploy. Cada push a `main` vuelve a publicar.
5. Copia el dominio final (por ejemplo `https://friotrack-360.vercel.app`) y agrégalo en `APP_CORS_ORIGINS` del backend si no lo cubre `https://*.vercel.app`.

> Netlify también sirve: `front-friotrack/netlify.toml` ya está configurado (Base directory `front-friotrack`, variable `API_URL`).

---

## Problemas frecuentes

| Síntoma | Causa y solución |
|---|---|
| El login dice *"No se pudo conectar con el servidor…"* | El backend no está arriba, `API_URL` está mal o el dominio del frontend no está en `APP_CORS_ORIGINS`. Revisa los logs del backend en Railway. |
| *"Este sitio usa HTTPS y el backend usa HTTP"* | `API_URL` debe empezar con `https://`. |
| El backend no arranca: `Schema-validation: missing table` | La base no tiene el esquema. Revisa que el servicio `db` use `db/Dockerfile` y que el volumen estuviera vacío en el primer arranque. |
| El backend no arranca: `Communications link failure` | Revisa `SPRING_DATASOURCE_URL` y que `db` esté en el mismo proyecto de Railway. Si la red privada da problemas, usa la URL pública TCP del servicio `db` (Settings → Networking → TCP Proxy). |
| Cambié `API_URL` y no se refleja | En Vercel hay que volver a desplegar (Deployments → Redeploy), porque `API_URL` se aplica al compilar. En Docker basta con reiniciar el contenedor. |

## Alternativa: un solo servidor con Docker

En cualquier VPS con Docker:

```bash
git clone https://github.com/270188/friotrack-360.git && cd friotrack-360
APP_JWT_SECRET=$(openssl rand -hex 32) \
APP_CORS_ORIGINS=https://tu-dominio.com \
API_URL=https://api.tu-dominio.com \
docker compose up -d --build
```

Delante va un proxy con HTTPS (Caddy o Nginx con Let's Encrypt) que envíe `tu-dominio.com` → puerto 3000 y `api.tu-dominio.com` → puerto 8080.

## Varias empresas con el mismo código

Cada empresa es una instancia independiente: su propio proyecto en Railway (base de datos + backend) y su propio proyecto en Vercel, todos desde este mismo repositorio. Lo que cambia son las variables:

| Instancia | Vercel `APP_NAME` | Vercel `API_URL` | Railway `APP_CORS_ORIGINS` |
|---|---|---|---|
| FrioTrack 360 | *(sin definir)* | backend del proyecto `friotrack-360` | `https://friotrack-360.vercel.app` |
| POLAR PIURA SAC | `POLAR PIURA SAC` | backend del proyecto `polar-piura-sac` | `https://polar-piura-sac.vercel.app` |

Los datos de una empresa nunca se mezclan con los de otra porque cada una tiene su propia base de datos.
