import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Api, mensajeError } from '../core/api';
import { Auth } from '../core/auth';
import { carga } from '../core/carga';
import { nombreMarca } from '../core/config';
import { DineroPipe, FechaHoraPipe, FechaPipe, NumPipe } from '../core/pipes';
import { DOCUMENTOS, MOTIVOS, TIPOS, guardarArchivo, nombreArchivo, textoEstado } from '../core/sunat';
import type { Comprobante } from '../core/types';
import { Alerta, Cargando, Icono, Insignia } from '../shared/ui';

@Component({
  selector: 'app-comprobante-detalle',
  imports: [RouterLink, Alerta, Cargando, Icono, Insignia, FechaHoraPipe, FechaPipe, NumPipe, DineroPipe],
  template: `
    @if (c.error()) { <app-alerta>{{ c.error() }}</app-alerta> }
    @if (!c.data() && !c.error()) { <app-cargando /> }
    @if (c.data(); as c) {
      <header class="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div class="min-w-0">
          <a routerLink="/comprobantes" class="mb-1 block text-xs font-medium text-ink-500 hover:underline">← Comprobantes</a>
          <h1 class="flex flex-wrap items-center gap-3 text-2xl font-bold tracking-tight text-ink-900">
            <span><span class="font-mono">{{ c.numero }}</span></span> <app-insignia [valor]="c.estado_sunat" />
            @if (c.emisor.prueba) { <app-insignia tono="aviso" texto="Prueba" /> }
          </h1>
          <p class="mt-1 text-sm text-ink-700">{{ tipos[c.tipo].nombre }} · {{ c.emisor.razon_social }} · RUC {{ c.emisor.ruc }}</p>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <button class="btn btn-primario" (click)="pdf(c)" [disabled]="generando()">
            @if (generando()) { <span class="spinner"></span> } @else { <app-icono nombre="imprimir" clase="size-4" /> } Descargar PDF
          </button>
          @if (c.tiene_xml) { <button class="btn btn-secundario" (click)="descargar(c, 'xml')">XML</button> }
          @if (c.tiene_cdr) { <button class="btn btn-secundario" (click)="descargar(c, 'cdr')">CDR</button> }
          @if (puedeReenviar()) {
            <button class="btn btn-secundario" (click)="reenviar(c)" [disabled]="reenviando()">
              @if (reenviando()) { <span class="spinner"></span> } Reenviar a SUNAT
            </button>
          }
        </div>
      </header>

      @if (aviso()) { <app-alerta class="mb-4" tono="ok">{{ aviso() }}</app-alerta> }
      @if (error()) { <app-alerta class="mb-4">{{ error() }}</app-alerta> }

      <section class="tarjeta mb-6 p-5" [class]="borde()">
        <p class="text-[11px] font-semibold tracking-[0.12em] text-ink-500 uppercase">Respuesta de SUNAT</p>
        <p class="mt-1 text-lg font-bold text-ink-900">{{ estadoTexto() }}</p>
        @if (c.codigo_respuesta || c.descripcion_respuesta) {
          <p class="mt-1 text-sm text-ink-700">
            @if (c.codigo_respuesta) { <span class="font-mono font-semibold">Código {{ c.codigo_respuesta }}</span> · }
            {{ c.descripcion_respuesta }}
          </p>
        }
        @if (c.observaciones_sunat.length) {
          <ul class="mt-2 list-disc space-y-0.5 pl-5 text-sm text-[#a26f00]">
            @for (o of c.observaciones_sunat; track $index) { <li>{{ o }}</li> }
          </ul>
        }
        <dl class="mt-4 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
          <div><dt class="text-xs text-ink-500">Enviado</dt><dd>{{ c.fecha_envio ? (c.fecha_envio | fechaHora) : '—' }}</dd></div>
          <div><dt class="text-xs text-ink-500">Entorno</dt><dd>{{ c.emisor.prueba ? 'Pruebas (beta)' : 'Producción' }}</dd></div>
          <div class="min-w-0"><dt class="text-xs text-ink-500">Resumen (hash)</dt><dd class="truncate font-mono text-xs" [title]="c.hash ?? ''">{{ c.hash ?? '—' }}</dd></div>
        </dl>
      </section>

      <div class="grid gap-6 lg:grid-cols-3">
        <section class="tarjeta p-5">
          <h2 class="mb-3 text-sm font-bold text-ink-900">{{ c.tipo === '09' ? 'Destinatario' : 'Cliente' }}</h2>
          <p class="font-semibold text-ink-900">{{ c.cliente_nombre }}</p>
          <p class="text-sm text-ink-700">{{ documentos[c.cliente_tipo_doc] }} {{ c.cliente_num_doc }}</p>
          @if (c.cliente_direccion) { <p class="mt-1 text-sm text-ink-700">{{ c.cliente_direccion }}</p> }
          <dl class="mt-4 space-y-2 text-sm">
            <div><dt class="text-xs text-ink-500">Fecha de emisión</dt><dd>{{ c.fecha_emision | fechaHora }}</dd></div>
            @if (c.codigo_despacho) {
              <div><dt class="text-xs text-ink-500">Despacho</dt>
                <dd><a [routerLink]="['/despachos', c.id_despacho]" class="font-semibold text-frost-600 hover:underline">{{ c.codigo_despacho }}</a></dd></div>
            }
            @if (c.username) { <div><dt class="text-xs text-ink-500">Emitido por</dt><dd>{{ c.username }}</dd></div> }
            @if (c.observacion) { <div><dt class="text-xs text-ink-500">Observación</dt><dd>{{ c.observacion }}</dd></div> }
          </dl>
        </section>

        @if (c.traslado; as t) {
          <section class="tarjeta p-5 lg:col-span-2">
            <h2 class="mb-3 text-sm font-bold text-ink-900">Traslado</h2>
            <dl class="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
              <div><dt class="text-xs text-ink-500">Motivo</dt><dd>{{ motivos[t.motivo] || t.descripcion_motivo }}</dd></div>
              <div><dt class="text-xs text-ink-500">Inicio del traslado</dt><dd>{{ t.fecha_traslado | fecha }}</dd></div>
              <div><dt class="text-xs text-ink-500">Modalidad</dt><dd>{{ t.modalidad === '01' ? 'Transporte público' : 'Transporte privado' }}</dd></div>
              <div><dt class="text-xs text-ink-500">Peso bruto</dt><dd>{{ t.peso_kg | num: 3 }} kg</dd></div>
              @if (t.modalidad === '01') {
                <div class="sm:col-span-2"><dt class="text-xs text-ink-500">Transportista</dt><dd>{{ t.transportista_nombre }} · RUC {{ t.transportista_ruc }}</dd></div>
              } @else {
                <div><dt class="text-xs text-ink-500">Conductor</dt><dd>{{ t.conductor_nombres }} {{ t.conductor_apellidos }} · DNI {{ t.conductor_dni }}</dd></div>
                <div><dt class="text-xs text-ink-500">Licencia · placa</dt><dd>{{ t.conductor_licencia }} · {{ t.placa }}</dd></div>
              }
              <div><dt class="text-xs text-ink-500">Partida</dt><dd>{{ t.partida_direccion }} <span class="text-ink-500">({{ t.partida_ubigeo }})</span></dd></div>
              <div><dt class="text-xs text-ink-500">Llegada</dt><dd>{{ t.llegada_direccion }} <span class="text-ink-500">({{ t.llegada_ubigeo }})</span></dd></div>
            </dl>
          </section>
        }

        <section class="tarjeta" [class]="c.traslado ? 'lg:col-span-3' : 'lg:col-span-2'">
          <div class="titulo-seccion"><h2>{{ c.tipo === '09' ? 'Bienes trasladados' : 'Detalle' }}</h2></div>
          <div class="tabla-wrap">
            <table class="tabla">
              <thead><tr><th>#</th><th>Descripción</th><th class="text-right">Cant.</th><th>Unid.</th>
                @if (c.tipo !== '09') { <th class="text-right">P. unit.</th><th class="text-right">Importe</th> }</tr></thead>
              <tbody>
                @for (i of c.items; track i.orden) {
                  <tr>
                    <td class="text-ink-500">{{ i.orden }}</td>
                    <td>{{ i.descripcion }} @if (i.codigo) { <span class="ml-1 font-mono text-xs text-ink-500">{{ i.codigo }}</span> }</td>
                    <td class="text-right tabular-nums">{{ i.cantidad | num: 3 }}</td>
                    <td>{{ i.unidad }}</td>
                    @if (c.tipo !== '09') {
                      <td class="text-right tabular-nums">{{ i.precio_unitario | dinero }}</td>
                      <td class="text-right tabular-nums">{{ i.total | dinero }}</td>
                    }
                  </tr>
                }
              </tbody>
            </table>
          </div>
          @if (c.tipo !== '09') {
            <dl class="ml-auto max-w-xs space-y-1.5 border-t border-ink-300/30 px-5 py-4 text-sm">
              <div class="flex justify-between"><dt class="text-ink-700">Op. gravada</dt><dd class="tabular-nums">S/ {{ c.op_gravada | dinero }}</dd></div>
              <div class="flex justify-between"><dt class="text-ink-700">IGV (18 %)</dt><dd class="tabular-nums">S/ {{ c.igv | dinero }}</dd></div>
              <div class="flex justify-between text-base font-bold"><dt>Total</dt><dd class="tabular-nums">S/ {{ c.total | dinero }}</dd></div>
            </dl>
            @if (c.monto_en_letras) { <p class="border-t border-ink-300/30 px-5 py-3 text-xs font-semibold text-ink-700">{{ c.monto_en_letras }}</p> }
          }
        </section>
      </div>
    }`,
})
export class ComprobanteDetallePage {
  private api = inject(Api);
  auth = inject(Auth);
  id = input.required<string>();
  tipos = TIPOS;
  motivos = MOTIVOS;
  documentos = DOCUMENTOS;

  c = carga(() => this.api.get<Comprobante>(`/api/comprobante/${this.id()}`), { inmediato: false });
  generando = signal(false);
  reenviando = signal(false);
  aviso = signal<string | null>(null);
  error = signal<string | null>(null);

  estadoTexto = computed(() => {
    const c = this.c.data();
    return c ? textoEstado(c.estado_sunat, c.emisor.prueba) : '';
  });
  borde = computed(() => {
    const e = this.c.data()?.estado_sunat;
    if (e === 'ACEPTADO') return 'border-l-4 border-l-ok-500';
    if (e === 'OBSERVADO') return 'border-l-4 border-l-warn-500';
    if (e === 'RECHAZADO' || e === 'ERROR') return 'border-l-4 border-l-alert-500';
    return 'border-l-4 border-l-ink-300';
  });
  puedeReenviar = computed(() => {
    const c = this.c.data();
    return !!c && c.tipo !== '09' && (c.estado_sunat === 'ERROR' || c.estado_sunat === 'PENDIENTE') && this.auth.puede('facturar');
  });

  constructor() {
    effect(() => {
      this.id();
      untracked(() => void this.c.recargar());
    });
  }

  async pdf(c: Comprobante): Promise<void> {
    this.error.set(null);
    this.generando.set(true);
    try {
      const { pdfComprobante } = await import('../core/pdf-comprobante');
      guardarArchivo(await pdfComprobante(c, nombreMarca()), `${nombreArchivo(c)}.pdf`);
    } catch (e) {
      this.error.set('No se pudo generar el PDF: ' + mensajeError(e));
    } finally {
      this.generando.set(false);
    }
  }

  async descargar(c: Comprobante, que: 'xml' | 'cdr'): Promise<void> {
    this.error.set(null);
    try {
      const blob = await this.api.descargar(`/api/comprobante/${c.id_comprobante}/${que}`);
      guardarArchivo(blob, que === 'xml' ? `${nombreArchivo(c)}.xml` : `R-${nombreArchivo(c)}.zip`);
    } catch (e) {
      this.error.set(mensajeError(e));
    }
  }

  async reenviar(c: Comprobante): Promise<void> {
    this.error.set(null);
    this.aviso.set(null);
    this.reenviando.set(true);
    try {
      const r = await this.api.post<Comprobante>(`/api/comprobante/${c.id_comprobante}/reenviar`);
      await this.c.recargar();
      this.aviso.set(`Reenviado: ${textoEstado(r.estado_sunat, r.emisor.prueba)}.`);
    } catch (e) {
      this.error.set(mensajeError(e));
    } finally {
      this.reenviando.set(false);
    }
  }
}
