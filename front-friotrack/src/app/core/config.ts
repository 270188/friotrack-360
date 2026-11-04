let apiUrl = 'http://localhost:8080';

/** URL base del backend, sin barra final. */
export function urlApi(): string {
  return apiUrl;
}

export async function cargarConfiguracion(): Promise<void> {
  try {
    const res = await fetch('config.json', { cache: 'no-store' });
    if (res.ok) {
      const cfg = (await res.json()) as { apiUrl?: string };
      if (cfg.apiUrl) apiUrl = cfg.apiUrl.replace(/\/$/, '');
    }
  } catch {
    /* sin config.json se usa el valor por defecto */
  }
}
