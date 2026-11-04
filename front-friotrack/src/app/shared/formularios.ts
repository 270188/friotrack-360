import { Component, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Api } from '../core/api';
import { accion, carga } from '../core/carga';
import { aDate, aInputFechaHora, limpiar, numOrNull } from '../core/format';
import { EtiquetaPipe } from '../core/pipes';
import {
  PRIORIDADES,
  TIPOS_INCIDENCIA,
  type Control,
  type Despacho,
  type DespachoItem,
  type Incidencia,
  type Lote,
  type Producto,
  type Usuario,
} from '../core/types';
import { Alerta, Modal } from './ui';

// ---------------------------------------------------------------------------
// Lote: registro y edición
// ---------------------------------------------------------------------------
@Component({
  selector: 'app-form-lote',
  imports: [Modal, Alerta, FormsModule],
  template: `
    <app-modal [titulo]="lote() ? 'Editar lote ' + lote()!.codigo_lote : 'Nuevo lote'" (cerrar)="cerrar.emit()">
      <form class="grid-form" (ngSubmit)="guardar()">
        @if (a.error()) { <app-alerta class="col-completa">{{ a.error() }}</app-alerta> }
        <label class="col-completa block"><span class="etiqueta">Producto</span>
          <select class="campo" name="producto" required [disabled]="!!lote()" [(ngModel)]="f.id_producto">
            <option value="">Seleccione…</option>
            @for (p of productos(); track p.id_producto) { <option [value]="'' + p.id_producto">{{ p.nombre }}</option> }
          </select>
        </label>
        <label class="col-completa block"><span class="etiqueta">Código de lote</span>
          <input class="campo" name="codigo" required maxlength="80" placeholder="LOT-2026-0001" [disabled]="!!lote()" [(ngModel)]="f.codigo_lote" />
        </label>
        <label class="block"><span class="etiqueta">Fecha de producción</span>
          <input type="date" class="campo" name="fprod" [(ngModel)]="f.fecha_produccion" />
        </label>
        <label class="block"><span class="etiqueta">Fecha de vencimiento</span>
          <input type="date" class="campo" name="fvenc" [(ngModel)]="f.fecha_vencimiento" />
        </label>
        <label class="block"><span class="etiqueta">Cantidad</span>
          <input type="number" step="0.001" min="0" class="campo" name="cantidad" required [(ngModel)]="f.cantidad" />
        </label>
        <label class="block"><span class="etiqueta">Unidad</span>
          <input class="campo" name="unidad" maxlength="30" [(ngModel)]="f.unidad" />
        </label>
        <div class="acciones-form">
          <button type="button" class="btn btn-secundario" (click)="cerrar.emit()">Cancelar</button>
          <button type="submit" class="btn btn-primario" [disabled]="a.enviando()">
            @if (a.enviando()) { <span class="spinner"></span> } {{ lote() ? 'Guardar cambios' : 'Registrar lote' }}
          </button>
        </div>
      </form>
    </app-modal>`,
})
export class FormLote implements OnInit {
  private api = inject(Api);
  productos = input.required<Producto[]>();
  lote = input<Pick<Lote, 'id_lote' | 'codigo_lote' | 'producto' | 'fecha_produccion' | 'fecha_vencimiento' | 'cantidad' | 'unidad'> | null>(null);
  cerrar = output<void>();
  guardado = output<Lote>();
  a = accion();
  f = { id_producto: '', codigo_lote: '', fecha_produccion: '', fecha_vencimiento: '', cantidad: '' as string | number, unidad: 'kg' };

  ngOnInit(): void {
    const l = this.lote();
    if (l) {
      this.f = {
        id_producto: String(l.producto.id_producto),
        codigo_lote: l.codigo_lote,
        fecha_produccion: l.fecha_produccion ?? '',
        fecha_vencimiento: l.fecha_vencimiento ?? '',
        cantidad: l.cantidad,
        unidad: l.unidad ?? '',
      };
    }
  }

  async guardar(): Promise<void> {
    const l = this.lote();
    const comun = {
      fecha_produccion: this.f.fecha_produccion,
      fecha_vencimiento: this.f.fecha_vencimiento,
      cantidad: Number(this.f.cantidad),
      unidad: this.f.unidad,
    };
    const r = await this.a.ejecutar(() =>
      l
        ? this.api.put<Lote>(`/api/lote/${l.id_lote}`, limpiar(comun))
        : this.api.post<Lote>('/api/lote', limpiar({ id_producto: Number(this.f.id_producto), codigo_lote: this.f.codigo_lote.trim(), ...comun })),
    );
    if (r) this.guardado.emit(r);
  }
}

// ---------------------------------------------------------------------------
// Despacho: registro y edición
// ---------------------------------------------------------------------------
@Component({
  selector: 'app-form-despacho',
  imports: [Modal, Alerta, FormsModule],
  template: `
    <app-modal [titulo]="despacho() ? 'Editar despacho ' + despacho()!.codigo : 'Nuevo despacho'" ancho="max-w-2xl" (cerrar)="cerrar.emit()">
      <form class="grid-form" (ngSubmit)="guardar()">
        @if (a.error()) { <app-alerta class="col-completa">{{ a.error() }}</app-alerta> }
        <label class="block"><span class="etiqueta">Código del despacho</span>
          <input class="campo" name="codigo" maxlength="80" placeholder="DSP-2026-0001" [required]="!despacho()" [disabled]="!!despacho()" [(ngModel)]="f.codigo" />
        </label>
        <label class="block"><span class="etiqueta">Fecha programada</span>
          <input type="datetime-local" class="campo" name="fprog" [(ngModel)]="f.fecha_programada" />
        </label>
        <label class="block"><span class="etiqueta">Destino</span>
          <input class="campo" name="destino" required maxlength="150" [(ngModel)]="f.destino" />
        </label>
        <label class="block"><span class="etiqueta">Dirección de destino</span>
          <input class="campo" name="direccion" maxlength="255" [(ngModel)]="f.direccion_destino" />
        </label>
        <label class="block"><span class="etiqueta">Contacto en destino</span>
          <input class="campo" name="contacto" maxlength="150" [(ngModel)]="f.contacto_destino" />
        </label>
        <label class="block"><span class="etiqueta">Transportista</span>
          <input class="campo" name="transportista" maxlength="150" [(ngModel)]="f.transportista" />
        </label>
        <label class="block"><span class="etiqueta">Vehículo</span>
          <input class="campo" name="vehiculo" maxlength="100" [(ngModel)]="f.vehiculo" />
        </label>
        <label class="block"><span class="etiqueta">Placa</span>
          <input class="campo" name="placa" maxlength="20" [(ngModel)]="f.placa" />
        </label>
        <label class="col-completa block"><span class="etiqueta">Observación</span>
          <textarea class="campo min-h-20" name="obs" [(ngModel)]="f.observacion"></textarea>
        </label>
        <div class="acciones-form">
          <button type="button" class="btn btn-secundario" (click)="cerrar.emit()">Cancelar</button>
          <button type="submit" class="btn btn-primario" [disabled]="a.enviando()">
            @if (a.enviando()) { <span class="spinner"></span> } {{ despacho() ? 'Guardar cambios' : 'Crear despacho' }}
          </button>
        </div>
      </form>
    </app-modal>`,
})
export class FormDespacho implements OnInit {
  private api = inject(Api);
  despacho = input<Despacho | null>(null);
  cerrar = output<void>();
  guardado = output<Despacho>();
  a = accion();
  f = { codigo: '', transportista: '', vehiculo: '', placa: '', destino: '', direccion_destino: '', contacto_destino: '', fecha_programada: '', observacion: '' };

  ngOnInit(): void {
    const d = this.despacho();
    if (d) {
      const prog = aDate(d.fecha_programada);
      this.f = {
        codigo: d.codigo,
        transportista: d.transportista ?? '',
        vehiculo: d.vehiculo ?? '',
        placa: d.placa ?? '',
        destino: d.destino,
        direccion_destino: d.direccion_destino ?? '',
        contacto_destino: d.contacto_destino ?? '',
        fecha_programada: prog ? aInputFechaHora(prog) : '',
        observacion: d.observacion ?? '',
      };
    }
  }

  async guardar(): Promise<void> {
    const { codigo, ...resto } = this.f;
    const d = this.despacho();
    const r = await this.a.ejecutar(() =>
      d
        ? this.api.put<Despacho>(`/api/despacho/${d.id_despacho}`, limpiar(resto))
        : this.api.post<Despacho>('/api/despacho', limpiar({ codigo: codigo.trim(), ...resto })),
    );
    if (r) this.guardado.emit(r);
  }
}

// ---------------------------------------------------------------------------
// Lectura de control. El backend evalúa la lectura contra el rango del producto
// y, si está fuera de rango, abre una incidencia automáticamente.
// ---------------------------------------------------------------------------
@Component({
  selector: 'app-form-control',
  imports: [Modal, Alerta, FormsModule],
  template: `
    @if (resultado(); as r) {
      <app-modal titulo="Lectura registrada" (cerrar)="guardado.emit(r)">
        <div class="space-y-4">
          @if (r.resultado === 'FUERA_RANGO') {
            <app-alerta>Lectura FUERA DE RANGO: {{ r.motivo_desviacion }}. Se abrió una incidencia automáticamente.</app-alerta>
          } @else {
            <app-alerta tono="ok">Lectura dentro del rango permitido.</app-alerta>
          }
          <div class="flex justify-end gap-2">
            <button class="btn btn-secundario" (click)="otra()">Registrar otra</button>
            <button class="btn btn-primario" (click)="guardado.emit(r)">Listo</button>
          </div>
        </div>
      </app-modal>
    } @else {
      <app-modal [titulo]="despacho() ? 'Registrar lectura · ' + despacho()!.codigo : 'Registrar lectura'" (cerrar)="cerrar.emit()">
        <form class="grid-form" (ngSubmit)="guardar()">
          @if (a.error()) { <app-alerta class="col-completa">{{ a.error() }}</app-alerta> }
          @if (!despacho()) {
            <label class="col-completa block"><span class="etiqueta">Despacho</span>
              <select class="campo" name="despacho" required [ngModel]="idDespacho()" (ngModelChange)="elegirDespacho($event)">
                <option value="">Seleccione un despacho activo…</option>
                @for (d of activos.data() ?? []; track d.id_despacho) {
                  <option [value]="'' + d.id_despacho">{{ d.codigo }} · {{ d.destino }} ({{ d.estado }})</option>
                }
              </select>
            </label>
          }
          <label class="col-completa block"><span class="etiqueta">Lote</span>
            <select class="campo" name="lote" required [disabled]="!idDespacho()" [(ngModel)]="f.id_lote">
              <option value="">{{ idDespacho() && lotes.data()?.length === 0 ? 'El despacho no tiene lotes' : 'Seleccione…' }}</option>
              @for (i of lotes.data() ?? []; track i.id_despacho_lote) {
                <option [value]="'' + i.lote.id_lote">{{ i.lote.codigo_lote }} · {{ i.lote.producto }}</option>
              }
            </select>
          </label>
          <label class="block"><span class="etiqueta">Temperatura (°C)</span>
            <input type="number" step="0.01" min="-50" max="50" class="campo" name="temp" [(ngModel)]="f.temperatura" />
          </label>
          <label class="block"><span class="etiqueta">Humedad (%)</span>
            <input type="number" step="0.01" min="0" max="100" class="campo" name="hum" [(ngModel)]="f.humedad" />
          </label>
          <label class="col-completa block"><span class="etiqueta">Fecha y hora</span>
            <input type="datetime-local" class="campo" name="fecha" [(ngModel)]="f.fecha_hora" />
          </label>
          <label class="col-completa block"><span class="etiqueta">Observación</span>
            <textarea class="campo min-h-16" name="obs" maxlength="1000" [(ngModel)]="f.observacion"></textarea>
          </label>
          <div class="acciones-form">
            <button type="button" class="btn btn-secundario" (click)="cerrar.emit()">Cancelar</button>
            <button type="submit" class="btn btn-primario" [disabled]="a.enviando() || (f.temperatura === '' && f.humedad === '')">
              @if (a.enviando()) { <span class="spinner"></span> } Registrar lectura
            </button>
          </div>
        </form>
      </app-modal>
    }`,
})
export class FormControl implements OnInit {
  private api = inject(Api);
  despacho = input<Pick<Despacho, 'id_despacho' | 'codigo'> | null>(null);
  cerrar = output<void>();
  guardado = output<Control>();
  a = accion();
  idDespacho = signal('');
  resultado = signal<Control | null>(null);
  f = { id_lote: '', fecha_hora: aInputFechaHora(), temperatura: '' as string | number, humedad: '' as string | number, observacion: '' };

  activos = carga(
    async () => {
      const [p, pr, t] = await Promise.all(
        ['PENDIENTE', 'PREPARACION', 'EN_TRANSITO'].map((e) => this.api.get<Despacho[]>(`/api/despacho/estado/${e}`)),
      );
      return [...t, ...pr, ...p];
    },
    { inmediato: false },
  );
  lotes = carga(() => this.api.get<DespachoItem[]>(`/api/despacho/${this.idDespacho()}/lotes`), { inmediato: false });

  ngOnInit(): void {
    const d = this.despacho();
    if (d) {
      this.idDespacho.set(String(d.id_despacho));
      void this.lotes.recargar();
    } else {
      void this.activos.recargar();
    }
  }

  elegirDespacho(id: string): void {
    this.idDespacho.set(id);
    this.f.id_lote = '';
    if (id) void this.lotes.recargar();
  }

  otra(): void {
    this.f = { ...this.f, temperatura: '', humedad: '', observacion: '', fecha_hora: aInputFechaHora() };
    this.resultado.set(null);
  }

  async guardar(): Promise<void> {
    const r = await this.a.ejecutar(() =>
      this.api.post<Control>('/api/control', {
        id_despacho: Number(this.idDespacho()),
        id_lote: Number(this.f.id_lote),
        fecha_hora: this.f.fecha_hora || null,
        temperatura: numOrNull(String(this.f.temperatura ?? '')),
        humedad: numOrNull(String(this.f.humedad ?? '')),
        observacion: this.f.observacion.trim() || null,
      }),
    );
    if (r) this.resultado.set(r);
  }
}

// ---------------------------------------------------------------------------
// Registro manual de una no conformidad sobre un lote
// ---------------------------------------------------------------------------
@Component({
  selector: 'app-form-incidencia',
  imports: [Modal, Alerta, FormsModule, EtiquetaPipe],
  template: `
    <app-modal [titulo]="'Registrar no conformidad · Lote ' + codigoLote()" (cerrar)="cerrar.emit()">
      <form class="grid-form" (ngSubmit)="guardar()">
        @if (a.error()) { <app-alerta class="col-completa">{{ a.error() }}</app-alerta> }
        <label class="block"><span class="etiqueta">Tipo</span>
          <select class="campo" name="tipo" [(ngModel)]="f.tipo">
            @for (t of tipos; track t) { <option [value]="t">{{ t | etiqueta }}</option> }
          </select>
        </label>
        <label class="block"><span class="etiqueta">Prioridad</span>
          <select class="campo" name="prioridad" [(ngModel)]="f.prioridad">
            @for (p of prioridades; track p) { <option [value]="p">{{ p | etiqueta }}</option> }
          </select>
        </label>
        <label class="col-completa block"><span class="etiqueta">Descripción</span>
          <textarea class="campo min-h-24" name="desc" required maxlength="4000" [(ngModel)]="f.descripcion"></textarea>
        </label>
        <label class="col-completa block"><span class="etiqueta">Responsable</span>
          <select class="campo" name="resp" [(ngModel)]="f.id_responsable">
            <option value="">Yo</option>
            @for (u of responsables(); track u.id_usuario) {
              <option [value]="'' + u.id_usuario">{{ u.nombre }} {{ u.apellido }} ({{ u.username }})</option>
            }
          </select>
          <span class="mt-1 block text-xs text-ink-500">Si no se elige, queda asignada a quien la registra.</span>
        </label>
        <div class="acciones-form">
          <button type="button" class="btn btn-secundario" (click)="cerrar.emit()">Cancelar</button>
          <button type="submit" class="btn btn-primario" [disabled]="a.enviando()">
            @if (a.enviando()) { <span class="spinner"></span> } Registrar
          </button>
        </div>
      </form>
    </app-modal>`,
})
export class FormIncidencia {
  private api = inject(Api);
  idLote = input.required<number>();
  codigoLote = input.required<string>();
  idDespacho = input<number | null>(null);
  cerrar = output<void>();
  guardado = output<Incidencia>();
  a = accion();
  tipos = TIPOS_INCIDENCIA;
  prioridades = PRIORIDADES;
  f = { tipo: 'CALIDAD', prioridad: 'MEDIA', descripcion: '', id_responsable: '' };
  usuarios = carga(() => this.api.get<Usuario[]>('/api/usuario/activos'));
  responsables = computed(() => (this.usuarios.data() ?? []).filter((u) => u.rol === 'CALIDAD' || u.rol === 'ADMIN'));

  async guardar(): Promise<void> {
    const r = await this.a.ejecutar(() =>
      this.api.post<Incidencia>('/api/incidencia', {
        id_lote: this.idLote(),
        id_despacho: this.idDespacho(),
        id_control: null,
        tipo: this.f.tipo,
        prioridad: this.f.prioridad,
        descripcion: this.f.descripcion.trim(),
        id_responsable: this.f.id_responsable ? Number(this.f.id_responsable) : null,
      }),
    );
    if (r) this.guardado.emit(r);
  }
}
