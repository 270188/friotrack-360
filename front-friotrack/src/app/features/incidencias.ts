import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Api } from '../core/api';
import { carga } from '../core/carga';
import { etiqueta } from '../core/format';
import { EtiquetaPipe, FechaHoraPipe } from '../core/pipes';
import { ESTADOS_INCIDENCIA, PRIORIDADES, type IncidenciaResumen, type PrioridadIncidencia } from '../core/types';
import { Alerta, Cargando, Insignia, Vacio } from '../shared/ui';

const ORDEN: Record<PrioridadIncidencia, number> = { CRITICA: 0, ALTA: 1, MEDIA: 2, BAJA: 3 };

@Component({
  selector: 'app-incidencias',
  imports: [FormsModule, RouterLink, Alerta, Cargando, Insignia, Vacio, EtiquetaPipe, FechaHoraPipe],
  template: `
    <header class="mb-6">
      <h1 class="text-2xl font-bold tracking-tight text-ink-900">Incidencias y no conformidades</h1>
      <p class="mt-1 text-sm text-ink-700">Ciclo: abierta → en proceso → resuelta → cerrada. Para resolver o cerrar se exige registrar la causa.</p>
    </header>

    <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
      <div class="flex flex-wrap gap-2" role="tablist" aria-label="Estado">
        @for (e of estados; track e) {
          <button role="tab" [attr.aria-selected]="estado() === e" (click)="estado.set(e); lista.recargar()" class="pestana"
            [class]="estado() === e ? 'pestana-activa' : 'pestana-inactiva'">{{ e | etiqueta }}</button>
        }
      </div>
      <select class="campo w-auto" aria-label="Prioridad" [ngModel]="prioridad()" (ngModelChange)="prioridad.set($event); lista.recargar()">
        <option value="">Todas las prioridades</option>
        @for (p of prioridades; track p) { <option [value]="p">{{ p | etiqueta }}</option> }
      </select>
    </div>

    <section class="tarjeta">
      @if (lista.error()) { <div class="p-4"><app-alerta>{{ lista.error() }}</app-alerta></div> }
      @if (lista.cargando() && !lista.data()) { <app-cargando /> }
      @if (lista.data()) {
        @if (items().length === 0) {
          <app-vacio [titulo]="'No hay incidencias ' + estadoTexto()" />
        } @else {
          <div class="tabla-wrap">
            <table class="tabla">
              <thead><tr><th>#</th><th>Descripción</th><th>Lote</th><th>Tipo</th><th>Prioridad</th><th>Registrada</th><th class="text-right">Evid.</th></tr></thead>
              <tbody>
                @for (i of items(); track i.id_incidencia) {
                  <tr class="hover:bg-ice-50">
                    <td class="font-mono text-xs text-ink-500">{{ i.id_incidencia }}</td>
                    <td class="max-w-md"><a [routerLink]="['/incidencias', i.id_incidencia]" class="line-clamp-2 font-medium text-ink-900 hover:text-frost-600 hover:underline">{{ i.descripcion }}</a></td>
                    <td><a [routerLink]="['/lotes', i.id_lote]" class="hover:underline">{{ i.codigo_lote }}</a></td>
                    <td>{{ i.tipo | etiqueta }}</td>
                    <td><app-insignia [valor]="i.prioridad" /></td>
                    <td class="whitespace-nowrap">{{ i.fecha_creacion | fechaHora }}</td>
                    <td class="text-right tabular-nums">{{ i.evidencias }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      }
    </section>`,
})
export class IncidenciasPage {
  private api = inject(Api);
  estados = ESTADOS_INCIDENCIA;
  prioridades = PRIORIDADES;
  estado = signal<string>('ABIERTA');
  prioridad = signal('');
  lista = carga(() => this.api.get<IncidenciaResumen[]>('/api/incidencia', { estado: this.estado(), prioridad: this.prioridad() }));
  estadoTexto = computed(() => etiqueta(this.estado()).toLowerCase() + 's');
  items = computed(() =>
    [...(this.lista.data() ?? [])].sort(
      (a, b) => ORDEN[a.prioridad] - ORDEN[b.prioridad] || (a.fecha_creacion < b.fecha_creacion ? 1 : -1),
    ),
  );
}
