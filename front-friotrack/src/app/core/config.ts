let apiUrl = 'http://localhost:8080';
let nombre = 'FrioTrack 360';

/** URL base del backend, sin barra final. */
export function urlApi(): string {
  return apiUrl;
}

/** Nombre que la interfaz muestra como marca (menú, login y título de la pestaña). */
export function nombreMarca(): string {
  return nombre;
}

/**
 * Lee config.json al iniciar: { "apiUrl": "...", "nombre": "..." }.
 * En Vercel/Netlify lo generan las variables API_URL y APP_NAME al compilar;
 * en Docker, las mismas variables al arrancar el contenedor.
 */
export async function cargarConfiguracion(): Promise<void> {
  try {
    const res = await fetch('config.json', { cache: 'no-store' });
    if (res.ok) {
      const cfg = (await res.json()) as { apiUrl?: string; nombre?: string };
      if (cfg.apiUrl) apiUrl = cfg.apiUrl.replace(/\/$/, '');
      if (cfg.nombre?.trim()) nombre = cfg.nombre.trim();
    }
  } catch {
    /* sin config.json se usan los valores por defecto */
  }
  document.title = nombre;
}
