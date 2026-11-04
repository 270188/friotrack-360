import { Component, DestroyRef, ElementRef, inject, input, OnInit, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import type { IScannerControls } from '@zxing/browser';
import { Api, ApiError, mensajeError } from '../core/api';
import { interpretarLectura, type Lectura, type TipoCodigo } from '../core/codigos';
import { FechaPipe, NumPipe } from '../core/pipes';
import type { Despacho, Lote } from '../core/types';
import { Alerta, Icono, Insignia } from '../shared/ui';

type Resultado =
  | { tipo: 'lote'; codigo: string; lote: Lote }
  | { tipo: 'despacho'; codigo: string; despacho: Despacho };

type EstadoCamara = 'apagada' | 'iniciando' | 'activa';

@Component({
  selector: 'app-escanear',
  imports: [FormsModule, RouterLink, Alerta, Icono, Insignia, FechaPipe, NumPipe],
  template: `
    <header class="mb-6">
      <h1 class="text-2xl font-bold tracking-tight text-ink-900">Escanear</h1>
      <p class="mt-1 text-sm text-ink-700">Lee el QR o el código de barras de un lote o despacho con la cámara o una pistola lectora.</p>
    </header>

    <div class="grid gap-6 lg:grid-cols-5">
      <section class="tarjeta overflow-hidden lg:col-span-3">
        <div class="relative aspect-[4/3] bg-ink-950">
          <video #video class="size-full object-cover" [class.invisible]="camara() !== 'activa'" muted playsinline aria-label="Vista de la cámara"></video>
          @if (camara() === 'activa') {
            <div class="pointer-events-none absolute inset-0 grid place-items-center" aria-hidden="true">
              <div class="aspect-square w-3/5 max-w-72 rounded-2xl border-2 border-frost-300 shadow-[0_0_0_100vmax_rgba(7,25,35,.45)]"></div>
            </div>
            <p class="absolute inset-x-0 bottom-3 text-center text-xs font-medium text-white/90">Centra el código dentro del recuadro</p>
          } @else {
            <div class="absolute inset-0 flex flex-col items-center justify-center gap-4 p-6 text-center">
              <span class="grid size-14 place-items-center rounded-2xl bg-white/10 text-frost-300"><app-icono nombre="camara" clase="size-7" /></span>
              @if (camara() === 'iniciando') {
                <p class="flex items-center gap-2 text-sm text-white"><span class="spinner"></span> Abriendo la cámara…</p>
              } @else {
                <button type="button" class="btn bg-frost-500 text-white hover:bg-frost-600" (click)="iniciar()"><app-icono nombre="escaner" clase="size-4" /> Activar cámara</button>
                <p class="max-w-xs text-xs text-ink-300">El navegador pedirá permiso para usar la cámara. En el celular se usa la cámara trasera.</p>
              }
            </div>
          }
        </div>

        <div class="space-y-4 p-5">
          @if (errorCamara()) { <app-alerta>{{ errorCamara() }}</app-alerta> }
          @if (camara() === 'activa') {
            <div class="flex flex-wrap items-end gap-3">
              @if (camaras().length > 1) {
                <label class="min-w-0 flex-1">
                  <span class="etiqueta">Cámara</span>
                  <select class="campo" name="camara" [ngModel]="camaraId()" (ngModelChange)="cambiarCamara($event)">
                    @for (c of camaras(); track c.deviceId; let i = $index) { <option [value]="c.deviceId">{{ c.label || 'Cámara ' + (i + 1) }}</option> }
                  </select>
                </label>
              }
              <button type="button" class="btn btn-secundario" (click)="detener()">Detener cámara</button>
            </div>
          }

          <form (ngSubmit)="enviarManual()" class="flex gap-2">
            <label class="min-w-0 flex-1">
              <span class="etiqueta">Código o lectura de pistola</span>
              <input #manual class="campo font-mono" name="manual" [(ngModel)]="textoManual" autocomplete="off" autocapitalize="characters"
                placeholder="LOT-2026-0001 o DSP-2026-0001" />
            </label>
            <button type="submit" class="btn btn-secundario self-end" [disabled]="buscando()">Buscar</button>
          </form>
        </div>
      </section>

      <section class="space-y-6 lg:col-span-2" aria-live="polite">
        @if (buscando()) {
          <div class="tarjeta flex items-center gap-3 p-5 text-sm text-ink-700"><span class="spinner"></span> Buscando {{ leyendo() }}…</div>
        } @else if (noEncontrado()) {
          <app-alerta>No existe un {{ noEncontrado()!.tipo ?? 'lote ni despacho' }} con el código "{{ noEncontrado()!.codigo }}".</app-alerta>
        } @else if (error()) {
          <app-alerta>{{ error() }}</app-alerta>
        }

        @if (resultado(); as r) {
          <article class="tarjeta p-5">
            <p class="text-[11px] font-semibold tracking-[0.12em] text-frost-600 uppercase">{{ r.tipo }} encontrado</p>
            @if (r.tipo === 'lote') {
              <h2 class="mt-1 flex flex-wrap items-center gap-2 text-xl font-bold text-ink-900">
                <span class="font-mono">{{ r.lote.codigo_lote }}</span> <app-insignia [valor]="r.lote.estado" />
                @if (r.lote.vencido) { <app-insignia tono="alerta" texto="Vencido" /> }
              </h2>
              <dl class="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                <div class="col-span-2"><dt class="text-xs text-ink-500">Producto</dt><dd class="font-semibold">{{ r.lote.producto.nombre }}</dd></div>
                <div><dt class="text-xs text-ink-500">Cantidad</dt><dd class="font-semibold">{{ r.lote.cantidad | num: 3 }} {{ r.lote.unidad }}</dd></div>
                <div><dt class="text-xs text-ink-500">Vence</dt><dd class="font-semibold">{{ r.lote.fecha_vencimiento | fecha }}</dd></div>
              </dl>
              <div class="mt-5 flex flex-wrap gap-2">
                <a class="btn btn-primario" [routerLink]="['/lotes', r.lote.id_lote]">Ver trazabilidad</a>
                <button type="button" class="btn btn-secundario" (click)="otro()">Escanear otro</button>
              </div>
            } @else {
              <h2 class="mt-1 flex flex-wrap items-center gap-2 text-xl font-bold text-ink-900">
                <span class="font-mono">{{ r.despacho.codigo }}</span> <app-insignia [valor]="r.despacho.estado" />
              </h2>
              <dl class="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                <div class="col-span-2"><dt class="text-xs text-ink-500">Destino</dt><dd class="font-semibold">{{ r.despacho.destino }}</dd></div>
                <div><dt class="text-xs text-ink-500">Transportista</dt><dd class="font-semibold">{{ r.despacho.transportista || '—' }}</dd></div>
                <div><dt class="text-xs text-ink-500">Placa</dt><dd class="font-semibold">{{ r.despacho.placa || '—' }}</dd></div>
              </dl>
              <div class="mt-5 flex flex-wrap gap-2">
                <a class="btn btn-primario" [routerLink]="['/despachos', r.despacho.id_despacho]">Ver despacho</a>
                <button type="button" class="btn btn-secundario" (click)="otro()">Escanear otro</button>
              </div>
            }
          </article>
        } @else if (!buscando() && !noEncontrado() && !error()) {
          <div class="tarjeta px-6 py-10 text-center">
            <span class="mx-auto grid size-12 place-items-center rounded-xl bg-ice-100 text-frost-600"><app-icono nombre="qr" clase="size-6" /></span>
            <p class="mt-3 text-sm font-semibold text-ink-800">Esperando una lectura</p>
            <p class="mt-1 text-sm text-ink-500">Imprime etiquetas desde el detalle de cada lote o despacho con el botón «Etiqueta QR».</p>
          </div>
        }

        @if (recientes().length) {
          <div class="tarjeta">
            <h2 class="border-b border-ink-300/30 px-5 py-3 text-sm font-bold text-ink-900">Lecturas de esta sesión</h2>
            <ul class="divide-y divide-ink-300/30">
              @for (x of recientes(); track x.tipo + x.codigo) {
                <li>
                  <a class="flex items-center justify-between gap-3 px-5 py-2.5 text-sm hover:bg-ice-50"
                    [routerLink]="x.tipo === 'lote' ? ['/lotes', x.id] : ['/despachos', x.id]">
                    <span class="font-mono font-semibold text-ink-900">{{ x.codigo }}</span>
                    <span class="text-xs text-ink-500 capitalize">{{ x.tipo }}</span>
                  </a>
                </li>
              }
            </ul>
          </div>
        }
      </section>
    </div>`,
})
export class EscanearPage implements OnInit {
  private api = inject(Api);
  private router = inject(Router);

  /** Parámetros de la URL que lleva el QR de las etiquetas. */
  codigo = input<string>();
  tipo = input<string>();

  private video = viewChild.required<ElementRef<HTMLVideoElement>>('video');
  private manual = viewChild.required<ElementRef<HTMLInputElement>>('manual');
  private controles: IScannerControls | null = null;
  private destruido = false;

  camara = signal<EstadoCamara>('apagada');
  camaras = signal<MediaDeviceInfo[]>([]);
  camaraId = signal<string | null>(null);
  errorCamara = signal<string | null>(null);

  textoManual = '';
  buscando = signal(false);
  leyendo = signal('');
  resultado = signal<Resultado | null>(null);
  noEncontrado = signal<Lectura | null>(null);
  error = signal<string | null>(null);
  recientes = signal<{ tipo: TipoCodigo; codigo: string; id: number }[]>([]);

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      this.destruido = true;
      this.detener();
    });
  }

  ngOnInit(): void {
    const codigo = this.codigo()?.trim();
    if (codigo) {
      const t = this.tipo();
      // Llegó desde el QR de una etiqueta: se abre directo el lote o despacho.
      void this.resolver({ codigo, tipo: t === 'lote' || t === 'despacho' ? t : interpretarLectura(codigo)?.tipo ?? null }, true);
    } else {
      setTimeout(() => this.manual().nativeElement.focus());
    }
  }

  // ---------------------------------------------------------------- cámara
  async iniciar(deviceId?: string): Promise<void> {
    this.errorCamara.set(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      this.errorCamara.set('Este navegador no permite usar la cámara aquí. Abre el sistema con https o usa la búsqueda manual.');
      return;
    }
    this.detener();
    this.camara.set('iniciando');
    try {
      const { BrowserMultiFormatReader, BrowserCodeReader } = await import('@zxing/browser');
      const lector = new BrowserMultiFormatReader(undefined, { delayBetweenScanAttempts: 150, delayBetweenScanSuccess: 800 });
      const restricciones: MediaStreamConstraints = {
        audio: false,
        video: deviceId ? { deviceId: { exact: deviceId } } : { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
      };
      const controles = await lector.decodeFromConstraints(restricciones, this.video().nativeElement, (res) => {
        if (res && this.camara() === 'activa') this.leido(res.getText());
      });
      if (this.destruido) {
        controles.stop();
        return;
      }
      this.controles = controles;
      this.camara.set('activa');
      const lista = await BrowserCodeReader.listVideoInputDevices().catch(() => [] as MediaDeviceInfo[]);
      this.camaras.set(lista);
      const actual = (this.video().nativeElement.srcObject as MediaStream | null)?.getVideoTracks()[0]?.getSettings().deviceId;
      this.camaraId.set(actual ?? deviceId ?? lista[0]?.deviceId ?? null);
    } catch (e) {
      this.camara.set('apagada');
      this.errorCamara.set(mensajeCamara(e));
    }
  }

  cambiarCamara(id: string): void {
    this.camaraId.set(id);
    void this.iniciar(id);
  }

  detener(): void {
    this.controles?.stop();
    this.controles = null;
    if (this.camara() !== 'iniciando') this.camara.set('apagada');
  }

  private leido(texto: string): void {
    const lectura = interpretarLectura(texto);
    if (!lectura) {
      this.error.set('El código leído no corresponde a un lote ni a un despacho de este sistema.');
      return;
    }
    this.detener();
    avisoLectura();
    void this.resolver(lectura);
  }

  // ---------------------------------------------------------------- búsqueda
  enviarManual(): void {
    const lectura = interpretarLectura(this.textoManual);
    if (!lectura) return;
    this.textoManual = '';
    void this.resolver(lectura);
  }

  otro(): void {
    this.resultado.set(null);
    this.noEncontrado.set(null);
    this.error.set(null);
    void this.iniciar(this.camaraId() ?? undefined);
  }

  async resolver(l: Lectura, abrir = false): Promise<void> {
    this.resultado.set(null);
    this.noEncontrado.set(null);
    this.error.set(null);
    this.leyendo.set(l.codigo);
    this.buscando.set(true);
    try {
      // Con prefijo conocido se busca ahí primero; sin prefijo se prueban ambos.
      const tipos: TipoCodigo[] = l.tipo === 'despacho' ? ['despacho', 'lote'] : ['lote', 'despacho'];
      for (const t of tipos) {
        const r = await this.buscar(t, l.codigo);
        if (!r) continue;
        if (abrir) {
          await this.router.navigate(r.tipo === 'lote' ? ['/lotes', r.lote.id_lote] : ['/despachos', r.despacho.id_despacho], { replaceUrl: true });
          return;
        }
        this.resultado.set(r);
        const id = r.tipo === 'lote' ? r.lote.id_lote : r.despacho.id_despacho;
        const codigo = r.tipo === 'lote' ? r.lote.codigo_lote : r.despacho.codigo;
        this.recientes.update((xs) => [{ tipo: r.tipo, codigo, id }, ...xs.filter((x) => !(x.tipo === r.tipo && x.id === id))].slice(0, 8));
        return;
      }
      this.noEncontrado.set(l);
    } catch (e) {
      this.error.set(mensajeError(e));
    } finally {
      this.buscando.set(false);
    }
  }

  private async buscar(tipo: TipoCodigo, codigo: string): Promise<Resultado | null> {
    try {
      if (tipo === 'lote') {
        const lote = await this.api.get<Lote>(`/api/lote/codigo/${encodeURIComponent(codigo)}`);
        return { tipo, codigo, lote };
      }
      const despacho = await this.api.get<Despacho>(`/api/despacho/codigo/${encodeURIComponent(codigo)}`);
      return { tipo, codigo, despacho };
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) return null;
      throw e;
    }
  }
}

function mensajeCamara(e: unknown): string {
  const n = e instanceof DOMException || e instanceof Error ? e.name : '';
  if (n === 'NotAllowedError' || n === 'SecurityError') return 'No se dio permiso para usar la cámara. Actívalo en la configuración del navegador (icono junto a la dirección) y vuelve a intentar.';
  if (n === 'NotFoundError' || n === 'OverconstrainedError') return 'No se encontró una cámara en este dispositivo.';
  if (n === 'NotReadableError') return 'La cámara está siendo usada por otra aplicación.';
  return 'No se pudo abrir la cámara. Usa la búsqueda manual o una pistola lectora.';
}

/** Vibración corta y un pitido suave al leer un código. */
function avisoLectura(): void {
  try {
    navigator.vibrate?.(80);
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gan = ctx.createGain();
    osc.frequency.value = 1100;
    gan.gain.setValueAtTime(0.08, ctx.currentTime);
    gan.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.12);
    osc.connect(gan).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.12);
    osc.onended = () => void ctx.close();
  } catch {
    /* sin audio: no pasa nada */
  }
}
