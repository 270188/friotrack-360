import { Component, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Api, mensajeError } from '../core/api';
import { Auth } from '../core/auth';
import { accion, carga } from '../core/carga';
import { etiqueta } from '../core/format';
import { EtiquetaPipe, FechaHoraPipe, NumPipe } from '../core/pipes';
import type { Despacho, DespachoItem, EstadoDespacho, Lote, TrazabilidadDespacho } from '../core/types';
import { ConfirmarMotivo, LineaTiempo, ListaEvidencias, ListaIncidencias, TablaControles } from '../shared/dominio';
import { FormControl, FormDespacho } from '../shared/formularios';
import { Alerta, Cargando, Insignia, Modal, Vacio } from '../shared/ui';

const TRANSICIONES: Record<EstadoDespacho, EstadoDespacho[]> = {
  PENDIENTE: ['PREPARACION', 'EN_TRANSITO', 'CANCELADO'],
  PREPARACION: ['EN_TRANSITO', 'CANCELADO'],
  EN_TRANSITO: ['ENTREGADO', 'CANCELADO'],
  ENTREGADO: [],
  CANCELADO: [],
};
const PASOS: EstadoDespacho[] = ['PENDIENTE', 'PREPARACION', 'EN_TRANSITO', 'ENTREGADO'];
const TEXTO: Record<EstadoDespacho, string> = {
  PENDIENTE: 'Volver a pendiente',
  PREPARACION: 'Pasar a preparación',
  EN_TRANSITO: 'Registrar salida',
  ENTREGADO: 'Registrar entrega',
  CANCELADO: 'Cancelar despacho',
};

@Component({
  selector: 'app-agregar-lote',
  imports: [FormsModule, Modal, Alerta, NumPipe],
  template: `
    <app-modal titulo="Agregar lote al despacho" (cerrar)="cerrar.emit()">
      <form class="space-y-4" (ngSubmit)="guardar()">
        @if (a.error()) { <app-alerta>{{ a.error() }}</app-alerta> }
        <app-alerta tono="info">Solo se listan lotes disponibles: los bloqueados no pueden despacharse (RB-01).</app-alerta>
        <label class="block"><span class="etiqueta">Lote</span>
          <select class="campo" name="lote" required [ngModel]="idLote()" (ngModelChange)="elegir($event)">
            <option value="">{{ disponibles.cargando() ? 'Cargando…' : opciones().length ? 'Seleccione…' : 'No hay lotes disponibles' }}</option>
            @for (l of opciones(); track l.id_lote) {
              <option [value]="'' + l.id_lote">{{ l.codigo_lote }} · {{ l.producto.nombre }} · {{ l.cantidad | num: 3 }} {{ l.unidad }}</option>
            }
          </select>
        </label>
        <label class="block"><span class="etiqueta">Cantidad a enviar</span>
          <input type="number" step="0.001" min="0.001" class="campo" name="cantidad" required [attr.max]="elegido()?.cantidad" [(ngModel)]="cantidad" />
          @if (elegido(); as l) { <span class="mt-1 block text-xs text-ink-500">Máximo disponible: {{ l.cantidad | num: 3 }} {{ l.unidad }}</span> }
        </label>
        <div class="flex justify-end gap-2">
          <button type="button" class="btn btn-secundario" (click)="cerrar.emit()">Cancelar</button>
          <button type="submit" class="btn btn-primario" [disabled]="a.enviando()">@if (a.enviando()) { <span class="spinner"></span> } Agregar</button>
        </div>
      </form>
    </app-modal>`,
})
export class AgregarLote {
  private api = inject(Api);
  idDespacho = input.required<number>();
  yaIncluidos = input<number[]>([]);
  cerrar = output<void>();
  guardado = output<string>();
  a = accion();
  idLote = signal('');
  cantidad: number | string = '';
  disponibles = carga(() => this.api.get<Lote[]>('/api/lote/estado/DISPONIBLE'));
  opciones = computed(() => (this.disponibles.data() ?? []).filter((l) => !this.yaIncluidos().includes(l.id_lote)));
  elegido = computed(() => this.opciones().find((l) => String(l.id_lote) === this.idLote()) ?? null);

  elegir(id: string): void {
    this.idLote.set(id);
    this.cantidad = this.elegido()?.cantidad ?? '';
  }

  async guardar(): Promise<void> {
    const r = await this.a.ejecutar(() =>
      this.api.post<DespachoItem>(`/api/despacho/${this.idDespacho()}/lotes`, { id_lote: Number(this.idLote()), cantidad: Number(this.cantidad) }),
    );
    if (r) this.guardado.emit(`Lote ${r.lote.codigo_lote} agregado al despacho.`);
  }
}

@Component({
  selector: 'app-despacho-detalle',
  imports: [
    RouterLink, Alerta, Cargando, Insignia, Vacio, LineaTiempo, ListaIncidencias, ListaEvidencias, TablaControles,
    ConfirmarMotivo, FormDespacho, FormControl, AgregarLote, EtiquetaPipe, FechaHoraPipe, NumPipe,
  ],
  template: `
    @if (despacho.error()) { <app-alerta>{{ despacho.error() }}</app-alerta> }
    @if ((!despacho.data() || !traza.data()) && !despacho.error()) { <app-cargando /> }
    @if (despacho.data(); as d) {
      @if (traza.data(); as t) {
        <header class="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div class="min-w-0">
            <a routerLink="/despachos" class="mb-1 block text-xs font-medium text-ink-500 hover:underline">← Despachos</a>
            <h1 class="flex flex-wrap items-center gap-3 text-2xl font-bold tracking-tight text-ink-900">{{ d.codigo }} <app-insignia [valor]="d.estado" /></h1>
            <p class="mt-1 text-sm text-ink-700">Destino: {{ d.destino }}@if (d.direccion_destino) { · {{ d.direccion_destino }} }</p>
          </div>
          @if (auth.puede('escribir') && !terminal()) {
            <div class="flex flex-wrap items-center gap-2">
              <button class="btn btn-secundario" (click)="editar.set(true)">Editar</button>
              <button class="btn btn-secundario" (click)="lectura.set(true)">Registrar lectura</button>
              @for (e of transiciones(); track e) {
                <button class="btn" [class]="e === 'CANCELADO' ? 'btn-fantasma' : e === 'ENTREGADO' ? 'btn-exito' : 'btn-primario'"
                  (click)="destino.set(e)">{{ texto[e] }}</button>
              }
            </div>
          }
        </header>

        @if (aviso()) { <app-alerta class="mb-4" tono="ok">{{ aviso() }}</app-alerta> }
        @if (error()) { <app-alerta class="mb-4">{{ error() }}</app-alerta> }

        <section class="tarjeta mb-6 px-5 py-5">
          @if (d.estado === 'CANCELADO') {
            <p class="text-sm font-semibold text-ink-700">Este despacho fue cancelado.</p>
          } @else {
            <ol class="grid grid-cols-4 gap-2">
              @for (p of pasos(); track p.estado) {
                <li class="min-w-0">
                  <div class="h-1.5 rounded-full" [class]="p.hecho ? 'bg-frost-500' : 'bg-ice-200'"></div>
                  <p class="mt-2 text-xs font-semibold sm:text-sm" [class]="p.hecho ? 'text-ink-900' : 'text-ink-500'">{{ p.estado | etiqueta }}</p>
                  @if (p.fecha) { <p class="text-xs text-ink-500">{{ p.fecha | fechaHora }}</p> }
                </li>
              }
            </ol>
          }
        </section>

        <div class="grid gap-6 lg:grid-cols-3">
          <section class="tarjeta">
            <div class="titulo-seccion"><h2>Datos del envío</h2></div>
            <dl class="grid grid-cols-2 gap-4 px-5 py-4">
              <div class="dato"><dt>Transportista</dt><dd>{{ d.transportista ?? '—' }}</dd></div>
              <div class="dato"><dt>Vehículo / placa</dt><dd>{{ vehiculo() }}</dd></div>
              <div class="dato"><dt>Programado</dt><dd>{{ d.fecha_programada | fechaHora }}</dd></div>
              <div class="dato"><dt>Contacto</dt><dd>{{ d.contacto_destino ?? '—' }}</dd></div>
              <div class="dato"><dt>Salida</dt><dd>{{ d.fecha_salida | fechaHora }}</dd></div>
              <div class="dato"><dt>Llegada</dt><dd>{{ d.fecha_llegada | fechaHora }}</dd></div>
              <div class="dato"><dt>Responsable</dt><dd>{{ t.responsable ?? d.usuario.username }}</dd></div>
              <div class="dato"><dt>Lecturas</dt><dd>{{ t.controles.length }}</dd></div>
              @if (d.observacion) { <div class="dato col-span-2"><dt>Observación</dt><dd>{{ d.observacion }}</dd></div> }
            </dl>
          </section>

          <section class="tarjeta lg:col-span-2">
            <div class="titulo-seccion">
              <h2>Lotes del despacho ({{ items.data()?.length ?? 0 }})</h2>
              @if (auth.puede('escribir') && !terminal()) { <button class="btn btn-secundario" (click)="agregar.set(true)">Agregar lote</button> }
            </div>
            @if (items.data()?.length) {
              <ul class="divide-y divide-ink-300/20">
                @for (i of items.data(); track i.id_despacho_lote) {
                  <li class="flex items-center gap-3 px-5 py-3">
                    <div class="min-w-0 flex-1">
                      <a [routerLink]="['/lotes', i.lote.id_lote]" class="text-sm font-semibold text-ink-900 hover:text-frost-600 hover:underline">{{ i.lote.codigo_lote }}</a>
                      <p class="text-xs text-ink-500">{{ i.lote.producto }} · {{ i.cantidad | num: 3 }} {{ i.lote.unidad }} enviados</p>
                    </div>
                    <app-insignia [valor]="i.lote.estado" />
                    @if (auth.puede('escribir') && !terminal()) { <button class="btn btn-fantasma btn-sm" (click)="quitar(i)">Quitar</button> }
                  </li>
                }
              </ul>
            } @else {
              <app-vacio titulo="Aún no hay lotes en este despacho" detalle="Agrega lotes disponibles antes de registrar la salida." />
            }
          </section>
        </div>

        <section class="tarjeta mt-6">
          <div class="titulo-seccion"><h2>Lecturas de control</h2></div>
          <app-tabla-controles [controles]="t.controles" contexto="despacho" />
        </section>

        <div class="mt-6 grid gap-6 lg:grid-cols-2">
          <section class="tarjeta">
            <div class="titulo-seccion"><h2>Cadena de custodia</h2></div>
            <div class="px-5 py-5"><app-linea-tiempo [items]="t.timeline" /></div>
          </section>
          <div class="space-y-6">
            <section class="tarjeta">
              <div class="titulo-seccion"><h2>No conformidades ({{ t.incidencias.length }})</h2></div>
              <app-lista-incidencias [items]="t.incidencias" />
            </section>
            <section class="tarjeta">
              <div class="titulo-seccion"><h2>Evidencias</h2></div>
              <app-lista-evidencias [items]="t.evidencias" />
            </section>
          </div>
        </div>

        @if (destino(); as e) {
          <app-confirmar-motivo [titulo]="texto[e]" textoBoton="Confirmar" [obligatorio]="e === 'CANCELADO'"
            [variante]="e === 'CANCELADO' ? 'peligro' : e === 'ENTREGADO' ? 'exito' : 'primario'" [confirmar]="cambiarEstado" (cerrar)="destino.set(null)">
            El despacho pasará de <b>{{ d.estado | etiqueta }}</b> a <b>{{ e | etiqueta }}</b>.
            @if (e === 'EN_TRANSITO') { Los lotes asociados pasarán a En tránsito. }
            @if (e === 'ENTREGADO') { Los lotes asociados se marcarán como entregados. }
          </app-confirmar-motivo>
        }
        @if (editar()) {
          <app-form-despacho [despacho]="d" (cerrar)="editar.set(false)" (guardado)="editar.set(false); aviso.set('Despacho actualizado.'); recargar()" />
        }
        @if (agregar()) {
          <app-agregar-lote [idDespacho]="d.id_despacho" [yaIncluidos]="incluidos()" (cerrar)="agregar.set(false)"
            (guardado)="agregar.set(false); aviso.set($event); recargar()" />
        }
        @if (lectura()) {
          <app-form-control [despacho]="d" (cerrar)="lectura.set(false)" (guardado)="lectura.set(false); recargar()" />
        }
      }
    }`,
})
export class DespachoDetallePage {
  private api = inject(Api);
  auth = inject(Auth);
  id = input.required<string>();
  texto = TEXTO;
  aviso = signal<string | null>(null);
  error = signal<string | null>(null);
  destino = signal<EstadoDespacho | null>(null);
  editar = signal(false);
  agregar = signal(false);
  lectura = signal(false);

  despacho = carga(() => this.api.get<Despacho>(`/api/despacho/${this.id()}`), { inmediato: false });
  traza = carga(() => this.api.get<TrazabilidadDespacho>(`/api/trazabilidad/despacho/${this.id()}`), { inmediato: false });
  items = carga(() => this.api.get<DespachoItem[]>(`/api/despacho/${this.id()}/lotes`), { inmediato: false });

  terminal = computed(() => ['ENTREGADO', 'CANCELADO'].includes(this.despacho.data()?.estado ?? ''));
  transiciones = computed(() => TRANSICIONES[this.despacho.data()?.estado ?? 'ENTREGADO']);
  incluidos = computed(() => (this.items.data() ?? []).map((i) => i.lote.id_lote));
  vehiculo = computed(() => {
    const d = this.despacho.data();
    return [d?.vehiculo, d?.placa].filter(Boolean).join(' · ') || '—';
  });
  pasos = computed(() => {
    const d = this.despacho.data();
    if (!d) return [];
    const actual = PASOS.indexOf(d.estado);
    return PASOS.map((estado, i) => ({
      estado,
      hecho: i <= actual,
      fecha: estado === 'PENDIENTE' ? d.fecha_creacion : estado === 'EN_TRANSITO' ? d.fecha_salida : estado === 'ENTREGADO' ? d.fecha_llegada : null,
    }));
  });

  constructor() {
    effect(() => {
      this.id();
      untracked(() => {
        this.aviso.set(null);
        this.recargar();
      });
    });
  }

  recargar(): void {
    void this.despacho.recargar();
    void this.traza.recargar();
    void this.items.recargar();
  }

  async quitar(item: DespachoItem): Promise<void> {
    this.error.set(null);
    try {
      await this.api.del(`/api/despacho/lote/${item.id_despacho_lote}`);
      this.aviso.set(`Lote ${item.lote.codigo_lote} retirado del despacho.`);
      this.recargar();
    } catch (e) {
      this.error.set(mensajeError(e));
    }
  }

  cambiarEstado = async (motivo: string): Promise<string | null> => {
    const e = this.destino();
    try {
      await this.api.patch(`/api/despacho/${this.id()}/estado`, { estado: e, motivo: motivo || null });
      this.aviso.set(`Despacho actualizado a ${etiqueta(e)}.`);
      this.recargar();
      return null;
    } catch (err) {
      return mensajeError(err);
    }
  };
}
