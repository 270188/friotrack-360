import { Component, OnInit, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Api, mensajeError } from '../core/api';
import { Auth } from '../core/auth';
import { accion, carga } from '../core/carga';
import { limpiar, numOrNull } from '../core/format';
import { RangoPipe } from '../core/pipes';
import type { Producto } from '../core/types';
import { Alerta, Cargando, Icono, Insignia, Modal, Paginacion, Vacio } from '../shared/ui';

@Component({
  selector: 'app-form-producto',
  imports: [FormsModule, Modal, Alerta],
  template: `
    <app-modal [titulo]="producto() ? 'Editar ' + producto()!.nombre : 'Nuevo producto'" (cerrar)="cerrar.emit()">
      <form class="grid-form" (ngSubmit)="guardar()">
        @if (a.error()) { <app-alerta class="col-completa">{{ a.error() }}</app-alerta> }
        <label class="col-completa block"><span class="etiqueta">Nombre</span><input class="campo" name="nombre" required maxlength="150" [(ngModel)]="f.nombre" /></label>
        <label class="col-completa block"><span class="etiqueta">Categoría</span><input class="campo" name="categoria" maxlength="100" [(ngModel)]="f.categoria" /></label>
        <label class="col-completa block"><span class="etiqueta">Descripción</span><textarea class="campo min-h-16" name="desc" [(ngModel)]="f.descripcion"></textarea></label>
        <label class="block"><span class="etiqueta">Temperatura mínima (°C)</span><input type="number" step="0.01" min="-50" max="50" class="campo" name="tmin" [(ngModel)]="f.temperatura_min" /></label>
        <label class="block"><span class="etiqueta">Temperatura máxima (°C)</span><input type="number" step="0.01" min="-50" max="50" class="campo" name="tmax" [(ngModel)]="f.temperatura_max" /></label>
        <label class="block"><span class="etiqueta">Humedad mínima (%)</span><input type="number" step="0.01" min="0" max="100" class="campo" name="hmin" [(ngModel)]="f.humedad_min" /></label>
        <label class="block"><span class="etiqueta">Humedad máxima (%)</span><input type="number" step="0.01" min="0" max="100" class="campo" name="hmax" [(ngModel)]="f.humedad_max" /></label>
        <label class="col-completa flex items-center gap-2 text-sm text-ink-800">
          <input type="checkbox" class="size-4 accent-frost-500" name="activo" [(ngModel)]="f.activo" /> Producto activo
        </label>
        <div class="acciones-form">
          <button type="button" class="btn btn-secundario" (click)="cerrar.emit()">Cancelar</button>
          <button type="submit" class="btn btn-primario" [disabled]="a.enviando()">@if (a.enviando()) { <span class="spinner"></span> } Guardar</button>
        </div>
      </form>
    </app-modal>`,
})
export class FormProducto implements OnInit {
  private api = inject(Api);
  producto = input<Producto | null>(null);
  cerrar = output<void>();
  guardado = output<Producto>();
  a = accion();
  f = {
    nombre: '',
    categoria: '',
    descripcion: '',
    temperatura_min: '' as string | number,
    temperatura_max: '' as string | number,
    humedad_min: '' as string | number,
    humedad_max: '' as string | number,
    activo: true,
  };

  ngOnInit(): void {
    const p = this.producto();
    if (p) {
      const s = (v: number | null) => (v == null ? '' : v);
      this.f = {
        nombre: p.nombre,
        categoria: p.categoria ?? '',
        descripcion: p.descripcion ?? '',
        temperatura_min: s(p.temperatura_min),
        temperatura_max: s(p.temperatura_max),
        humedad_min: s(p.humedad_min),
        humedad_max: s(p.humedad_max),
        activo: p.activo,
      };
    }
  }

  async guardar(): Promise<void> {
    const n = (v: string | number | null) => numOrNull(v == null ? '' : String(v));
    const body = limpiar({
      nombre: this.f.nombre.trim(),
      categoria: this.f.categoria,
      descripcion: this.f.descripcion,
      temperatura_min: n(this.f.temperatura_min),
      temperatura_max: n(this.f.temperatura_max),
      humedad_min: n(this.f.humedad_min),
      humedad_max: n(this.f.humedad_max),
      activo: this.f.activo,
    });
    const p = this.producto();
    const r = await this.a.ejecutar(() =>
      p ? this.api.put<Producto>(`/api/producto/${p.id_producto}`, body) : this.api.post<Producto>('/api/producto', body),
    );
    if (r) this.guardado.emit(r);
  }
}

@Component({
  selector: 'app-productos',
  imports: [FormsModule, Alerta, Cargando, Icono, Insignia, Paginacion, Vacio, FormProducto, RangoPipe],
  template: `
    <header class="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 class="text-2xl font-bold tracking-tight text-ink-900">Productos y reglas de control</h1>
        <p class="mt-1 text-sm text-ink-700">Los umbrales de temperatura y humedad se configuran por producto: el sistema no los tiene codificados.</p>
      </div>
      @if (admin) { <button class="btn btn-primario" (click)="form.set('nuevo')"><app-icono nombre="mas" clase="size-4" /> Nuevo producto</button> }
    </header>
    @if (aviso(); as av) { <app-alerta class="mb-4" [tono]="av.t">{{ av.m }}</app-alerta> }

    <section class="tarjeta">
      <div class="grid gap-3 border-b border-ink-300/30 p-4 sm:grid-cols-[1fr_200px]">
        <input class="campo" placeholder="Buscar por nombre o categoría" aria-label="Buscar" [ngModel]="q()" (ngModelChange)="filtrar(q, $event)" />
        <select class="campo" aria-label="Estado" [ngModel]="activo()" (ngModelChange)="filtrar(activo, $event)">
          <option value="true">Activos</option><option value="false">Inactivos</option><option value="">Todos</option>
        </select>
      </div>
      @if (lista.error()) { <div class="p-4"><app-alerta>{{ lista.error() }}</app-alerta></div> }
      @if (lista.cargando() && !lista.data()) { <app-cargando /> }
      @if (lista.data(); as p) {
        @if (p.content.length === 0) {
          <app-vacio titulo="No hay productos" />
        } @else {
          <div class="tabla-wrap">
            <table class="tabla">
              <thead><tr><th>Producto</th><th>Categoría</th><th>Temperatura</th><th>Humedad</th><th>Estado</th>@if (admin) { <th></th> }</tr></thead>
              <tbody>
                @for (x of p.content; track x.id_producto) {
                  <tr class="hover:bg-ice-50">
                    <td><p class="font-semibold text-ink-900">{{ x.nombre }}</p>@if (x.descripcion) { <p class="line-clamp-1 text-xs text-ink-500">{{ x.descripcion }}</p> }</td>
                    <td>{{ x.categoria ?? '—' }}</td>
                    <td class="whitespace-nowrap tabular-nums">{{ x.temperatura_min | rango: x.temperatura_max : '°C' }}</td>
                    <td class="whitespace-nowrap tabular-nums">{{ x.humedad_min | rango: x.humedad_max : '%' }}</td>
                    <td><app-insignia [valor]="x.activo ? 'ACTIVO' : 'INACTIVO'" /></td>
                    @if (admin) {
                      <td class="text-right whitespace-nowrap">
                        <button class="btn btn-fantasma btn-sm" (click)="form.set(x)">Editar</button>
                        @if (x.activo) { <button class="btn btn-fantasma btn-sm" (click)="desactivar(x)">Desactivar</button> }
                      </td>
                    }
                  </tr>
                }
              </tbody>
            </table>
          </div>
          <app-paginacion [pagina]="pagina()" [totalPaginas]="p.totalPages" [total]="p.totalElements" (cambiar)="pagina.set($event); lista.recargar()" />
        }
      }
    </section>

    @if (form(); as fm) {
      <app-form-producto [producto]="fm === 'nuevo' ? null : fm" (cerrar)="form.set(null)" (guardado)="guardado($event)" />
    }`,
})
export class ProductosPage {
  private api = inject(Api);
  admin = inject(Auth).puede('productos');
  q = signal('');
  activo = signal('true');
  pagina = signal(0);
  form = signal<Producto | 'nuevo' | null>(null);
  aviso = signal<{ t: 'ok' | 'alerta'; m: string } | null>(null);
  lista = carga(() => this.api.pagina<Producto>('/api/producto', { q: this.q(), activo: this.activo(), page: this.pagina(), size: 15, sort: 'nombre,asc' }));

  filtrar(s: { set: (v: string) => void }, v: string): void {
    s.set(v);
    this.pagina.set(0);
    void this.lista.recargar();
  }
  guardado(p: Producto): void {
    this.form.set(null);
    this.aviso.set({ t: 'ok', m: `Producto "${p.nombre}" guardado.` });
    void this.lista.recargar();
  }
  async desactivar(p: Producto): Promise<void> {
    try {
      await this.api.del(`/api/producto/${p.id_producto}`);
      this.aviso.set({ t: 'ok', m: `Producto "${p.nombre}" desactivado.` });
      void this.lista.recargar();
    } catch (e) {
      this.aviso.set({ t: 'alerta', m: mensajeError(e) });
    }
  }
}
