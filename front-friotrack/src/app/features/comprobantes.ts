import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Api } from '../core/api';
import { Auth } from '../core/auth';
import { carga } from '../core/carga';
import { DineroPipe, FechaHoraPipe } from '../core/pipes';
import { DOCUMENTOS, TIPOS } from '../core/sunat';
import type { ComprobanteResumen, EmisorSunat, TipoComprobante } from '../core/types';
import { Alerta, Cargando, Icono, Insignia, Paginacion, Vacio } from '../shared/ui';

/** Aviso fijo cuando el backend emite en el entorno de pruebas de SUNAT. */
@Component({
  selector: 'app-aviso-prueba-sunat',
  template: `
    <div class="mb-5 flex gap-3 rounded-xl border border-warn-500/40 bg-warn-50 px-4 py-3 text-sm text-ink-800" role="note">
      <span class="mt-0.5 grid size-6 flex-none place-items-center rounded-full bg-warn-500 text-xs font-black text-white" aria-hidden="true">!</span>
      <p><b>Entorno de pruebas de SUNAT (beta).</b> Las facturas y boletas se envían a SUNAT y se validan, pero no tienen valor tributario.
        La guía de remisión se genera y firma, pero no se envía: SUNAT no ofrece entorno de pruebas para guías.</p>
    </div>`,
})
export class AvisoPruebaSunat {}

@Component({
  selector: 'app-comprobantes',
  imports: [FormsModule, RouterLink, Alerta, Cargando, Icono, Insignia, Paginacion, Vacio, FechaHoraPipe, DineroPipe, AvisoPruebaSunat],
  template: `
    <header class="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 class="text-2xl font-bold tracking-tight text-ink-900">Comprobantes</h1>
        <p class="mt-1 text-sm text-ink-700">Facturas, boletas y guías de remisión electrónicas@if (emisor.data(); as e) { de <b>{{ e.razon_social }}</b> (RUC {{ e.ruc }})}.</p>
      </div>
      @if (auth.puede('facturar')) {
        <div class="flex flex-wrap gap-2">
          <a class="btn btn-primario" routerLink="/comprobantes/nuevo/factura"><app-icono nombre="mas" clase="size-4" /> Factura</a>
          <a class="btn btn-secundario" routerLink="/comprobantes/nuevo/boleta"><app-icono nombre="mas" clase="size-4" /> Boleta</a>
          <a class="btn btn-secundario" routerLink="/comprobantes/nuevo/guia"><app-icono nombre="mas" clase="size-4" /> Guía de remisión</a>
        </div>
      }
    </header>

    @if (emisor.data()?.prueba) { <app-aviso-prueba-sunat /> }

    <div class="mb-4 flex flex-wrap gap-2" role="tablist" aria-label="Filtrar por tipo">
      @for (f of filtros; track f.valor) {
        <button role="tab" [attr.aria-selected]="tipo() === f.valor" (click)="filtrar(f.valor)" class="pestana"
          [class]="tipo() === f.valor ? 'pestana-activa' : 'pestana-inactiva'">{{ f.texto }}</button>
      }
    </div>

    <section class="tarjeta">
      <div class="border-b border-ink-300/30 p-4">
        <input class="campo sm:max-w-sm" placeholder="Buscar por número, cliente o RUC/DNI" aria-label="Buscar"
          [ngModel]="q()" (ngModelChange)="q.set($event); pagina.set(0); lista.recargar()" />
      </div>
      @if (lista.error()) { <div class="p-4"><app-alerta>{{ lista.error() }}</app-alerta></div> }
      @if (lista.cargando() && !lista.data()) { <app-cargando /> }
      @if (lista.data(); as p) {
        @if (p.content.length === 0) {
          <app-vacio titulo="Aún no hay comprobantes" [detalle]="auth.puede('facturar') ? 'Emite el primero con los botones de arriba.' : null" />
        } @else {
          <div class="tabla-wrap">
            <table class="tabla">
              <thead><tr><th>Número</th><th>Tipo</th><th>Emisión</th><th>Cliente / destinatario</th><th class="text-right">Total</th><th>SUNAT</th></tr></thead>
              <tbody>
                @for (c of p.content; track c.id_comprobante) {
                  <tr class="cursor-pointer hover:bg-ice-50" (click)="abrir(c)">
                    <td><a [routerLink]="['/comprobantes', c.id_comprobante]" (click)="$event.stopPropagation()"
                      class="font-mono font-semibold text-ink-900 hover:text-frost-600 hover:underline">{{ c.numero }}</a></td>
                    <td class="whitespace-nowrap">{{ tipos[c.tipo].corto }}</td>
                    <td class="whitespace-nowrap">{{ c.fecha_emision | fechaHora }}</td>
                    <td class="min-w-48">
                      <span class="block font-medium text-ink-900">{{ c.cliente_nombre }}</span>
                      <span class="text-xs text-ink-500">{{ documentos[c.cliente_tipo_doc] }} {{ c.cliente_num_doc }}</span>
                    </td>
                    <td class="text-right whitespace-nowrap tabular-nums">{{ c.tipo === '09' ? '—' : 'S/ ' + (c.total | dinero) }}</td>
                    <td><app-insignia [valor]="c.estado_sunat" /></td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
          <app-paginacion [pagina]="pagina()" [totalPaginas]="p.totalPages" [total]="p.totalElements" (cambiar)="pagina.set($event); lista.recargar()" />
        }
      }
    </section>`,
})
export class ComprobantesPage {
  private api = inject(Api);
  private router = inject(Router);
  auth = inject(Auth);
  tipos = TIPOS;
  documentos = DOCUMENTOS;
  filtros: { valor: TipoComprobante | ''; texto: string }[] = [
    { valor: '', texto: 'Todos' },
    { valor: '01', texto: 'Facturas' },
    { valor: '03', texto: 'Boletas' },
    { valor: '09', texto: 'Guías de remisión' },
  ];
  tipo = signal<TipoComprobante | ''>('');
  q = signal('');
  pagina = signal(0);

  emisor = carga(() => this.api.get<EmisorSunat>('/api/comprobante/emisor'));
  lista = carga(() =>
    this.api.pagina<ComprobanteResumen>('/api/comprobante', { tipo: this.tipo(), q: this.q(), page: this.pagina(), size: 15, sort: 'idComprobante,desc' }),
  );

  filtrar(t: TipoComprobante | ''): void {
    this.tipo.set(t);
    this.pagina.set(0);
    void this.lista.recargar();
  }
  abrir(c: ComprobanteResumen): void {
    void this.router.navigate(['/comprobantes', c.id_comprobante]);
  }
}
