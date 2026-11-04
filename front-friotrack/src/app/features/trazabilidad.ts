import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Api, ApiError, mensajeError } from '../core/api';
import type { Despacho, Lote } from '../core/types';
import { Alerta, Icono } from '../shared/ui';

@Component({
  selector: 'app-trazabilidad',
  imports: [FormsModule, RouterLink, Alerta, Icono],
  template: `
    <header class="mb-6">
      <h1 class="text-2xl font-bold tracking-tight text-ink-900">Trazabilidad</h1>
      <p class="mt-1 text-sm text-ink-700">Reconstruye la historia completa de un lote o despacho: qué ocurrió, cuándo, quién intervino y qué decisión se tomó.</p>
    </header>

    <section class="tarjeta p-6">
      <form (ngSubmit)="buscar()" class="flex flex-col gap-3 sm:flex-row">
        <div class="flex rounded-lg bg-ice-100 p-1" role="radiogroup" aria-label="Buscar">
          @for (t of tipos; track t) {
            <button type="button" role="radio" [attr.aria-checked]="tipo() === t" (click)="tipo.set(t)"
              class="cursor-pointer rounded-md px-4 py-1.5 text-sm font-semibold capitalize transition"
              [class]="tipo() === t ? 'bg-white text-ink-900 shadow-sm' : 'text-ink-700'">{{ t }}</button>
          }
        </div>
        <input class="campo flex-1" name="codigo" aria-label="Código" [(ngModel)]="codigo"
          [placeholder]="tipo() === 'lote' ? 'Código del lote, p. ej. LOT-2026-0001' : 'Código del despacho, p. ej. DSP-2026-0001'" />
        <button type="submit" class="btn btn-primario" [disabled]="buscando()">
          @if (buscando()) { <span class="spinner"></span> } @else { <app-icono nombre="buscar" clase="size-4" /> } Reconstruir
        </button>
      </form>
      @if (error()) { <app-alerta class="mt-4">{{ error() }}</app-alerta> }
      <p class="mt-4 text-sm text-ink-700">¿Tienes la etiqueta a la mano?
        <a routerLink="/escanear" class="inline-flex items-center gap-1 font-semibold text-frost-600 hover:underline"><app-icono nombre="escaner" clase="size-4" /> Escanéala con la cámara</a></p>
    </section>

    <section class="mt-8">
      <h2 class="mb-3 text-sm font-bold text-ink-900">La cadena que el sistema reconstruye</h2>
      <ol class="flex flex-wrap items-center gap-x-1.5 gap-y-2">
        @for (c of cadena; track c; let ultimo = $last) {
          <li class="flex items-center gap-1.5">
            <span class="rounded-md px-2.5 py-1 text-xs font-semibold text-white" [class]="alertas.includes(c) ? 'bg-alert-500' : 'bg-ink-800'">{{ c }}</span>
            @if (!ultimo) { <span class="text-frost-500" aria-hidden="true">→</span> }
          </li>
        }
      </ol>
    </section>`,
})
export class TrazabilidadPage {
  private api = inject(Api);
  private router = inject(Router);
  tipos = ['lote', 'despacho'] as const;
  tipo = signal<'lote' | 'despacho'>('lote');
  codigo = '';
  error = signal<string | null>(null);
  buscando = signal(false);
  cadena = ['Lote', 'Despacho', 'Evento', 'Lectura', 'Regla', 'Desviación', 'Alerta', 'No conformidad', 'Acción correctiva', 'Decisión', 'Evidencia', 'Usuario', 'Auditoría'];
  alertas = ['Desviación', 'Alerta', 'No conformidad'];

  async buscar(): Promise<void> {
    const c = this.codigo.trim();
    if (!c) return;
    this.error.set(null);
    this.buscando.set(true);
    try {
      if (this.tipo() === 'lote') {
        const l = await this.api.get<Lote>(`/api/lote/codigo/${encodeURIComponent(c)}`);
        await this.router.navigate(['/lotes', l.id_lote]);
      } else {
        const d = await this.api.get<Despacho>(`/api/despacho/codigo/${encodeURIComponent(c)}`);
        await this.router.navigate(['/despachos', d.id_despacho]);
      }
    } catch (e) {
      this.error.set(e instanceof ApiError && e.status === 404 ? `No existe un ${this.tipo()} con el código "${c}".` : mensajeError(e));
    } finally {
      this.buscando.set(false);
    }
  }
}
