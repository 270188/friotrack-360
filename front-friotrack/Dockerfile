# ---- Compilación ----
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# ---- Servidor estático ----
FROM nginx:1.27-alpine
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
# Genera /config.json con la URL del backend al arrancar el contenedor (variable API_URL).
COPY docker/40-config.sh /docker-entrypoint.d/40-config.sh
RUN chmod +x /docker-entrypoint.d/40-config.sh
COPY --from=build /app/dist/front-friotrack/browser /usr/share/nginx/html
ENV API_URL=http://localhost:8080
ENV APP_NAME="FrioTrack 360"
EXPOSE 3000
