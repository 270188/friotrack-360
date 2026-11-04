import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Api, mensajeError } from '../core/api';
import { Auth } from '../core/auth';
import { carga } from '../core/carga';
import { FechaHoraPipe, FechaPipe, NumPipe, RangoPipe } from '../core/pipes';
import type { Lote, Producto, TrazabilidadLote } from '../core/types';
import { ConfirmarMotivo, Grafico, LineaTiempo, ListaEvidencias, ListaIncidencias, TablaControles } from '../shared/dominio';
import { FormIncidencia, FormLote } from '../shared/formularios';
import { fecha, num, rango } from '../core/format';
import { ModalEtiqueta } from '../shared/etiqueta';
import { Alerta, Cargando, Icono, Insignia, Vacio } from '../shared/ui';

type AccionLote = 'bloquear' | 'liberar' | 'descartar';

@Component({
  selector: 'app-lote-detalle',
  imports: [
    RouterLink, Alerta, Cargando, Insignia, Vacio, Grafico, LineaTiempo, ListaIncidencias, ListaEvidencias, TablaControles,
    ConfirmarMotivo, FormLote, FormIncidencia, ModalEtiqueta, Icono, FechaPipe, FechaHoraPipe, NumPipe, RangoPipe,
  ],
  template: `
    @if (t.error()) { <app-alerta>{{ t.error() }}</app-alerta> }
    @if (!t.data() && !t.error()) { <app-cargando /> }
    @if (t.data(); as t) {
      <header class="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div class="min-w-0">
          <a routerLink="/lotes" class="mb-1 block text-xs font-medium text-ink-500 hover:underline">← Lotes</a>
          <h1 class="flex flex-wrap items-center gap-3 text-2xl font-bold tracking-tight text-ink-900">
            {{ t.codigo_lote }} <app-insignia [valor]="t.estado" />
            @if (t.vencido) { <app-insignia tono="alerta" texto="Vencido" /> }
          </h1>
          <p class="mt-1 text-sm text-ink-700">{{ t.producto.nombre }} · {{ t.cantidad | num: 3 }} {{ t.unidad }}</p>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <button class="btn btn-secundario" (click)="etiqueta.set(true)"><app-icono nombre="qr" clase="size-4" /> Etiqueta QR</button>
          @if (auth.puede('escribir') && !terminal()) { <button class="btn btn-secundario" (click)="editar.set(true)">Editar</button> }
          @if (auth.puede('calidad')) {
            <button class="btn btn-secundario" (click)="nuevaInc.set(true)">Registrar no conformidad</button>
            @if (t.estado === 'BLOQUEADO') { <button class="btn btn-exito" (click)="accion.set('liberar')">Liberar</button> }
            @if (!terminal() && t.estado !== 'BLOQUEADO') { <button class="btn btn-peligro" (click)="accion.set('bloquear')">Bloquear</button> }
            @if (t.estado !== 'DESCARTADO') { <button class="btn btn-fantasma" (click)="accion.set('descartar')">Descartar</button> }
          }
        </div>
      </header>

      @if (aviso()) { <app-alerta class="mb-4" tono="ok">{{ aviso() }}</app-alerta> }
      @if (t.estado === 'BLOQUEADO') {
        <app-alerta class="mb-4">Este lote está bloqueado: no puede incluirse en un despacho hasta que Calidad lo libere (RB-01, RB-02).</app-alerta>
      }

      <div class="grid gap-6 lg:grid-cols-3">
        <section class="tarjeta">
          <div class="titulo-seccion"><h2>Datos del lote</h2></div>
          <dl class="grid grid-cols-2 gap-4 px-5 py-4">
            <div class="dato"><dt>Producto</dt><dd>{{ t.producto.nombre }}</dd></div>
            <div class="dato"><dt>Categoría</dt><dd>{{ t.producto.categoria ?? '—' }}</dd></div>
            <div class="dato"><dt>Producción</dt><dd>{{ t.fecha_produccion | fecha }}</dd></div>
            <div class="dato"><dt>Vencimiento</dt><dd [class.text-alert-500]="t.vencido" [class.font-semibold]="t.vencido">{{ t.fecha_vencimiento | fecha }}</dd></div>
            <div class="dato"><dt>Rango de temperatura</dt><dd>{{ t.producto.temperatura_min | rango: t.producto.temperatura_max : '°C' }}</dd></div>
            <div class="dato"><dt>Rango de humedad</dt><dd>{{ t.producto.humedad_min | rango: t.producto.humedad_max : '%' }}</dd></div>
            <div class="dato"><dt>Lecturas</dt><dd>{{ t.controles.length }}</dd></div>
            <div class="dato"><dt>Fuera de rango</dt><dd [class.text-alert-500]="fueraRango()" [class.font-semibold]="fueraRango()">{{ fueraRango() }}</dd></div>
          </dl>
        </section>
        <section class="tarjeta lg:col-span-2">
          <div class="titulo-seccion"><h2>Evolución de la temperatura</h2></div>
          <div class="px-5 py-4"><app-grafico [controles]="t.controles" [min]="t.producto.temperatura_min" [max]="t.producto.temperatura_max" /></div>
        </section>
      </div>

      <div class="mt-6 grid gap-6 lg:grid-cols-2">
        <section class="tarjeta">
          <div class="titulo-seccion"><h2>Despachos ({{ t.despachos.length }})</h2></div>
          @if (t.despachos.length) {
            <ul class="divide-y divide-ink-300/20">
              @for (d of t.despachos; track d.id_despacho) {
                <li>
                  <a [routerLink]="['/despachos', d.id_despacho]" class="flex items-center gap-3 px-5 py-3 hover:bg-ice-50">
                    <div class="min-w-0 flex-1">
                      <p class="text-sm font-semibold text-ink-900">{{ d.codigo }}</p>
                      <p class="text-xs text-ink-500">{{ d.destino }} · {{ d.cantidad | num: 3 }} {{ t.unidad }} · salida {{ d.fecha_salida | fechaHora }}</p>
                    </div>
                    <app-insignia [valor]="d.estado" />
                  </a>
                </li>
              }
            </ul>
          } @else {
            <app-vacio titulo="Este lote no ha sido despachado" />
          }
        </section>
        <section class="tarjeta">
          <div class="titulo-seccion"><h2>No conformidades ({{ t.incidencias.length }})</h2></div>
          <app-lista-incidencias [items]="t.incidencias" />
        </section>
      </div>

      @if (t.producto.define_rango_humedad && tieneHumedad()) {
        <section class="tarjeta mt-6">
          <div class="titulo-seccion"><h2>Evolución de la humedad</h2></div>
          <div class="px-5 py-4">
            <app-grafico [controles]="t.controles" [min]="t.producto.humedad_min" [max]="t.producto.humedad_max" campo="humedad" unidad="%" />
          </div>
        </section>
      }

      <section class="tarjeta mt-6">
        <div class="titulo-seccion"><h2>Lecturas de control</h2></div>
        <app-tabla-controles [controles]="t.controles" contexto="lote" />
      </section>

      <div class="mt-6 grid gap-6 lg:grid-cols-2">
        <section class="tarjeta">
          <div class="titulo-seccion"><h2>Línea de tiempo</h2></div>
          <div class="px-5 py-5"><app-linea-tiempo [items]="t.timeline" /></div>
        </section>
        <section class="tarjeta">
          <div class="titulo-seccion"><h2>Evidencias</h2></div>
          <app-lista-evidencias [items]="t.evidencias" />
        </section>
      </div>

      @if (accion(); as a) {
        <app-confirmar-motivo [titulo]="textos[a].titulo" [textoBoton]="textos[a].boton" [variante]="a === 'liberar' ? 'exito' : 'peligro'"
          [obligatorio]="a !== 'liberar'" [confirmar]="ejecutar" (cerrar)="accion.set(null)">
          @switch (a) {
            @case ('bloquear') { El lote <b>{{ t.codigo_lote }}</b> no podrá incluirse en nuevos despachos hasta que sea liberado. }
            @case ('liberar') { El lote <b>{{ t.codigo_lote }}</b> volverá a estado <b>Disponible</b>. La decisión queda registrada con tu usuario. }
            @case ('descartar') { El descarte es definitivo: el lote <b>{{ t.codigo_lote }}</b> no podrá volver a usarse. }
          }
        </app-confirmar-motivo>
      }
      @if (editar()) {
        <app-form-lote [productos]="productos.data() ?? [t.producto]" [lote]="t" (cerrar)="editar.set(false)"
          (guardado)="editar.set(false); aviso.set('Lote actualizado.'); recargar()" />
      }
      @if (etiqueta()) {
        <app-modal-etiqueta tipo="lote" [codigo]="t.codigo_lote" [titulo]="t.producto.nombre" [datos]="datosEtiqueta()" (cerrar)="etiqueta.set(false)" />
      }
      @if (nuevaInc()) {
        <app-form-incidencia [idLote]="t.id_lote" [codigoLote]="t.codigo_lote" (cerrar)="nuevaInc.set(false)"
          (guardado)="nuevaInc.set(false); aviso.set('No conformidad registrada.'); recargar()" />
      }
    }`,
})
export class LoteDetallePage {
  private api = inject(Api);
  auth = inject(Auth);
  id = input.required<string>();
  accion = signal<AccionLote | null>(null);
  editar = signal(false);
  nuevaInc = signal(false);
  etiqueta = signal(false);
  aviso = signal<string | null>(null);
  textos: Record<AccionLote, { titulo: string; boton: string; aviso: string }> = {
    bloquear: { titulo: 'Bloquear lote', boton: 'Bloquear', aviso: 'Lote bloqueado. No podrá incluirse en nuevos despachos.' },
    liberar: { titulo: 'Liberar lote', boton: 'Liberar', aviso: 'Lote liberado: vuelve a estar disponible.' },
    descartar: { titulo: 'Descartar lote', boton: 'Descartar', aviso: 'Lote descartado.' },
  };

  t = carga(() => this.api.get<TrazabilidadLote>(`/api/trazabilidad/lote/${this.id()}`), { inmediato: false });
  productos = carga(() => this.api.get<Producto[]>('/api/producto/activos'), { inmediato: false });

  terminal = computed(() => ['DESCARTADO', 'ENTREGADO'].includes(this.t.data()?.estado ?? ''));
  fueraRango = computed(() => (this.t.data()?.controles ?? []).filter((c) => c.resultado === 'FUERA_RANGO').length);
  datosEtiqueta = computed(() => {
    const t = this.t.data();
    if (!t) return [];
    const datos = [
      { k: 'Producción', v: fecha(t.fecha_produccion) },
      { k: 'Vence', v: fecha(t.fecha_vencimiento) },
      { k: 'Cantidad', v: `${num(t.cantidad, 3)} ${t.unidad ?? ''}`.trim() },
    ];
    if (t.producto.define_rango_temperatura) datos.push({ k: 'Conservar', v: rango(t.producto.temperatura_min, t.producto.temperatura_max, '°C') });
    return datos;
  });
  tieneHumedad = computed(() => (this.t.data()?.controles ?? []).some((c) => c.humedad != null));

  constructor() {
    effect(() => {
      this.id();
      untracked(() => {
        this.aviso.set(null);
        void this.t.recargar();
      });
    });
    effect(() => {
      if (this.editar()) untracked(() => void this.productos.recargar());
    });
  }

  recargar(): void {
    void this.t.recargar();
  }

  ejecutar = async (motivo: string): Promise<string | null> => {
    const a = this.accion();
    if (!a) return null;
    try {
      await this.api.patch<Lote>(`/api/lote/${this.id()}/${a}`, { motivo: motivo || null });
      this.aviso.set(this.textos[a].aviso);
      void this.t.recargar();
      return null;
    } catch (e) {
      return mensajeError(e);
    }
  };
}
