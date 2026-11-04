// Escribe config.json en la salida de la compilación con la URL del backend.
// Vercel y Netlify ejecutan "npm run build" con las variables de entorno del proyecto,
// así que basta con definir API_URL en su panel. Sin API_URL se conserva public/config.json (http://localhost:8080).
import { writeFileSync } from 'node:fs';

const url = (process.env.API_URL || '').trim().replace(/\/$/, '');
if (url) {
  if (!/^https?:\/\//.test(url)) {
    console.error(`API_URL debe empezar con http:// o https:// (recibido: "${url}")`);
    process.exit(1);
  }
  writeFileSync(new URL('../dist/front-friotrack/browser/config.json', import.meta.url), JSON.stringify({ apiUrl: url }, null, 2) + '\n');
  console.log(`config.json -> apiUrl = ${url}`);
} else {
  console.log('API_URL no definida: se mantiene config.json con http://localhost:8080.');
}
