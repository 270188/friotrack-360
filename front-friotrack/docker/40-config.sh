#!/bin/sh
# Escribe config.json al arrancar el contenedor:
#   API_URL   URL del backend vista desde el navegador
#   APP_NAME  nombre que se muestra en la interfaz
set -e
URL="${API_URL:-http://localhost:8080}"
NOMBRE=$(printf '%s' "${APP_NAME:-FrioTrack 360}" | sed 's/\\/\\\\/g; s/"/\\"/g')
printf '{\n  "apiUrl": "%s",\n  "nombre": "%s"\n}\n' "$URL" "$NOMBRE" > /usr/share/nginx/html/config.json
echo "$NOMBRE: API_URL=$URL"
