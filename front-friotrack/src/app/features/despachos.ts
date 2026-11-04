import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Api } from '../core/api';
import { Auth } from '../core/auth';
import { carga } from '../core/carga';
import { EtiquetaPipe, FechaHoraPipe } from '../core/pipes';
import { ESTADOS_DESPACHO, type Despacho } from '../core/types';
import { FormDespacho } from '../shared/formularios';
import { Alerta, Cargando, Icono, Insignia, Paginacion, Vacio } from '../shared/ui';

@Component({
  selector: 'app-despachos',
  imports: [FormsModule, RouterLink, Alerta, Cargando, Icono, Insignia, Paginacion, Vacio, FormDespacho, EtiquetaPipe, FechaHoraPipe],
  template: `
    <header class="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 class="text-2xl font-bold tracking-tight text-ink-900">Despachos</h1>
        <p class="mt-1 text-sm text-ink-700">Envíos, sus lotes asociados y la cadena de custodia.</p>
      </div>
      @if (auth.puede('escribir')) {
        <button class="btn btn-primario" (click)="nuevo.set(true)"><app-icono nombre="mas" clase="size-4" /> Nuevo despacho</button>
      }
    </header>

    <div class="mb-4 flex flex-wrap gap-2" role="tablist" aria-label="Filtrar por estado">
      @for (e of filtros; track e) {
        <button role="tab" [attr.aria-selected]="estado() === e" (click)="filtrarEstado(e)" class="pestana"
          [class]="estado() === e ? 'pestana-activa' : 'pestana-inactiva'">{{ e ? (e | etiqueta) : 'Todos' }}</button>
      }
    </div>

    <section class="tarjeta">
      <div class="border-b border-ink-300/30 p-4">
        <input class="campo sm:max-w-sm" placeholder="Buscar por código, destino o transportista" aria-label="Buscar"
          [ngModel]="q()" (ngModelChange)="q.set($event); pagina.set(0); lista.recargar()" />
      </div>
      @if (lista.error()) { <div class="p-4"><app-alerta>{{ lista.error() }}</app-alerta></div> }
      @if (lista.cargando() && !lista.data()) { <app-cargando /> }
      @if (lista.data(); as p) {
        @if (p.content.length === 0) {
          <app-vacio titulo="No hay despachos que coincidan" />
        } @else {
          <div class="tabla-wrap">
            <table class="tabla">
              <thead><tr><th>Código</th><th>Destino</th><th>Transportista</th><th>Programado</th><th>Salida</th><th>Estado</th></tr></thead>
              <tbody>
                @for (d of p.content; track d.id_despacho) {
                  <tr class="cursor-pointer hover:bg-ice-50" (click)="abrir(d)">
                    <td><a [routerLink]="['/despachos', d.id_despacho]" (click)="$event.stopPropagation()" class="font-semibold text-ink-900 hover:text-frost-600 hover:underline">{{ d.codigo }}</a></td>
                    <td>{{ d.destino }}</td>
                    <td>{{ d.transportista ?? '—' }} @if (d.placa) { <span class="ml-1 text-xs text-ink-500">({{ d.placa }})</span> }</td>
                    <td class="whitespace-nowrap">{{ d.fecha_programada | fechaHora }}</td>
                    <td class="whitespace-nowrap">{{ d.fecha_salida | fechaHora }}</td>
                    <td><app-insignia [valor]="d.estado" /></td>
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
      <app-form-despacho (cerrar)="nuevo.set(false)" (guardado)="abrir($event)" />
    }`,
})
export class DespachosPage {
  private api = inject(Api);
  private router = inject(Router);
  auth = inject(Auth);
  filtros = ['', ...ESTADOS_DESPACHO];
  q = signal('');
  estado = signal('');
  pagina = signal(0);
  nuevo = signal(false);
  lista = carga(() =>
    this.api.pagina<Despacho>('/api/despacho', { q: this.q(), estado: this.estado(), page: this.pagina(), size: 15, sort: 'idDespacho,desc' }),
  );

  filtrarEstado(e: string): void {
    this.estado.set(e);
    this.pagina.set(0);
    void this.lista.recargar();
  }
  abrir(d: Despacho): void {
    void this.router.navigate(['/despachos', d.id_despacho]);
  }
}
