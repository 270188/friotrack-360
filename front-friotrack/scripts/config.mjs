// Completa config.json en la salida de la compilación con la URL del backend y el nombre de la marca.
// Vercel y Netlify ejecutan "npm run build" con las variables de entorno del proyecto:
//   API_URL   URL del backend (por defecto http://localhost:8080)
//   APP_NAME  nombre que se muestra en la interfaz (por defecto FrioTrack 360)
import { readFileSync, writeFileSync } from 'node:fs';

const destino = new URL('../dist/front-friotrack/browser/config.json', import.meta.url);
const config = JSON.parse(readFileSync(destino, 'utf8'));

const url = (process.env.API_URL || '').trim().replace(/\/$/, '');
if (url) {
  if (!/^https?:\/\//.test(url)) {
    console.error(`API_URL debe empezar con http:// o https:// (recibido: "${url}")`);
    process.exit(1);
  }
  config.apiUrl = url;
}
const nombre = (process.env.APP_NAME || '').trim();
if (nombre) config.nombre = nombre;

writeFileSync(destino, JSON.stringify(config, null, 2) + '\n');
console.log(`config.json -> apiUrl = ${config.apiUrl} · nombre = ${config.nombre}`);
