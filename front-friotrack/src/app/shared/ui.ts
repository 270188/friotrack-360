import { Component, ElementRef, computed, input, output, viewChild, AfterViewInit } from '@angular/core';
import { etiqueta } from '../core/format';

// ---------------------------------------------------------------------------
// Iconos de trazo (24x24)
// ---------------------------------------------------------------------------
const PATHS: Record<string, string> = {
  panel: 'M4 13h6V4H4zm10 7h6V11h-6zM4 20h6v-4H4zm10-11h6V4h-6z',
  lote: 'M21 8 12 3 3 8v8l9 5 9-5zM3 8l9 5 9-5M12 13v8',
  despacho: 'M3 7h11v9H3zM14 10h4l3 3v3h-7M6.5 19a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3M17.5 19a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3',
  control: 'M14 14.8V4a2 2 0 1 0-4 0v10.8a4 4 0 1 0 4 0M12 9v8',
  incidencia: 'M12 3 2 20h20zM12 10v4M12 17v.01',
  traza: 'M5 4v16M5 7h8l2 2h4v6h-6l-2-2H5',
  producto: 'M12 2v20M4.9 6.5l14.2 11M19.1 6.5 4.9 17.5M8 3l4 3 4-3M8 21l4-3 4 3',
  usuario: 'M16 19v-1a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v1M9.5 10a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7M21 19v-1a4 4 0 0 0-3-3.9M16 3.1a3.5 3.5 0 0 1 0 6.8',
  evento: 'M12 7v5l3 2M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18',
  salir: 'M15 4h4v16h-4M10 17l5-5-5-5M15 12H3',
  menu: 'M4 6h16M4 12h16M4 18h16',
  buscar: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14M20 20l-4-4',
  mas: 'M12 5v14M5 12h14',
  cerrar: 'M6 6l12 12M18 6 6 18',
  copo: 'M12 2v20M3.3 7l17.4 10M20.7 7 3.3 17M9 4l3 2 3-2M9 20l3-2 3 2M4 10.5l.9 3.4L2 15.5M20 13.5l-.9-3.4 2.9-1.6',
};

@Component({
  selector: 'app-icono',
  template: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"
    stroke-linejoin="round" [class]="clase()" aria-hidden="true"><path [attr.d]="d()" /></svg>`,
  host: { class: 'inline-flex' },
})
export class Icono {
  nombre = input.required<string>();
  clase = input('size-5');
  d = computed(() => PATHS[this.nombre()] ?? '');
}

// ---------------------------------------------------------------------------
// Insignia de estado
// ---------------------------------------------------------------------------
export type Tono = 'neutro' | 'info' | 'ok' | 'alerta' | 'aviso' | 'oscuro';
const TONOS: Record<Tono, string> = {
  neutro: 'bg-ice-100 text-ink-700 ring-ink-300/50',
  info: 'bg-frost-500/10 text-frost-600 ring-frost-500/30',
  ok: 'bg-ok-50 text-ok-500 ring-ok-500/30',
  alerta: 'bg-alert-50 text-alert-600 ring-alert-500/30',
  aviso: 'bg-warn-50 text-[#a26f00] ring-warn-500/40',
  oscuro: 'bg-ink-900 text-white ring-ink-900',
};
const TONO_ESTADO: Record<string, Tono> = {
  DISPONIBLE: 'ok', BLOQUEADO: 'alerta', EN_TRANSITO: 'info', ENTREGADO: 'neutro', DESCARTADO: 'oscuro',
  PENDIENTE: 'aviso', PREPARACION: 'info', CANCELADO: 'oscuro',
  NORMAL: 'ok', FUERA_RANGO: 'alerta',
  ABIERTA: 'alerta', EN_PROCESO: 'aviso', RESUELTA: 'ok', CERRADA: 'neutro',
  BAJA: 'neutro', MEDIA: 'info', ALTA: 'aviso', CRITICA: 'alerta',
  ACTIVO: 'ok', INACTIVO: 'neutro',
};

@Component({
  selector: 'app-insignia',
  template: `<span class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold whitespace-nowrap ring-1 ring-inset"
    [class]="clases()">{{ texto() ?? etiqueta(valor()) }}</span>`,
  host: { class: 'inline-flex' },
})
export class Insignia {
  valor = input<string | null>(null);
  tono = input<Tono | null>(null);
  texto = input<string | null>(null);
  etiqueta = etiqueta;
  clases = computed(() => TONOS[this.tono() ?? TONO_ESTADO[this.valor() ?? ''] ?? 'neutro']);
}

// ---------------------------------------------------------------------------
// Mensajes, carga y vacío
// ---------------------------------------------------------------------------
@Component({
  selector: 'app-alerta',
  template: `<div [attr.role]="tono() === 'alerta' ? 'alert' : 'status'" class="rounded-lg border px-3.5 py-2.5 text-sm font-medium"
    [class]="clases()"><ng-content /></div>`,
  host: { class: 'block' },
})
export class Alerta {
  tono = input<'alerta' | 'ok' | 'info'>('alerta');
  clases = computed(() =>
    this.tono() === 'ok'
      ? 'border-ok-500/30 bg-ok-50 text-ok-500'
      : this.tono() === 'info'
        ? 'border-frost-500/30 bg-frost-500/5 text-ink-800'
        : 'border-alert-500/30 bg-alert-50 text-alert-600',
  );
}

@Component({
  selector: 'app-cargando',
  template: `<div class="flex items-center justify-center gap-3 py-14 text-sm text-ink-500">
    <span class="size-4 animate-spin rounded-full border-2 border-frost-500 border-r-transparent"></span>{{ texto() }}</div>`,
})
export class Cargando {
  texto = input('Cargando…');
}

@Component({
  selector: 'app-vacio',
  template: `<div class="px-6 py-12 text-center">
    <p class="text-sm font-semibold text-ink-800">{{ titulo() }}</p>
    @if (detalle()) { <p class="mt-1 text-sm text-ink-500">{{ detalle() }}</p> }
  </div>`,
})
export class Vacio {
  titulo = input.required<string>();
  detalle = input<string | null>(null);
}

// ---------------------------------------------------------------------------
// Modal accesible con <dialog>: se abre al renderizarse (usar dentro de @if)
// ---------------------------------------------------------------------------
@Component({
  selector: 'app-modal',
  template: `
    <dialog #dlg (close)="cerrar.emit()" (click)="fondo($event)" [attr.aria-label]="titulo()"
      class="m-auto w-[calc(100%-2rem)] rounded-2xl bg-white p-0 shadow-2xl backdrop:bg-ink-950/50 backdrop:backdrop-blur-[2px]"
      [class]="ancho()">
      <div class="max-h-[85vh] overflow-y-auto">
        <div class="sticky top-0 z-10 flex items-center justify-between border-b border-ink-300/30 bg-white px-5 py-4">
          <h2 class="text-base font-bold text-ink-900">{{ titulo() }}</h2>
          <button type="button" (click)="dlg.close()" class="cursor-pointer rounded-md p-1 text-ink-500 hover:bg-ice-100" aria-label="Cerrar">
            <app-icono nombre="cerrar" />
          </button>
        </div>
        <div class="px-5 py-5"><ng-content /></div>
      </div>
    </dialog>`,
  imports: [Icono],
})
export class Modal implements AfterViewInit {
  titulo = input.required<string>();
  ancho = input('max-w-lg');
  cerrar = output<void>();
  private dlg = viewChild.required<ElementRef<HTMLDialogElement>>('dlg');

  ngAfterViewInit(): void {
    const d = this.dlg().nativeElement;
    if (!d.open) d.showModal();
  }
  fondo(e: MouseEvent): void {
    if (e.target === this.dlg().nativeElement) this.dlg().nativeElement.close();
  }
}

// ---------------------------------------------------------------------------
// Paginación, KPI y barra de porcentaje
// ---------------------------------------------------------------------------
@Component({
  selector: 'app-paginacion',
  template: `
    <div class="flex items-center justify-between gap-3 px-4 py-3 text-sm text-ink-700">
      <span>{{ total() }} registro{{ total() === 1 ? '' : 's' }}</span>
      <div class="flex items-center gap-2">
        <button class="btn btn-secundario" [disabled]="pagina() <= 0" (click)="cambiar.emit(pagina() - 1)">Anterior</button>
        <span class="tabular-nums">{{ totalPaginas() === 0 ? 0 : pagina() + 1 }} / {{ totalPaginas() > 1 ? totalPaginas() : 1 }}</span>
        <button class="btn btn-secundario" [disabled]="pagina() + 1 >= totalPaginas()" (click)="cambiar.emit(pagina() + 1)">Siguiente</button>
      </div>
    </div>`,
})
export class Paginacion {
  pagina = input.required<number>();
  totalPaginas = input.required<number>();
  total = input.required<number>();
  cambiar = output<number>();
}

@Component({
  selector: 'app-kpi',
  template: `
    <section class="tarjeta p-4">
      <p class="text-xs font-semibold tracking-wide text-ink-500 uppercase">{{ etiqueta() }}</p>
      <p class="mt-1.5 text-3xl font-bold tabular-nums" [class]="color()">{{ valor() }}</p>
      @if (detalle()) { <p class="mt-1 text-xs text-ink-500">{{ detalle() }}</p> }
    </section>`,
})
export class Kpi {
  etiqueta = input.required<string>();
  valor = input.required<string | number>();
  detalle = input<string | null>(null);
  tono = input<'neutro' | 'alerta' | 'ok' | 'info'>('neutro');
  color = computed(() =>
    ({ alerta: 'text-alert-500', ok: 'text-ok-500', info: 'text-frost-600', neutro: 'text-ink-900' })[this.tono()],
  );
}

@Component({
  selector: 'app-barra-pct',
  template: `<div class="h-2 w-full overflow-hidden rounded-full bg-ice-100">
    <div class="h-full rounded-full" [class]="color()" [style.width.%]="valorAcotado()"></div></div>`,
})
export class BarraPct {
  valor = input.required<number>();
  valorAcotado = computed(() => Math.max(0, Math.min(100, this.valor())));
  color = computed(() => {
    const v = this.valorAcotado();
    return v >= 95 ? 'bg-ok-500' : v >= 85 ? 'bg-warn-500' : 'bg-alert-500';
  });
}

export const UI = [Icono, Insignia, Alerta, Cargando, Vacio, Modal, Paginacion, Kpi, BarraPct] as const;
