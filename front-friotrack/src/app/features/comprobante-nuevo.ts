import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Api, mensajeError } from '../core/api';
import { carga } from '../core/carga';
import { aInputFecha, limpiar } from '../core/format';
import { DineroPipe } from '../core/pipes';
import { MOTIVOS, TIPOS, UNIDADES, calcularLinea, calcularTotales, tipoPorRuta, unidadSunat } from '../core/sunat';
import type { Comprobante, Despacho, DespachoItem, EmisorSunat, Producto, TipoComprobante } from '../core/types';
import { Alerta, Cargando, Icono } from '../shared/ui';
import { AvisoPruebaSunat } from './comprobantes';

interface FilaItem {
  id_producto: number | null;
  codigo: string;
  descripcion: string;
  unidad: string;
  cantidad: number | null;
  precio: number | null;
}

const fila = (p: Partial<FilaItem> = {}): FilaItem => ({ id_producto: null, codigo: '', descripcion: '', unidad: 'NIU', cantidad: 1, precio: null, ...p });

/** Ubigeos frecuentes (INEI) para el autocompletado de los puntos de partida y llegada. */
const UBIGEOS = [
  ['200101', 'Piura – Piura'], ['200601', 'Sullana – Sullana'], ['200501', 'Paita – Paita'], ['200701', 'Talara – Pariñas'],
  ['240101', 'Tumbes – Tumbes'], ['140101', 'Chiclayo – Chiclayo'], ['130101', 'Trujillo – Trujillo'], ['150101', 'Lima – Lima'],
  ['150122', 'Lima – Miraflores'], ['150131', 'Lima – San Isidro'], ['070101', 'Callao – Callao'], ['040101', 'Arequipa – Arequipa'],
];

@Component({
  selector: 'app-comprobante-nuevo',
  imports: [FormsModule, RouterLink, Alerta, Cargando, Icono, DineroPipe, AvisoPruebaSunat],
  template: `
    @if (!tipoDoc()) {
      <app-alerta>Tipo de comprobante no válido. <a routerLink="/comprobantes" class="underline">Volver</a></app-alerta>
    } @else {
      <header class="mb-6">
        <a routerLink="/comprobantes" class="mb-1 block text-xs font-medium text-ink-500 hover:underline">← Comprobantes</a>
        <h1 class="text-2xl font-bold tracking-tight text-ink-900">Nueva {{ tipos[tipoDoc()!].nombre.toLowerCase() }}</h1>
        <p class="mt-1 text-sm text-ink-700">
          @if (emisor.data(); as e) {
            Emisor: <b>{{ e.razon_social }}</b> · RUC {{ e.ruc }} · Serie
            <span class="font-mono">{{ tipoDoc() === '01' ? e.serie_factura : tipoDoc() === '03' ? e.serie_boleta : e.serie_guia }}</span>
          }
          @if (despacho.data(); as d) { · Despacho <a [routerLink]="['/despachos', d.id_despacho]" class="font-semibold text-frost-600 hover:underline">{{ d.codigo }}</a> }
        </p>
      </header>

      @if (emisor.data()?.prueba) { <app-aviso-prueba-sunat /> }
      @if (emisor.error()) { <app-alerta class="mb-4">{{ emisor.error() }}</app-alerta> }
      @if (precargando()) { <app-cargando /> }

      <form (ngSubmit)="emitir()" class="space-y-6" [class.hidden]="precargando()">
        <!-- Cliente / destinatario -->
        <section class="tarjeta p-5">
          <h2 class="mb-4 text-sm font-bold text-ink-900">{{ esGuia() ? 'Destinatario' : 'Cliente' }}</h2>
          <div class="grid gap-4 sm:grid-cols-6">
            <label class="sm:col-span-1">
              <span class="etiqueta">Documento</span>
              <select class="campo" name="tipoDocCli" [(ngModel)]="cliente.tipoDoc" [disabled]="tipoDoc() === '01'">
                <option value="6">RUC</option>
                <option value="1">DNI</option>
              </select>
            </label>
            <label class="sm:col-span-2">
              <span class="etiqueta">Número</span>
              <input class="campo font-mono" name="numDocCli" [(ngModel)]="cliente.numDoc" required inputmode="numeric"
                [maxlength]="cliente.tipoDoc === '6' ? 11 : 8" [placeholder]="cliente.tipoDoc === '6' ? '11 dígitos' : '8 dígitos'" />
            </label>
            <label class="sm:col-span-3">
              <span class="etiqueta">{{ cliente.tipoDoc === '6' ? 'Razón social' : 'Nombres y apellidos' }}</span>
              <input class="campo" name="nombreCli" [(ngModel)]="cliente.nombre" required maxlength="200" />
            </label>
            @if (!esGuia()) {
              <label class="sm:col-span-6">
                <span class="etiqueta">Dirección <span class="font-normal normal-case">(opcional)</span></span>
                <input class="campo" name="dirCli" [(ngModel)]="cliente.direccion" maxlength="255" />
              </label>
            }
          </div>
          @if (tipoDoc() === '03') {
            <p class="mt-3 text-xs text-ink-500">Para «clientes varios» puedes usar DNI 00000000 si el importe no supera S/ 700.</p>
          }
        </section>

        <!-- Traslado (solo guía) -->
        @if (esGuia()) {
          <section class="tarjeta p-5">
            <h2 class="mb-4 text-sm font-bold text-ink-900">Datos del traslado</h2>
            <div class="grid gap-4 sm:grid-cols-6">
              <label class="sm:col-span-3">
                <span class="etiqueta">Motivo</span>
                <select class="campo" name="motivo" [(ngModel)]="traslado.motivo">
                  @for (m of motivos; track m[0]) { <option [value]="m[0]">{{ m[0] }} · {{ m[1] }}</option> }
                </select>
              </label>
              <label class="sm:col-span-2">
                <span class="etiqueta">Inicio del traslado</span>
                <input class="campo" type="date" name="fechaTraslado" [(ngModel)]="traslado.fecha" [min]="hoy" required />
              </label>
              <label class="sm:col-span-1">
                <span class="etiqueta">Peso bruto (kg)</span>
                <input class="campo" type="number" name="peso" [(ngModel)]="traslado.peso" min="0.001" step="0.001" required />
              </label>

              <fieldset class="sm:col-span-6">
                <legend class="etiqueta">Modalidad de transporte</legend>
                <div class="mt-1 flex flex-wrap gap-2">
                  @for (m of modalidades; track m.valor) {
                    <label class="flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm"
                      [class]="traslado.modalidad === m.valor ? 'border-frost-500 bg-frost-500/10 font-semibold' : 'border-ink-300/60'">
                      <input type="radio" name="modalidad" [value]="m.valor" [(ngModel)]="traslado.modalidad" class="accent-frost-600" /> {{ m.texto }}
                    </label>
                  }
                </div>
              </fieldset>

              @if (traslado.modalidad === '01') {
                <label class="sm:col-span-2">
                  <span class="etiqueta">RUC del transportista</span>
                  <input class="campo font-mono" name="trRuc" [(ngModel)]="traslado.transportistaRuc" maxlength="11" inputmode="numeric" required />
                </label>
                <label class="sm:col-span-4">
                  <span class="etiqueta">Razón social del transportista</span>
                  <input class="campo" name="trNombre" [(ngModel)]="traslado.transportistaNombre" maxlength="200" required />
                </label>
              } @else {
                <label class="sm:col-span-2">
                  <span class="etiqueta">DNI del conductor</span>
                  <input class="campo font-mono" name="coDni" [(ngModel)]="traslado.conductorDni" maxlength="8" inputmode="numeric" required />
                </label>
                <label class="sm:col-span-2">
                  <span class="etiqueta">Nombres</span>
                  <input class="campo" name="coNombres" [(ngModel)]="traslado.conductorNombres" maxlength="100" required />
                </label>
                <label class="sm:col-span-2">
                  <span class="etiqueta">Apellidos</span>
                  <input class="campo" name="coApellidos" [(ngModel)]="traslado.conductorApellidos" maxlength="100" required />
                </label>
                <label class="sm:col-span-3">
                  <span class="etiqueta">Licencia de conducir</span>
                  <input class="campo font-mono" name="coLicencia" [(ngModel)]="traslado.conductorLicencia" maxlength="20" required />
                </label>
                <label class="sm:col-span-3">
                  <span class="etiqueta">Placa del vehículo</span>
                  <input class="campo font-mono uppercase" name="placa" [(ngModel)]="traslado.placa" maxlength="10" required />
                </label>
              }

              <div class="grid gap-4 sm:col-span-6 sm:grid-cols-2">
                @for (p of puntos; track p.clave) {
                  <div class="rounded-lg border border-ink-300/40 p-3">
                    <p class="mb-2 text-xs font-bold tracking-wide text-ink-700 uppercase">{{ p.titulo }}</p>
                    <div class="grid grid-cols-3 gap-3">
                      <label>
                        <span class="etiqueta">Ubigeo</span>
                        <input class="campo font-mono" [name]="p.clave + 'Ubigeo'" [(ngModel)]="traslado[p.clave].ubigeo" list="ubigeos"
                          maxlength="6" inputmode="numeric" required pattern="\\d{6}" />
                      </label>
                      <label class="col-span-2">
                        <span class="etiqueta">Dirección</span>
                        <input class="campo" [name]="p.clave + 'Dir'" [(ngModel)]="traslado[p.clave].direccion" maxlength="200" required />
                      </label>
                    </div>
                  </div>
                }
              </div>
              <datalist id="ubigeos">
                @for (u of ubigeos; track u[0]) { <option [value]="u[0]">{{ u[1] }}</option> }
              </datalist>
            </div>
          </section>
        }

        <!-- Ítems -->
        <section class="tarjeta">
          <div class="flex flex-wrap items-center justify-between gap-3 border-b border-ink-300/30 px-5 py-3">
            <h2 class="text-sm font-bold text-ink-900">{{ esGuia() ? 'Bienes a trasladar' : 'Detalle' }}</h2>
            <button type="button" class="btn btn-secundario" (click)="agregar()"><app-icono nombre="mas" clase="size-4" /> Agregar ítem</button>
          </div>
          <div class="divide-y divide-ink-300/30">
            @for (it of items(); track it; let i = $index) {
              <div class="grid gap-3 px-5 py-4 sm:grid-cols-12 sm:items-end">
                <label class="sm:col-span-3">
                  <span class="etiqueta">Producto</span>
                  <select class="campo" [name]="'prod' + i" [ngModel]="it.id_producto" (ngModelChange)="elegirProducto(it, $event)">
                    <option [ngValue]="null">— Texto libre —</option>
                    @for (p of productos.data() ?? []; track p.id_producto) { <option [ngValue]="p.id_producto">{{ p.nombre }}</option> }
                  </select>
                </label>
                <label [class]="esGuia() ? 'sm:col-span-5' : 'sm:col-span-3'">
                  <span class="etiqueta">Descripción</span>
                  <input class="campo" [name]="'desc' + i" [(ngModel)]="it.descripcion" required maxlength="500" />
                </label>
                <label class="sm:col-span-2">
                  <span class="etiqueta">Unidad</span>
                  <select class="campo" [name]="'uni' + i" [(ngModel)]="it.unidad">
                    @for (u of unidades; track u.codigo) { <option [value]="u.codigo">{{ u.nombre }}</option> }
                  </select>
                </label>
                <label class="sm:col-span-1">
                  <span class="etiqueta">Cant.</span>
                  <input class="campo" type="number" [name]="'cant' + i" [(ngModel)]="it.cantidad" min="0.001" step="0.001" required />
                </label>
                @if (!esGuia()) {
                  <label class="sm:col-span-2">
                    <span class="etiqueta">P. unit. (inc. IGV)</span>
                    <input class="campo" type="number" [name]="'precio' + i" [(ngModel)]="it.precio" min="0.01" step="0.01" required />
                  </label>
                }
                <div class="flex items-center justify-between gap-2 sm:col-span-1 sm:justify-end">
                  @if (!esGuia()) { <span class="text-sm font-semibold tabular-nums sm:hidden">S/ {{ importe(it) | dinero }}</span> }
                  <button type="button" class="cursor-pointer rounded-md p-2 text-ink-500 hover:bg-alert-50 hover:text-alert-600 disabled:opacity-30"
                    (click)="quitar(i)" [disabled]="items().length === 1" [attr.aria-label]="'Quitar ítem ' + (i + 1)"><app-icono nombre="cerrar" clase="size-4" /></button>
                </div>
                @if (!esGuia()) {
                  <p class="hidden text-right text-xs text-ink-500 sm:col-span-12 sm:block">Importe: <b class="text-ink-900 tabular-nums">S/ {{ importe(it) | dinero }}</b></p>
                }
              </div>
            }
          </div>
          @if (!esGuia()) {
            <dl class="ml-auto max-w-xs space-y-1.5 border-t border-ink-300/30 px-5 py-4 text-sm">
              <div class="flex justify-between"><dt class="text-ink-700">Op. gravada</dt><dd class="tabular-nums">S/ {{ totales().gravada | dinero }}</dd></div>
              <div class="flex justify-between"><dt class="text-ink-700">IGV (18 %)</dt><dd class="tabular-nums">S/ {{ totales().igv | dinero }}</dd></div>
              <div class="flex justify-between text-base font-bold"><dt>Total</dt><dd class="tabular-nums">S/ {{ totales().total | dinero }}</dd></div>
            </dl>
          }
        </section>

        <section class="tarjeta p-5">
          <label>
            <span class="etiqueta">Observación <span class="font-normal normal-case">(opcional)</span></span>
            <textarea class="campo" name="obs" rows="2" maxlength="500" [(ngModel)]="observacion"></textarea>
          </label>
        </section>

        @if (error()) { <app-alerta>{{ error() }}</app-alerta> }
        <div class="flex flex-wrap items-center justify-end gap-3">
          <a routerLink="/comprobantes" class="btn btn-fantasma">Cancelar</a>
          <button type="submit" class="btn btn-primario" [disabled]="enviando()">
            @if (enviando()) { <span class="spinner"></span> {{ esGuia() ? 'Generando…' : 'Enviando a SUNAT…' }} }
            @else { {{ esGuia() ? 'Generar guía de remisión' : 'Emitir y enviar a SUNAT' }} }
          </button>
        </div>
      </form>
    }`,
})
export class ComprobanteNuevoPage {
  private api = inject(Api);
  private router = inject(Router);

  /** Ruta: /comprobantes/nuevo/:tipo (factura | boleta | guia), con ?despacho=ID opcional. */
  tipo = input<string>();
  idDespacho = input<string | undefined>(undefined, { alias: 'despacho' });

  tipos = TIPOS;
  unidades = UNIDADES;
  motivos = Object.entries(MOTIVOS);
  ubigeos = UBIGEOS;
  hoy = aInputFecha();
  modalidades = [
    { valor: '02', texto: 'Transporte privado (vehículo propio)' },
    { valor: '01', texto: 'Transporte público (empresa de transporte)' },
  ];
  puntos = [
    { clave: 'partida' as const, titulo: 'Punto de partida' },
    { clave: 'llegada' as const, titulo: 'Punto de llegada' },
  ];

  tipoDoc = computed<TipoComprobante | null>(() => tipoPorRuta(this.tipo()));
  esGuia = computed(() => this.tipoDoc() === '09');

  cliente = { tipoDoc: '6', numDoc: '', nombre: '', direccion: '' };
  traslado = {
    motivo: '01',
    fecha: aInputFecha(),
    peso: null as number | null,
    modalidad: '02',
    transportistaRuc: '',
    transportistaNombre: '',
    conductorDni: '',
    conductorNombres: '',
    conductorApellidos: '',
    conductorLicencia: '',
    placa: '',
    partida: { ubigeo: '', direccion: '' },
    llegada: { ubigeo: '', direccion: '' },
  };
  observacion = '';
  items = signal<FilaItem[]>([fila()]);

  enviando = signal(false);
  error = signal<string | null>(null);

  emisor = carga(() => this.api.get<EmisorSunat>('/api/comprobante/emisor'));
  productos = carga(() => this.api.get<Producto[]>('/api/producto/activos'));
  despacho = carga(() => this.api.get<Despacho>(`/api/despacho/${this.idDespacho()}`), { inmediato: false });
  lotes = carga(() => this.api.get<DespachoItem[]>(`/api/despacho/${this.idDespacho()}/lotes`), { inmediato: false });
  precargando = computed(() => !!this.idDespacho() && (this.despacho.cargando() || this.lotes.cargando()));

  /** Se recalcula en cada detección de cambios (los campos se editan con ngModel sobre objetos simples). */
  totales() {
    return calcularTotales(this.items().map((i) => ({ cantidad: Number(i.cantidad), precio: Number(i.precio) })));
  }

  constructor() {
    effect(() => {
      const t = this.tipoDoc();
      untracked(() => {
        this.cliente.tipoDoc = t === '03' ? '1' : '6';
        if (t === '03' && !this.cliente.numDoc) {
          this.cliente.numDoc = '00000000';
          this.cliente.nombre = 'CLIENTES VARIOS';
        }
      });
    });
    effect(() => {
      const e = this.emisor.data();
      if (e) untracked(() => {
        if (!this.traslado.partida.ubigeo) this.traslado.partida = { ubigeo: e.ubigeo, direccion: e.direccion !== '-' ? e.direccion : '' };
      });
    });
    effect(() => {
      if (this.idDespacho()) untracked(() => void this.precargar());
    });
  }

  /** Completa el formulario con el despacho: destino, transporte y lotes. */
  private async precargar(): Promise<void> {
    await Promise.all([this.despacho.recargar(), this.lotes.recargar()]);
    const d = this.despacho.data();
    const lotes = this.lotes.data() ?? [];
    if (d) {
      this.cliente.nombre = d.destino.toUpperCase();
      this.traslado.llegada.direccion = d.direccion_destino ?? d.destino;
      if (d.fecha_programada) {
        const f = d.fecha_programada.slice(0, 10);
        if (f >= this.hoy) this.traslado.fecha = f;
      }
      if (d.placa) this.traslado.placa = d.placa.toUpperCase();
      if (d.transportista) this.traslado.transportistaNombre = d.transportista;
      this.observacion = `Despacho ${d.codigo}. Mantener la cadena de frío.`;
    }
    if (lotes.length) {
      this.items.set(lotes.map((x) => fila({
        codigo: x.lote.codigo_lote,
        descripcion: `${x.lote.producto} – Lote ${x.lote.codigo_lote}`,
        unidad: unidadSunat(x.lote.unidad),
        cantidad: Number(x.cantidad),
      })));
      const kilos = lotes.filter((x) => unidadSunat(x.lote.unidad) === 'KGM').reduce((s, x) => s + Number(x.cantidad), 0);
      if (kilos > 0) this.traslado.peso = Math.round(kilos * 1000) / 1000;
    }
  }

  importe(it: FilaItem): number {
    const c = Number(it.cantidad);
    const p = Number(it.precio);
    return c > 0 && p > 0 ? calcularLinea(c, p).total : 0;
  }

  elegirProducto(it: FilaItem, id: number | null): void {
    it.id_producto = id;
    const p = (this.productos.data() ?? []).find((x) => x.id_producto === id);
    if (p) {
      it.descripcion = p.nombre;
      it.codigo = `P${String(p.id_producto).padStart(3, '0')}`;
    }
  }

  agregar(): void {
    this.items.update((xs) => [...xs, fila()]);
  }
  quitar(i: number): void {
    this.items.update((xs) => xs.filter((_, k) => k !== i));
  }

  async emitir(): Promise<void> {
    this.error.set(null);
    const t = this.tipoDoc();
    if (!t) return;
    const items = this.items().map((i) => ({
      codigo: i.codigo || null,
      descripcion: i.descripcion.trim(),
      unidad: i.unidad,
      cantidad: Number(i.cantidad),
      precio_unitario: t === '09' ? null : Number(i.precio),
    }));
    const doc = this.cliente.tipoDoc;
    const num = this.cliente.numDoc.trim();
    if (!/^\d+$/.test(num) || num.length !== (doc === '6' ? 11 : 8)) {
      this.error.set(doc === '6' ? 'El RUC debe tener 11 dígitos.' : 'El DNI debe tener 8 dígitos.');
      return;
    }
    if (items.some((i) => !i.descripcion || !(i.cantidad > 0) || (t !== '09' && !((i.precio_unitario ?? 0) > 0)))) {
      this.error.set(t === '09' ? 'Cada ítem necesita descripción y cantidad.' : 'Cada ítem necesita descripción, cantidad y precio.');
      return;
    }
    const id = this.idDespacho() ? Number(this.idDespacho()) : null;

    let ruta: string;
    let cuerpo: Record<string, unknown>;
    if (t === '09') {
      const tr = this.traslado;
      ruta = '/api/comprobante/guia';
      cuerpo = limpiar({
        cliente_tipo_doc: doc,
        cliente_num_doc: num,
        cliente_nombre: this.cliente.nombre.trim(),
        id_despacho: id,
        motivo: tr.motivo,
        modalidad: tr.modalidad,
        fecha_traslado: tr.fecha,
        peso_kg: tr.peso,
        transportista_ruc: tr.modalidad === '01' ? tr.transportistaRuc.trim() : '',
        transportista_nombre: tr.modalidad === '01' ? tr.transportistaNombre.trim() : '',
        conductor_dni: tr.modalidad === '02' ? tr.conductorDni.trim() : '',
        conductor_nombres: tr.modalidad === '02' ? tr.conductorNombres.trim() : '',
        conductor_apellidos: tr.modalidad === '02' ? tr.conductorApellidos.trim() : '',
        conductor_licencia: tr.modalidad === '02' ? tr.conductorLicencia.trim() : '',
        placa: tr.modalidad === '02' ? tr.placa.trim().toUpperCase() : '',
        partida_ubigeo: tr.partida.ubigeo.trim(),
        partida_direccion: tr.partida.direccion.trim(),
        llegada_ubigeo: tr.llegada.ubigeo.trim(),
        llegada_direccion: tr.llegada.direccion.trim(),
        observacion: this.observacion.trim(),
        items,
      });
    } else {
      ruta = '/api/comprobante/venta';
      cuerpo = limpiar({
        tipo: t,
        cliente_tipo_doc: doc,
        cliente_num_doc: num,
        cliente_nombre: this.cliente.nombre.trim(),
        cliente_direccion: this.cliente.direccion.trim(),
        id_despacho: id,
        observacion: this.observacion.trim(),
        items,
      });
    }

    this.enviando.set(true);
    try {
      const c = await this.api.post<Comprobante>(ruta, cuerpo);
      await this.router.navigate(['/comprobantes', c.id_comprobante], { replaceUrl: true });
    } catch (e) {
      this.error.set(mensajeError(e));
    } finally {
      this.enviando.set(false);
    }
  }
}
