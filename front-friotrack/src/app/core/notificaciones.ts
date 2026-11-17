// Avisos breves (toasts) compartidos por toda la app: un servicio con signals que cualquier
// componente puede usar para avisar algo, y que el componente <app-notificaciones> muestra.
import { Injectable, signal } from '@angular/core';

export type TipoAviso = 'ok' | 'info' | 'aviso' | 'alerta';

export interface Aviso {
  id: number;
  tipo: TipoAviso;
  texto: string;
}

@Injectable({ providedIn: 'root' })
export class Notificaciones {
  private siguiente = 1;
  readonly avisos = signal<Aviso[]>([]);

  mostrar(texto: string, tipo: TipoAviso = 'info', duracionMs = 5000): number {
    const id = this.siguiente++;
    this.avisos.update((xs) => [...xs.slice(-3), { id, tipo, texto }]);
    if (duracionMs > 0) setTimeout(() => this.cerrar(id), duracionMs);
    return id;
  }

  ok(texto: string): number {
    return this.mostrar(texto, 'ok');
  }

  error(texto: string): number {
    return this.mostrar(texto, 'alerta', 8000);
  }

  cerrar(id: number): void {
    this.avisos.update((xs) => xs.filter((a) => a.id !== id));
  }
}
