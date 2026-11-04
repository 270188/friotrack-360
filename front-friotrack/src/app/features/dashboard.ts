import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Api } from '../core/api';
import { carga } from '../core/carga';
import { num } from '../core/format';
import { EtiquetaPipe, FechaHoraPipe, NumPipe } from '../core/pipes';
import { ESTADOS_DESPACHO, type Dashboard } from '../core/types';
import { LineaTiempo } from '../shared/dominio';
import { Alerta, BarraPct, Cargando, Insignia, Kpi, Vacio } from '../shared/ui';

@Component({
  selector: 'app-dashboard',
  imports: [FormsModule, RouterLink, Alerta, Cargando, Insignia, Kpi, Vacio, BarraPct, LineaTiempo, EtiquetaPipe, FechaHoraPipe, NumPipe],
  template: `
    <header class="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 class="text-2xl font-bold tracking-tight text-ink-900">Panel de control</h1>
        <p class="mt-1 text-sm text-ink-700">Cumplimiento de la cadena de frío, estado de lotes e incidencias.</p>
      </div>
      <div class="flex items-end gap-2">
        <label class="text-xs font-semibold text-ink-700">Desde
          <input type="date" class="campo mt-1" name="desde" [ngModel]="desde()" (ngModelChange)="desde.set($event); d.recargar()" />
        </label>
        <label class="text-xs font-semibold text-ink-700">Hasta
          <input type="date" class="campo mt-1" name="hasta" [ngModel]="hasta()" (ngModelChange)="hasta.set($event); d.recargar()" />
        </label>
      </div>
    </header>

    @if (d.error()) { <app-alerta>{{ d.error() }}</app-alerta> }
    @if (d.cargando() && !d.data()) { <app-cargando /> }

    @if (d.data(); as x) {
      <div class="space-y-6">
        <div class="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <app-kpi etiqueta="Lecturas en rango" [valor]="pct(x.cumplimiento.porcentaje_en_rango)"
            [detalle]="x.cumplimiento.en_rango + ' de ' + x.cumplimiento.controles + ' controles'"
            [tono]="x.cumplimiento.porcentaje_en_rango >= 95 ? 'ok' : 'alerta'" />
          <app-kpi etiqueta="Fuera de rango" [valor]="x.cumplimiento.fuera_de_rango"
            [detalle]="x.cumplimiento.desviaciones_en_despachos_activos + ' en despachos activos'"
            [tono]="x.cumplimiento.fuera_de_rango ? 'alerta' : 'neutro'" />
          <app-kpi etiqueta="Despachos sin incidencias" [valor]="x.cumplimiento.despachos_sin_incidencias"
            [detalle]="'de ' + x.cumplimiento.despachos + ' despachos'" tono="info" />
          <app-kpi etiqueta="Resolución promedio" [valor]="(x.incidencias.promedio_minutos_resolucion | num: 0) + ' min'"
            detalle="desde la apertura hasta el cierre" />
        </div>

        <div class="grid gap-6 lg:grid-cols-3">
          <section class="tarjeta">
            <div class="titulo-seccion"><h2>Lotes ({{ x.lotes.total }})</h2><a routerLink="/lotes" class="enlace">Ver lotes</a></div>
            <ul class="divide-y divide-ink-300/20 px-5 py-2 text-sm">
              @for (l of lotes(); track l[0]) {
                <li class="flex items-center justify-between py-2"><app-insignia [valor]="l[0]" /><span class="font-semibold tabular-nums">{{ l[1] }}</span></li>
              }
              <li class="flex items-center justify-between py-2">
                <span class="text-ink-700">Por vencer (30 días)</span>
                <span class="font-semibold tabular-nums" [class.text-alert-500]="x.lotes.por_vencer">{{ x.lotes.por_vencer }}</span>
              </li>
            </ul>
          </section>

          <section class="tarjeta">
            <div class="titulo-seccion"><h2>Despachos por estado</h2><a routerLink="/despachos" class="enlace">Ver despachos</a></div>
            <div class="space-y-3 px-5 py-4">
              @for (e of despachos(); track e.estado) {
                <div>
                  <div class="mb-1 flex justify-between text-sm"><span class="text-ink-700">{{ e.estado | etiqueta }}</span><span class="font-semibold tabular-nums">{{ e.total }}</span></div>
                  <div class="h-2 rounded-full bg-ice-100"><div class="h-full rounded-full bg-ink-800" [style.width.%]="e.pct"></div></div>
                </div>
              }
            </div>
          </section>

          <section class="tarjeta">
            <div class="titulo-seccion"><h2>Incidencias ({{ x.incidencias.total }})</h2><a routerLink="/incidencias" class="enlace">Ver incidencias</a></div>
            <div class="grid grid-cols-2 gap-3 px-5 py-4">
              @for (i of incidencias(); track i[0]) {
                <div class="rounded-lg bg-ice-50 p-3">
                  <p class="text-xs text-ink-500">{{ i[0] }}</p>
                  <p class="text-2xl font-bold tabular-nums" [class]="i[2]">{{ i[1] }}</p>
                </div>
              }
            </div>
            <p class="px-5 pb-4 text-xs text-ink-700">
              <span class="font-semibold text-alert-500">{{ x.incidencias.criticas }}</span> críticas ·
              <span class="font-semibold">{{ x.incidencias.altas }}</span> de prioridad alta
            </p>
          </section>
        </div>

        <div class="grid gap-6 lg:grid-cols-2">
          <section class="tarjeta">
            <div class="titulo-seccion"><h2>Cumplimiento por producto</h2></div>
            @if (x.cumplimiento_por_producto.length) {
              <ul class="space-y-4 px-5 py-4">
                @for (p of x.cumplimiento_por_producto; track p.id_producto) {
                  <li>
                    <div class="mb-1 flex items-baseline justify-between gap-3 text-sm">
                      <span class="truncate font-medium text-ink-900">{{ p.nombre }}</span>
                      <span class="shrink-0 text-ink-700 tabular-nums"><span class="font-semibold text-ink-900">{{ p.porcentaje_en_rango | num: 1 }}%</span> · {{ p.desviaciones }}/{{ p.controles }} desv.</span>
                    </div>
                    <app-barra-pct [valor]="p.porcentaje_en_rango" />
                  </li>
                }
              </ul>
            } @else {
              <app-vacio titulo="Aún no hay controles registrados" />
            }
          </section>

          <section class="tarjeta">
            <div class="titulo-seccion"><h2>Incidencias abiertas</h2></div>
            @if (x.incidencias_abiertas.length) {
              <ul class="divide-y divide-ink-300/20">
                @for (i of x.incidencias_abiertas.slice(0, 8); track i.id_incidencia) {
                  <li>
                    <a [routerLink]="['/incidencias', i.id_incidencia]" class="flex items-start gap-3 px-5 py-3 hover:bg-ice-50">
                      <app-insignia [valor]="i.prioridad" />
                      <div class="min-w-0 flex-1">
                        <p class="truncate text-sm font-medium text-ink-900">{{ i.descripcion }}</p>
                        <p class="text-xs text-ink-500">Lote {{ i.codigo_lote }} · {{ i.tipo | etiqueta }} · {{ i.fecha_creacion | fechaHora }}</p>
                      </div>
                      <app-insignia [valor]="i.estado" />
                    </a>
                  </li>
                }
              </ul>
            } @else {
              <app-vacio titulo="Sin incidencias abiertas" detalle="La cadena de frío está bajo control." />
            }
          </section>
        </div>

        <section class="tarjeta">
          <div class="titulo-seccion"><h2>Eventos recientes</h2><a routerLink="/eventos" class="enlace">Historial completo</a></div>
          <div class="px-5 py-5"><app-linea-tiempo [items]="x.eventos_recientes" /></div>
        </section>
      </div>
    }`,
})
export class DashboardPage {
  private api = inject(Api);
  desde = signal('');
  hasta = signal('');
  d = carga(() => this.api.get<Dashboard>('/api/dashboard', { desde: this.desde(), hasta: this.hasta() }));

  pct = (v: number) => `${num(v, 1)}%`;

  lotes = computed(() => {
    const l = this.d.data()?.lotes;
    if (!l) return [];
    return [
      ['DISPONIBLE', l.disponibles],
      ['BLOQUEADO', l.bloqueados],
      ['EN_TRANSITO', l.en_transito],
      ['ENTREGADO', l.entregados],
      ['DESCARTADO', l.descartados],
    ] as [string, number][];
  });

  despachos = computed(() => {
    const lista = this.d.data()?.despachos_por_estado ?? [];
    const mapa = new Map(lista.map((x) => [x.estado, x.total]));
    const maxv = Math.max(1, ...lista.map((x) => x.total));
    return ESTADOS_DESPACHO.map((estado) => {
      const total = mapa.get(estado) ?? 0;
      return { estado, total, pct: (total / maxv) * 100 };
    });
  });

  incidencias = computed(() => {
    const i = this.d.data()?.incidencias;
    if (!i) return [];
    return [
      ['Abiertas', i.abiertas, 'text-alert-500'],
      ['En proceso', i.en_proceso, 'text-[#a26f00]'],
      ['Resueltas', i.resueltas, 'text-ok-500'],
      ['Cerradas', i.cerradas, 'text-ink-700'],
    ] as [string, number, string][];
  });
}
