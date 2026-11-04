import { Component, computed, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { aDate, etiqueta, fechaHora, num } from '../core/format';
import { EtiquetaPipe, FechaHoraPipe, NumPipe } from '../core/pipes';
import type { Control, Evidencia, IncidenciaResumen, TimelineItem } from '../core/types';
import { Alerta, Insignia, Modal, Vacio } from './ui';

// ---------------------------------------------------------------------------
// Gráfico de lecturas con banda del rango permitido (SVG, sin librerías)
// ---------------------------------------------------------------------------
interface Punto {
  c: Control;
  t: number;
  v: number;
  x: number;
  y: number;
  fuera: boolean;
  titulo: string;
}

@Component({
  selector: 'app-grafico',
  template: `
    @if (g(); as g) {
      <figure>
        <svg [attr.viewBox]="'0 0 ' + W + ' ' + H" class="h-auto w-full" role="img" [attr.aria-label]="'Evolución de ' + campo()">
          @if (g.banda) {
            <rect [attr.x]="PL" [attr.y]="g.banda.y" [attr.width]="W - PL - PR" [attr.height]="g.banda.h" class="fill-ok-500/10" />
          }
          @for (t of g.ticks; track t.v) {
            <line [attr.x1]="PL" [attr.x2]="W - PR" [attr.y1]="t.y" [attr.y2]="t.y" class="stroke-ink-300/30" stroke-width="1" />
            <text [attr.x]="PL - 8" [attr.y]="t.y + 4" text-anchor="end" class="fill-ink-500 text-[11px]">{{ t.texto }}</text>
          }
          @for (l of g.limites; track l) {
            <line [attr.x1]="PL" [attr.x2]="W - PR" [attr.y1]="l" [attr.y2]="l" class="stroke-ok-500" stroke-dasharray="4 4" />
          }
          <path [attr.d]="g.linea" fill="none" class="stroke-ink-800" stroke-width="2" stroke-linejoin="round" />
          @for (p of g.puntos; track p.c.id_control) {
            <circle [attr.cx]="p.x" [attr.cy]="p.y" [attr.r]="p.fuera ? 5 : 3.5" stroke-width="1.5"
              [attr.class]="p.fuera ? 'fill-alert-500 stroke-white' : 'fill-frost-500 stroke-white'">
              <title>{{ p.titulo }}</title>
            </circle>
          }
          <text [attr.x]="PL" [attr.y]="H - 8" class="fill-ink-500 text-[11px]">{{ g.inicio }}</text>
          @if (g.fin) {
            <text [attr.x]="W - PR" [attr.y]="H - 8" text-anchor="end" class="fill-ink-500 text-[11px]">{{ g.fin }}</text>
          }
        </svg>
        <figcaption class="mt-2 flex flex-wrap gap-4 text-xs text-ink-700">
          <span class="flex items-center gap-1.5"><span class="inline-block h-2.5 w-4 rounded-sm bg-ok-500/20 ring-1 ring-ok-500/50"></span> Rango permitido</span>
          <span class="flex items-center gap-1.5"><span class="size-2.5 rounded-full bg-frost-500"></span> Normal</span>
          <span class="flex items-center gap-1.5"><span class="size-2.5 rounded-full bg-alert-500"></span> Fuera de rango</span>
        </figcaption>
      </figure>
    } @else {
      <p class="py-8 text-center text-sm text-ink-500">Sin lecturas de {{ campo() }} registradas.</p>
    }`,
})
export class Grafico {
  controles = input.required<Control[]>();
  min = input<number | null>(null);
  max = input<number | null>(null);
  campo = input<'temperatura' | 'humedad'>('temperatura');
  unidad = input('°C');
  readonly W = 640;
  readonly H = 220;
  readonly PL = 44;
  readonly PR = 16;
  private readonly PT = 14;
  private readonly PB = 28;

  g = computed(() => {
    const campo = this.campo();
    const base = this.controles()
      .map((c) => ({ c, t: aDate(c.fecha_hora)?.getTime() ?? 0, v: c[campo] }))
      .filter((p): p is { c: Control; t: number; v: number } => p.v !== null && p.v !== undefined && p.t > 0)
      .sort((a, b) => a.t - b.t);
    if (!base.length) return null;
    const min = this.min();
    const max = this.max();
    const valores = base.map((p) => Number(p.v));
    let lo = Math.min(...valores, ...(min != null ? [Number(min)] : []));
    let hi = Math.max(...valores, ...(max != null ? [Number(max)] : []));
    const pad = Math.max((hi - lo) * 0.15, 1);
    lo -= pad;
    hi += pad;
    const { W, H, PL, PR, PT, PB } = this;
    const t0 = base[0].t;
    const t1 = base[base.length - 1].t;
    const x = (t: number) => (t1 === t0 ? PL + (W - PL - PR) / 2 : PL + ((t - t0) / (t1 - t0)) * (W - PL - PR));
    const y = (v: number) => PT + ((hi - v) / (hi - lo)) * (H - PT - PB);
    const puntos: Punto[] = base.map((p) => ({
      ...p,
      x: x(p.t),
      y: y(Number(p.v)),
      fuera: p.c.resultado === 'FUERA_RANGO',
      titulo: `${fechaHora(p.c.fecha_hora)} · ${num(p.v)} ${this.unidad()} · ${etiqueta(p.c.resultado)}`,
    }));
    const top = max != null ? y(Number(max)) : PT;
    const bot = min != null ? y(Number(min)) : H - PB;
    return {
      puntos,
      linea: puntos.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' '),
      ticks: Array.from({ length: 5 }, (_, i) => {
        const v = lo + ((hi - lo) * i) / 4;
        return { v, y: y(v), texto: num(v, 1) };
      }),
      limites: [min, max].filter((l): l is number => l != null).map((l) => y(Number(l))),
      banda: min != null || max != null ? { y: top, h: Math.max(bot - top, 0) } : null,
      inicio: fechaHora(base[0].c.fecha_hora),
      fin: base.length > 1 ? fechaHora(base[base.length - 1].c.fecha_hora) : null,
    };
  });
}

// ---------------------------------------------------------------------------
// Línea de tiempo de eventos (inmutable)
// ---------------------------------------------------------------------------
@Component({
  selector: 'app-linea-tiempo',
  imports: [EtiquetaPipe, FechaHoraPipe],
  template: `
    @if (items().length) {
      <ol class="relative ml-2 border-l-2 border-ice-200">
        @for (e of items(); track $index) {
          <li class="relative pb-5 pl-6 last:pb-0">
            <span class="absolute top-1 -left-[7px] size-3 rounded-full ring-4 ring-white" [class]="color(e.tipo)"></span>
            <div class="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
              <span class="text-sm font-semibold text-ink-900">{{ e.tipo | etiqueta }}</span>
              <time class="text-xs text-ink-500 tabular-nums">{{ e.fecha | fechaHora }}</time>
              <span class="text-xs text-ink-500">por {{ e.actor }}</span>
            </div>
            @if (e.descripcion) { <p class="mt-0.5 text-sm text-ink-700">{{ e.descripcion }}</p> }
          </li>
        }
      </ol>
    } @else {
      <p class="py-6 text-center text-sm text-ink-500">Sin eventos registrados.</p>
    }`,
})
export class LineaTiempo {
  items = input.required<TimelineItem[]>();
  color(tipo: string): string {
    if (tipo === 'BLOQUEO_LOTE' || tipo === 'DESCARTE_LOTE') return 'bg-alert-500';
    if (tipo === 'LIBERACION_LOTE' || tipo === 'ENTREGA' || tipo === 'LLEGADA') return 'bg-ok-500';
    return tipo === 'CONTROL' ? 'bg-frost-500' : 'bg-ink-700';
  }
}

// ---------------------------------------------------------------------------
// Confirmación con motivo (bloquear, liberar, descartar, cambiar estado…)
// ---------------------------------------------------------------------------
@Component({
  selector: 'app-confirmar-motivo',
  imports: [Modal, Alerta, FormsModule],
  template: `
    <app-modal [titulo]="titulo()" (cerrar)="cerrar.emit()">
      <form class="space-y-4" (ngSubmit)="enviar()">
        <div class="text-sm text-ink-700"><ng-content /></div>
        @if (error()) { <app-alerta>{{ error() }}</app-alerta> }
        <label class="block">
          <span class="etiqueta">{{ obligatorio() ? 'Motivo' : 'Motivo (opcional)' }}</span>
          <textarea class="campo min-h-24" name="motivo" maxlength="500" [required]="obligatorio()" [(ngModel)]="motivo"></textarea>
          <span class="mt-1 block text-xs text-ink-500">Queda registrado en el historial del lote o despacho.</span>
        </label>
        <div class="flex justify-end gap-2">
          <button type="button" class="btn btn-secundario" (click)="cerrar.emit()">Cancelar</button>
          <button type="submit" class="btn" [class]="'btn-' + variante()" [disabled]="enviando() || (obligatorio() && !motivo.trim())">
            @if (enviando()) { <span class="spinner"></span> } {{ textoBoton() }}
          </button>
        </div>
      </form>
    </app-modal>`,
})
export class ConfirmarMotivo {
  titulo = input.required<string>();
  textoBoton = input('Confirmar');
  variante = input<'primario' | 'peligro' | 'exito'>('primario');
  obligatorio = input(false);
  /** Ejecuta la acción; devuelve un mensaje de error o null si salió bien. */
  confirmar = input.required<(motivo: string) => Promise<string | null>>();
  cerrar = output<void>();
  motivo = '';
  enviando = signal(false);
  error = signal<string | null>(null);

  async enviar(): Promise<void> {
    this.enviando.set(true);
    const err = await this.confirmar()(this.motivo.trim());
    this.enviando.set(false);
    if (err) this.error.set(err);
    else this.cerrar.emit();
  }
}

// ---------------------------------------------------------------------------
// Tablas y listas reutilizables
// ---------------------------------------------------------------------------
@Component({
  selector: 'app-tabla-controles',
  imports: [RouterLink, Insignia, Vacio, FechaHoraPipe, NumPipe],
  template: `
    @if (orden().length) {
      <div class="tabla-wrap">
        <table class="tabla">
          <thead>
            <tr>
              <th>Fecha y hora</th>
              @if (contexto() !== 'lote') { <th>Lote</th> }
              @if (contexto() !== 'despacho') { <th>Despacho</th> }
              <th class="text-right">Temp.</th>
              <th class="text-right">Humedad</th>
              <th>Resultado</th>
              <th>Registró</th>
            </tr>
          </thead>
          <tbody>
            @for (c of orden(); track c.id_control) {
              <tr [class.bg-alert-50]="c.resultado === 'FUERA_RANGO'">
                <td class="whitespace-nowrap tabular-nums">{{ c.fecha_hora | fechaHora }}</td>
                @if (contexto() !== 'lote') {
                  <td><a class="font-medium hover:text-frost-600 hover:underline" [routerLink]="['/lotes', c.id_lote]">{{ c.codigo_lote }}</a></td>
                }
                @if (contexto() !== 'despacho') {
                  <td><a class="font-medium hover:text-frost-600 hover:underline" [routerLink]="['/despachos', c.id_despacho]">{{ c.codigo_despacho }}</a></td>
                }
                <td class="text-right tabular-nums">{{ c.temperatura != null ? (c.temperatura | num) + ' °C' : '—' }}</td>
                <td class="text-right tabular-nums">{{ c.humedad != null ? (c.humedad | num) + ' %' : '—' }}</td>
                <td>
                  <app-insignia [valor]="c.resultado" />
                  @if (c.motivo_desviacion) { <p class="mt-1 text-xs text-alert-600">{{ c.motivo_desviacion }}</p> }
                </td>
                <td class="text-ink-700">{{ c.username }}</td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    } @else {
      <app-vacio titulo="Sin lecturas registradas" />
    }`,
})
export class TablaControles {
  controles = input.required<Control[]>();
  /** Ficha donde se muestra la tabla: se oculta la columna redundante. */
  contexto = input<'lote' | 'despacho' | null>(null);
  orden = computed(() => [...this.controles()].sort((a, b) => (a.fecha_hora < b.fecha_hora ? 1 : -1)));
}

@Component({
  selector: 'app-lista-incidencias',
  imports: [RouterLink, Insignia, Vacio, EtiquetaPipe, FechaHoraPipe],
  template: `
    @if (items().length) {
      <ul class="divide-y divide-ink-300/20">
        @for (i of items(); track i.id_incidencia) {
          <li>
            <a [routerLink]="['/incidencias', i.id_incidencia]" class="flex flex-wrap items-start gap-3 px-5 py-3 hover:bg-ice-50">
              <span class="font-mono text-xs text-ink-500">#{{ i.id_incidencia }}</span>
              <div class="min-w-0 flex-1">
                <p class="text-sm font-medium text-ink-900">{{ i.descripcion }}</p>
                <p class="text-xs text-ink-500">
                  {{ i.tipo | etiqueta }} · {{ i.fecha_creacion | fechaHora }} · {{ i.evidencias }} evidencia{{ i.evidencias === 1 ? '' : 's' }}
                </p>
              </div>
              <div class="flex gap-1.5"><app-insignia [valor]="i.prioridad" /><app-insignia [valor]="i.estado" /></div>
            </a>
          </li>
        }
      </ul>
    } @else {
      <app-vacio titulo="Sin no conformidades registradas" />
    }`,
})
export class ListaIncidencias {
  items = input.required<IncidenciaResumen[]>();
}

@Component({
  selector: 'app-lista-evidencias',
  imports: [RouterLink, Vacio, FechaHoraPipe],
  template: `
    @if (items().length) {
      <ul class="divide-y divide-ink-300/20">
        @for (e of items(); track e.id_evidencia) {
          <li class="flex items-start gap-3 px-5 py-3">
            <span class="mt-0.5 rounded-md bg-ice-100 px-2 py-0.5 text-[11px] font-semibold text-ink-700 uppercase">{{ e.tipo }}</span>
            <div class="min-w-0 flex-1">
              @if (e.url) {
                <a [href]="e.url" target="_blank" rel="noopener noreferrer" class="text-sm font-medium text-frost-600 hover:underline">{{ e.nombre_archivo }}</a>
              } @else {
                <p class="text-sm font-medium text-ink-900">{{ e.nombre_archivo }}</p>
              }
              @if (e.descripcion) { <p class="text-sm text-ink-700">{{ e.descripcion }}</p> }
              <p class="text-xs text-ink-500">
                {{ e.fecha_creacion | fechaHora }} · {{ e.username }}
                @if (e.id_incidencia) { · <a [routerLink]="['/incidencias', e.id_incidencia]" class="hover:underline">incidencia #{{ e.id_incidencia }}</a> }
              </p>
            </div>
          </li>
        }
      </ul>
    } @else {
      <app-vacio titulo="Sin evidencias adjuntas" />
    }`,
})
export class ListaEvidencias {
  items = input.required<Evidencia[]>();
}
