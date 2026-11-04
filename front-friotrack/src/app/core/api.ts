import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { urlApi } from './config';
import type { Page } from './types';

/** Error uniforme del backend: { timestamp, status, error, mensaje, ruta, campos } */
export class ApiError extends Error {
  constructor(
    public status: number,
    mensaje: string,
    public campos: Record<string, string> | null = null,
  ) {
    super(mensaje);
  }
}

export type Query = Record<string, string | number | boolean | null | undefined>;

function params(q?: Query): HttpParams {
  let p = new HttpParams();
  for (const [k, v] of Object.entries(q ?? {})) {
    if (v !== undefined && v !== null && v !== '') p = p.set(k, String(v));
  }
  return p;
}

function aApiError(e: unknown): ApiError {
  if (e instanceof HttpErrorResponse) {
    if (e.status === 0) {
      const api = urlApi();
      const local = /^http:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/.test(api);
      if (location.protocol === 'https:' && api.startsWith('http:') && !local) {
        return new ApiError(0, `Este sitio usa HTTPS y el backend (${api}) usa HTTP: el navegador bloquea la conexión. Publique el backend con HTTPS.`);
      }
      return new ApiError(0, `No se pudo conectar con el servidor (${api}). Verifique que el backend esté en ejecución y que permita este origen (APP_CORS_ORIGINS).`);
    }
    const d = (e.error && typeof e.error === 'object' ? e.error : {}) as {
      mensaje?: string;
      error?: string;
      campos?: Record<string, string>;
    };
    const msg = d.mensaje || d.error || (e.status === 403 ? 'No cuenta con permisos para esta operación' : `Error ${e.status}`);
    return new ApiError(e.status, msg, d.campos ?? null);
  }
  return e instanceof ApiError ? e : new ApiError(-1, e instanceof Error ? e.message : 'Error inesperado');
}

/** Cliente de la API REST. Devuelve promesas para usarlas con async/await en los componentes. */
@Injectable({ providedIn: 'root' })
export class Api {
  private http = inject(HttpClient);

  private async run<T>(obs: () => import('rxjs').Observable<T>): Promise<T> {
    try {
      return await firstValueFrom(obs());
    } catch (e) {
      throw aApiError(e);
    }
  }

  get<T>(path: string, q?: Query) {
    return this.run(() => this.http.get<T>(urlApi() + path, { params: params(q) }));
  }
  post<T>(path: string, body: unknown = {}, q?: Query) {
    return this.run(() => this.http.post<T>(urlApi() + path, body, { params: params(q) }));
  }
  put<T>(path: string, body: unknown) {
    return this.run(() => this.http.put<T>(urlApi() + path, body));
  }
  patch<T>(path: string, body: unknown = {}) {
    return this.run(() => this.http.patch<T>(urlApi() + path, body));
  }
  del<T = void>(path: string) {
    return this.run(() => this.http.delete<T>(urlApi() + path));
  }
  async pagina<T>(path: string, q?: Query): Promise<Page<T>> {
    return normalizarPagina<T>(await this.get<unknown>(path, q));
  }
}

/**
 * Spring Data puede serializar Page de dos formas (PageImpl directo o PagedModel con "page").
 * Con SNAKE_CASE los nombres llegan como total_elements / total_pages. Se normalizan aquí.
 */
export function normalizarPagina<T>(raw: unknown): Page<T> {
  const r = (raw ?? {}) as Record<string, unknown>;
  const meta = ((r['page'] as Record<string, unknown> | undefined) ?? r) as Record<string, unknown>;
  const content: T[] = Array.isArray(r['content']) ? (r['content'] as T[]) : Array.isArray(raw) ? (raw as T[]) : [];
  return {
    content,
    totalElements: Number(meta['total_elements'] ?? meta['totalElements'] ?? content.length),
    totalPages: Number(meta['total_pages'] ?? meta['totalPages'] ?? 1),
    number: Number(meta['number'] ?? 0),
    size: Number(meta['size'] ?? content.length),
  };
}

export function mensajeError(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.campos && Object.keys(e.campos).length) {
      return `${e.message}: ${Object.entries(e.campos)
        .map(([k, v]) => `${k.replace(/_/g, ' ')} ${v}`)
        .join('; ')}`;
    }
    return e.message;
  }
  return e instanceof Error ? e.message : 'Error inesperado';
}
