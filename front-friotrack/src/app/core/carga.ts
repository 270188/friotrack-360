import { DestroyRef, inject, signal } from '@angular/core';
import { mensajeError } from './api';

/**
 * Estado de una consulta al backend con signals: data, error, cargando y recargar().
 * Se crea en el contexto de inyección de un componente.
 */
export function carga<T>(fn: () => Promise<T>, opciones: { inmediato?: boolean } = {}) {
  const data = signal<T | null>(null);
  const error = signal<string | null>(null);
  const cargando = signal(false);
  let version = 0;
  let destruido = false;
  inject(DestroyRef).onDestroy(() => (destruido = true));

  async function recargar(): Promise<void> {
    const v = ++version;
    cargando.set(true);
    error.set(null);
    try {
      const r = await fn();
      if (!destruido && v === version) data.set(r);
    } catch (e) {
      if (!destruido && v === version) {
        data.set(null);
        error.set(mensajeError(e));
      }
    } finally {
      if (!destruido && v === version) cargando.set(false);
    }
  }

  if (opciones.inmediato !== false) void recargar();
  return { data: data.asReadonly(), error: error.asReadonly(), cargando: cargando.asReadonly(), recargar };
}

/** Ejecuta una mutación con estado de envío y error. */
export function accion() {
  const enviando = signal(false);
  const error = signal<string | null>(null);
  async function ejecutar<R>(fn: () => Promise<R>): Promise<R | undefined> {
    enviando.set(true);
    error.set(null);
    try {
      return await fn();
    } catch (e) {
      error.set(mensajeError(e));
      return undefined;
    } finally {
      enviando.set(false);
    }
  }
  return { enviando: enviando.asReadonly(), error, ejecutar };
}
