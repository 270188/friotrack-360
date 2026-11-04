#!/bin/sh
# Escribe la URL del backend (vista desde el navegador) en config.json.
set -e
URL="${API_URL:-http://localhost:8080}"
printf '{\n  "apiUrl": "%s"\n}\n' "$URL" > /usr/share/nginx/html/config.json
echo "FrioTrack 360: API_URL=$URL"
