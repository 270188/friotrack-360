import { Component, inject, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Api } from '../core/api';
import { Auth } from '../core/auth';
import { accion, carga } from '../core/carga';
import { aInputFechaHora } from '../core/format';
import { EtiquetaPipe, FechaHoraPipe } from '../core/pipes';
import { TIPOS_EVENTO, type Despacho, type Evento, type Lote } from '../core/types';
import { Alerta, Cargando, Icono, Insignia, Modal, Paginacion, Vacio } from '../shared/ui';

@Component({
  selector: 'app-form-evento',
  imports: [FormsModule, Modal, Alerta, EtiquetaPipe],
  template: `
    <app-modal titulo="Registrar evento de custodia" (cerrar)="cerrar.emit()">
      <form class="grid-form" (ngSubmit)="guardar()">
        @if (a.error()) { <app-alerta class="col-completa">{{ a.error() }}</app-alerta> }
        <label class="block"><span class="etiqueta">Código de lote</span><input class="campo" name="lote" [(ngModel)]="f.codigo_lote" /></label>
        <label class="block"><span class="etiqueta">Código de despacho</span><input class="campo" name="despacho" [(ngModel)]="f.codigo_despacho" /></label>
        <label class="block"><span class="etiqueta">Tipo</span>
          <select class="campo" name="tipo" [(ngModel)]="f.tipo">@for (t of tipos; track t) { <option [value]="t">{{ t | etiqueta }}</option> }</select>
        </label>
        <label class="block"><span class="etiqueta">Fecha y hora</span><input type="datetime-local" class="campo" name="fecha" [(ngModel)]="f.fecha_hora" /></label>
        <label class="col-completa block"><span class="etiqueta">Ubicación</span>
          <input class="campo" name="ubicacion" maxlength="255" placeholder="Almacén central, km 45 Panamericana Sur…" [(ngModel)]="f.ubicacion" />
        </label>
        <label class="col-completa block"><span class="etiqueta">Descripción</span>
          <textarea class="campo min-h-20" name="desc" maxlength="2000" [(ngModel)]="f.descripcion"></textarea>
        </label>
        <div class="acciones-form">
          <button type="button" class="btn btn-secundario" (click)="cerrar.emit()">Cancelar</button>
          <button type="submit" class="btn btn-primario" [disabled]="a.enviando()">@if (a.enviando()) { <span class="spinner"></span> } Registrar</button>
        </div>
      </form>
    </app-modal>`,
})
export class FormEvento {
  private api = inject(Api);
  cerrar = output<void>();
  guardado = output<void>();
  a = accion();
  // Los eventos de bloqueo, liberación, descarte, control y creación los genera el sistema.
  tipos = TIPOS_EVENTO.filter((t) => !['BLOQUEO_LOTE', 'LIBERACION_LOTE', 'DESCARTE_LOTE', 'CONTROL', 'CREACION_LOTE'].includes(t));
  f = { codigo_lote: '', codigo_despacho: '', tipo: 'CAMBIO_UBICACION', ubicacion: '', descripcion: '', fecha_hora: aInputFechaHora() };

  async guardar(): Promise<void> {
    const r = await this.a.ejecutar(async () => {
      const cl = this.f.codigo_lote.trim();
      const cd = this.f.codigo_despacho.trim();
      if (!cl && !cd) throw new Error('Indique el código de un lote o de un despacho.');
      const lote = cl ? await this.api.get<Lote>(`/api/lote/codigo/${encodeURIComponent(cl)}`) : null;
      const desp = cd ? await this.api.get<Despacho>(`/api/despacho/codigo/${encodeURIComponent(cd)}`) : null;
      return this.api.post<Evento>('/api/evento', {
        id_lote: lote?.id_lote ?? null,
        id_despacho: desp?.id_despacho ?? null,
        tipo: this.f.tipo,
        ubicacion: this.f.ubicacion.trim() || null,
        descripcion: this.f.descripcion.trim() || null,
        fecha_hora: this.f.fecha_hora || null,
      });
    });
    if (r) this.guardado.emit();
  }
}

@Component({
  selector: 'app-eventos',
  imports: [FormsModule, RouterLink, Alerta, Cargando, Icono, Insignia, Paginacion, Vacio, FormEvento, EtiquetaPipe, FechaHoraPipe],
  template: `
    <header class="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 class="text-2xl font-bold tracking-tight text-ink-900">Historial de eventos</h1>
        <p class="mt-1 text-sm text-ink-700">Registro de auditoría append-only: los eventos no se editan ni se eliminan; las correcciones se registran como eventos nuevos.</p>
      </div>
      @if (auth.puede('escribir')) {
        <button class="btn btn-primario" (click)="nuevo.set(true)"><app-icono nombre="mas" clase="size-4" /> Registrar evento</button>
      }
    </header>
    @if (aviso()) { <app-alerta class="mb-4" tono="ok">{{ aviso() }}</app-alerta> }

    <section class="tarjeta">
      <div class="grid gap-3 border-b border-ink-300/30 p-4 sm:grid-cols-3">
        <select class="campo" aria-label="Tipo de evento" [ngModel]="tipo()" (ngModelChange)="filtrar(tipo, $event)">
          <option value="">Todos los tipos</option>
          @for (t of tipos; track t) { <option [value]="t">{{ t | etiqueta }}</option> }
        </select>
        <input type="date" class="campo" aria-label="Desde" [ngModel]="desde()" (ngModelChange)="filtrar(desde, $event)" />
        <input type="date" class="campo" aria-label="Hasta" [ngModel]="hasta()" (ngModelChange)="filtrar(hasta, $event)" />
      </div>
      @if (lista.error()) { <div class="p-4"><app-alerta>{{ lista.error() }}</app-alerta></div> }
      @if (lista.cargando() && !lista.data()) { <app-cargando /> }
      @if (lista.data(); as p) {
        @if (p.content.length === 0) {
          <app-vacio titulo="Sin eventos para estos filtros" />
        } @else {
          <div class="tabla-wrap">
            <table class="tabla">
              <thead><tr><th>Fecha y hora</th><th>Tipo</th><th>Descripción</th><th>Lote</th><th>Despacho</th><th>Actor</th></tr></thead>
              <tbody>
                @for (e of p.content; track e.id_evento) {
                  <tr>
                    <td class="whitespace-nowrap tabular-nums">{{ e.fecha_hora | fechaHora }}</td>
                    <td><app-insignia [tono]="tono(e.tipo)" [texto]="e.tipo | etiqueta" /></td>
                    <td class="max-w-md">{{ e.descripcion }} @if (e.ubicacion) { <span class="block text-xs text-ink-500">Ubicación: {{ e.ubicacion }}</span> }</td>
                    <td>@if (e.id_lote) { <a class="hover:underline" [routerLink]="['/lotes', e.id_lote]">{{ e.codigo_lote }}</a> } @else { — }</td>
                    <td>@if (e.id_despacho) { <a class="hover:underline" [routerLink]="['/despachos', e.id_despacho]">{{ e.codigo_despacho }}</a> } @else { — }</td>
                    <td class="text-ink-700">{{ e.username }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
          <app-paginacion [pagina]="pagina()" [totalPaginas]="p.totalPages" [total]="p.totalElements" (cambiar)="pagina.set($event); lista.recargar()" />
        }
      }
    </section>

    @if (nuevo()) {
      <app-form-evento (cerrar)="nuevo.set(false)" (guardado)="registrado()" />
    }`,
})
export class EventosPage {
  private api = inject(Api);
  auth = inject(Auth);
  tipos = TIPOS_EVENTO;
  tipo = signal('');
  desde = signal('');
  hasta = signal('');
  pagina = signal(0);
  nuevo = signal(false);
  aviso = signal<string | null>(null);
  lista = carga(() =>
    this.api.pagina<Evento>('/api/evento', {
      tipo: this.tipo(),
      desde: this.desde() ? `${this.desde()}T00:00:00` : '',
      hasta: this.hasta() ? `${this.hasta()}T23:59:59` : '',
      page: this.pagina(),
      size: 25,
      sort: 'fechaHora,desc',
    }),
  );

  tono(t: string): 'alerta' | 'ok' | 'neutro' {
    return t === 'BLOQUEO_LOTE' || t === 'DESCARTE_LOTE' ? 'alerta' : t === 'LIBERACION_LOTE' ? 'ok' : 'neutro';
  }
  filtrar(s: { set: (v: string) => void }, v: string): void {
    s.set(v);
    this.pagina.set(0);
    void this.lista.recargar();
  }
  registrado(): void {
    this.nuevo.set(false);
    this.aviso.set('Evento registrado.');
    this.pagina.set(0);
    void this.lista.recargar();
  }
}
