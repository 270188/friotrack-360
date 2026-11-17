import { Component, OnInit, inject, input, output, signal } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { Api, mensajeError } from '../core/api';
import { Auth } from '../core/auth';
import { accion, carga } from '../core/carga';
import { limpiar } from '../core/format';
import { mensajeCampo, rangoValido } from '../core/validadores';
import { RangoPipe } from '../core/pipes';
import type { Producto } from '../core/types';
import { Alerta, Cargando, Icono, Insignia, Modal, Paginacion, Vacio } from '../shared/ui';

/**
 * Alta y edición de productos con un formulario reactivo: validadores por campo (obligatorio, largo, mínimo
 * y máximo) y validadores de grupo que exigen mínimo < máximo en temperatura y humedad.
 */
@Component({
  selector: 'app-form-producto',
  imports: [ReactiveFormsModule, Modal, Alerta],
  template: `
    <app-modal [titulo]="producto() ? 'Editar ' + producto()!.nombre : 'Nuevo producto'" (cerrar)="cerrar.emit()">
      <form class="grid-form" [formGroup]="form" (ngSubmit)="guardar()" novalidate>
        @if (a.error()) { <app-alerta class="col-completa">{{ a.error() }}</app-alerta> }
        <div class="col-completa block"><label class="etiqueta" for="prod-nombre">Nombre</label>
          <input id="prod-nombre" class="campo" formControlName="nombre" [attr.aria-invalid]="!!err('nombre')" />
          @if (err('nombre'); as m) { <span class="mt-1 block text-xs font-medium text-alert-600">{{ m }}</span> }</div>
        <div class="col-completa block"><label class="etiqueta" for="prod-categoria">Categoría</label>
          <input id="prod-categoria" class="campo" formControlName="categoria" />
          @if (err('categoria'); as m) { <span class="mt-1 block text-xs font-medium text-alert-600">{{ m }}</span> }</div>
        <label class="col-completa block"><span class="etiqueta">Descripción</span><textarea class="campo min-h-16" formControlName="descripcion"></textarea></label>
        <div class="block"><label class="etiqueta" for="prod-temperatura_min">Temperatura mínima (°C)</label>
          <input id="prod-temperatura_min" type="number" step="0.01" class="campo" formControlName="temperatura_min" />
          @if (err('temperatura_min'); as m) { <span class="mt-1 block text-xs font-medium text-alert-600">{{ m }}</span> }</div>
        <div class="block"><label class="etiqueta" for="prod-temperatura_max">Temperatura máxima (°C)</label>
          <input id="prod-temperatura_max" type="number" step="0.01" class="campo" formControlName="temperatura_max" />
          @if (err('temperatura_max'); as m) { <span class="mt-1 block text-xs font-medium text-alert-600">{{ m }}</span> }</div>
        @if (form.hasError('rangoTemperatura')) {
          <p class="col-completa -mt-2 text-xs font-medium text-alert-600" role="alert">La temperatura mínima debe ser menor que la máxima.</p>
        }
        <div class="block"><label class="etiqueta" for="prod-humedad_min">Humedad mínima (%)</label>
          <input id="prod-humedad_min" type="number" step="0.01" class="campo" formControlName="humedad_min" />
          @if (err('humedad_min'); as m) { <span class="mt-1 block text-xs font-medium text-alert-600">{{ m }}</span> }</div>
        <div class="block"><label class="etiqueta" for="prod-humedad_max">Humedad máxima (%)</label>
          <input id="prod-humedad_max" type="number" step="0.01" class="campo" formControlName="humedad_max" />
          @if (err('humedad_max'); as m) { <span class="mt-1 block text-xs font-medium text-alert-600">{{ m }}</span> }</div>
        @if (form.hasError('rangoHumedad')) {
          <p class="col-completa -mt-2 text-xs font-medium text-alert-600" role="alert">La humedad mínima debe ser menor que la máxima.</p>
        }
        <label class="col-completa flex items-center gap-2 text-sm text-ink-800">
          <input type="checkbox" class="size-4 accent-frost-500" formControlName="activo" /> Producto activo
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
  private fb = inject(FormBuilder);
  producto = input<Producto | null>(null);
  cerrar = output<void>();
  guardado = output<Producto>();
  a = accion();

  form = this.fb.group(
    {
      nombre: this.fb.nonNullable.control('', [Validators.required, Validators.maxLength(150)]),
      categoria: this.fb.nonNullable.control('', [Validators.maxLength(100)]),
      descripcion: this.fb.nonNullable.control(''),
      temperatura_min: this.fb.control<number | null>(null, [Validators.min(-50), Validators.max(50)]),
      temperatura_max: this.fb.control<number | null>(null, [Validators.min(-50), Validators.max(50)]),
      humedad_min: this.fb.control<number | null>(null, [Validators.min(0), Validators.max(100)]),
      humedad_max: this.fb.control<number | null>(null, [Validators.min(0), Validators.max(100)]),
      activo: this.fb.nonNullable.control(true),
    },
    {
      validators: [
        rangoValido('temperatura_min', 'temperatura_max', 'rangoTemperatura'),
        rangoValido('humedad_min', 'humedad_max', 'rangoHumedad'),
      ],
    },
  );

  ngOnInit(): void {
    const p = this.producto();
    if (p) {
      this.form.setValue({
        nombre: p.nombre,
        categoria: p.categoria ?? '',
        descripcion: p.descripcion ?? '',
        temperatura_min: p.temperatura_min,
        temperatura_max: p.temperatura_max,
        humedad_min: p.humedad_min,
        humedad_max: p.humedad_max,
        activo: p.activo,
      });
    }
  }

  err(campo: keyof typeof this.form.controls): string | null {
    return mensajeCampo(this.form.controls[campo], 'El valor');
  }

  async guardar(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    const n = (x: number | null) => (x === null || (x as unknown) === '' ? null : Number(x));
    const body = limpiar({
      nombre: v.nombre.trim(),
      categoria: v.categoria,
      descripcion: v.descripcion,
      temperatura_min: n(v.temperatura_min),
      temperatura_max: n(v.temperatura_max),
      humedad_min: n(v.humedad_min),
      humedad_max: n(v.humedad_max),
      activo: v.activo,
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
