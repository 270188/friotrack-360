import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Api } from '../core/api';
import { Auth } from '../core/auth';
import { carga } from '../core/carga';
import { EtiquetaPipe, FechaPipe, NumPipe } from '../core/pipes';
import { ESTADOS_LOTE, type Lote, type Producto } from '../core/types';
import { FormLote } from '../shared/formularios';
import { Alerta, Cargando, Icono, Insignia, Paginacion, Vacio } from '../shared/ui';

@Component({
  selector: 'app-lotes',
  imports: [FormsModule, RouterLink, Alerta, Cargando, Icono, Insignia, Paginacion, Vacio, FormLote, EtiquetaPipe, FechaPipe, NumPipe],
  template: `
    <header class="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 class="text-2xl font-bold tracking-tight text-ink-900">Lotes</h1>
        <p class="mt-1 text-sm text-ink-700">Lotes de productos perecibles y su estado en el ciclo de vida.</p>
      </div>
      @if (auth.puede('escribir')) {
        <button class="btn btn-primario" (click)="nuevo.set(true)"><app-icono nombre="mas" clase="size-4" /> Nuevo lote</button>
      }
    </header>

    <section class="tarjeta">
      <div class="grid gap-3 border-b border-ink-300/30 p-4 sm:grid-cols-3">
        <input class="campo" placeholder="Buscar por código de lote" aria-label="Buscar" [ngModel]="q()" (ngModelChange)="filtrar(q, $event)" />
        <select class="campo" aria-label="Estado" [ngModel]="estado()" (ngModelChange)="filtrar(estado, $event)">
          <option value="">Todos los estados</option>
          @for (e of estados; track e) { <option [value]="e">{{ e | etiqueta }}</option> }
        </select>
        <select class="campo" aria-label="Producto" [ngModel]="idProducto()" (ngModelChange)="filtrar(idProducto, $event)">
          <option value="">Todos los productos</option>
          @for (p of productos.data() ?? []; track p.id_producto) { <option [value]="'' + p.id_producto">{{ p.nombre }}</option> }
        </select>
      </div>

      @if (lista.error()) { <div class="p-4"><app-alerta>{{ lista.error() }}</app-alerta></div> }
      @if (lista.cargando() && !lista.data()) { <app-cargando /> }
      @if (lista.data(); as p) {
        @if (p.content.length === 0) {
          <app-vacio titulo="No hay lotes que coincidan" />
        } @else {
          <div class="tabla-wrap">
            <table class="tabla">
              <thead><tr><th>Código</th><th>Producto</th><th class="text-right">Cantidad</th><th>Producción</th><th>Vencimiento</th><th>Estado</th></tr></thead>
              <tbody>
                @for (l of p.content; track l.id_lote) {
                  <tr class="hover:bg-ice-50">
                    <td><a [routerLink]="['/lotes', l.id_lote]" class="font-semibold text-ink-900 hover:text-frost-600 hover:underline">{{ l.codigo_lote }}</a></td>
                    <td>{{ l.producto.nombre }}</td>
                    <td class="text-right tabular-nums">{{ l.cantidad | num: 3 }} {{ l.unidad }}</td>
                    <td>{{ l.fecha_produccion | fecha }}</td>
                    <td>
                      <span [class]="l.vencido ? 'font-semibold text-alert-500' : ''">{{ l.fecha_vencimiento | fecha }}</span>
                      @if (l.vencido) { <app-insignia class="ml-2" tono="alerta" texto="Vencido" /> }
                    </td>
                    <td><app-insignia [valor]="l.estado" /></td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
          <app-paginacion [pagina]="pagina()" [totalPaginas]="p.totalPages" [total]="p.totalElements" (cambiar)="irA($event)" />
        }
      }
    </section>

    @if (nuevo()) {
      <app-form-lote [productos]="productos.data() ?? []" (cerrar)="nuevo.set(false)" (guardado)="nuevo.set(false); lista.recargar()" />
    }`,
})
export class LotesPage {
  private api = inject(Api);
  auth = inject(Auth);
  estados = ESTADOS_LOTE;
  q = signal('');
  estado = signal('');
  idProducto = signal('');
  pagina = signal(0);
  nuevo = signal(false);

  productos = carga(() => this.api.get<Producto[]>('/api/producto/activos'));
  lista = carga(() =>
    this.api.pagina<Lote>('/api/lote', {
      q: this.q(),
      estado: this.estado(),
      idProducto: this.idProducto(),
      page: this.pagina(),
      size: 15,
      sort: 'idLote,desc',
    }),
  );

  filtrar(s: { set: (v: string) => void }, v: string): void {
    s.set(v);
    this.pagina.set(0);
    void this.lista.recargar();
  }
  irA(p: number): void {
    this.pagina.set(p);
    void this.lista.recargar();
  }
}
