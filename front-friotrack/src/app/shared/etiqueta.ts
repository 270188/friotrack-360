import { Component, ElementRef, computed, input, output, signal, viewChild, ViewEncapsulation } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { barrasCode128, code128Admite, generarQr, urlEtiqueta, type TipoCodigo } from '../core/codigos';
import { nombreMarca } from '../core/config';
import { Icono, Modal } from './ui';

export interface DatoEtiqueta {
  k: string;
  v: string;
}

/**
 * Estilos de la etiqueta. Son CSS plano (sin Tailwind) porque se usan dos veces:
 * en la vista previa y dentro del documento que se envía a la impresora.
 */
const CSS_ETIQUETA = `
.etq { box-sizing: border-box; width: 90mm; min-height: 56mm; padding: 3.5mm 4mm 3mm; border: 0.3mm solid #0b2533; border-radius: 2.5mm;
  background: #fff; color: #0b2533; font-family: ui-sans-serif, "Segoe UI", system-ui, Arial, sans-serif; display: flex; flex-direction: column; gap: 2mm;
  break-inside: avoid; page-break-inside: avoid; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.etq * { box-sizing: border-box; }
.etq-cab { display: flex; justify-content: space-between; align-items: center; gap: 2mm; font-size: 2.6mm; font-weight: 700; letter-spacing: .02em; }
.etq-marca { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.etq-tipo { flex: none; background: #0b2533; color: #fff; border-radius: 1mm; padding: .4mm 1.6mm; font-size: 2.2mm; letter-spacing: .12em; text-transform: uppercase; }
.etq-cuerpo { display: flex; gap: 3mm; align-items: flex-start; }
.etq-qr { flex: none; width: 26mm; height: 26mm; display: block; }
.etq-info { min-width: 0; flex: 1; }
.etq-codigo { font-family: ui-monospace, Menlo, Consolas, monospace; font-size: 4.2mm; font-weight: 800; line-height: 1.1; word-break: break-all; }
.etq-titulo { margin-top: .8mm; font-size: 3mm; font-weight: 600; line-height: 1.25; }
.etq-datos { margin: 1.2mm 0 0; padding: 0; list-style: none; font-size: 2.6mm; line-height: 1.45; }
.etq-datos b { font-weight: 600; color: #3e5a66; }
.etq-barras { display: block; width: 100%; height: 10mm; }
.etq-pie { text-align: center; font-family: ui-monospace, Menlo, Consolas, monospace; font-size: 2.4mm; letter-spacing: .08em; margin-top: -1mm; }
`;

@Component({
  selector: 'app-etiqueta',
  encapsulation: ViewEncapsulation.None,
  styles: CSS_ETIQUETA,
  template: `
    <div class="etq">
      <div class="etq-cab"><span class="etq-marca">{{ marca }}</span><span class="etq-tipo">{{ tipo() }}</span></div>
      <div class="etq-cuerpo">
        <svg class="etq-qr" [attr.viewBox]="'-2 -2 ' + (qr().tam + 4) + ' ' + (qr().tam + 4)" shape-rendering="crispEdges" role="img"
          [attr.aria-label]="'Código QR de ' + codigo()">
          <rect x="-2" y="-2" [attr.width]="qr().tam + 4" [attr.height]="qr().tam + 4" fill="#fff" />
          <path [attr.d]="qr().d" fill="#000" />
        </svg>
        <div class="etq-info">
          <div class="etq-codigo">{{ codigo() }}</div>
          @if (titulo()) { <div class="etq-titulo">{{ titulo() }}</div> }
          @if (datos().length) {
            <ul class="etq-datos">
              @for (d of datos(); track d.k) { <li><b>{{ d.k }}:</b> {{ d.v }}</li> }
            </ul>
          }
        </div>
      </div>
      @if (barras(); as b) {
        <svg class="etq-barras" [attr.viewBox]="'-10 0 ' + (b.ancho + 20) + ' 40'" preserveAspectRatio="none" shape-rendering="crispEdges" aria-hidden="true">
          @for (r of b.barras; track $index) { <rect [attr.x]="r.x" y="0" [attr.width]="r.w" height="40" fill="#000" /> }
        </svg>
        <div class="etq-pie">{{ codigo() }}</div>
      }
    </div>`,
})
export class Etiqueta {
  tipo = input.required<TipoCodigo>();
  codigo = input.required<string>();
  titulo = input<string | null>(null);
  datos = input<DatoEtiqueta[]>([]);
  marca = nombreMarca();

  qr = computed(() => generarQr(urlEtiqueta(this.tipo(), this.codigo())));
  /** Code 128 para pistolas 1D; se omite si el código tiene caracteres que no admite (tildes, ñ). */
  barras = computed(() => (code128Admite(this.codigo()) ? barrasCode128(this.codigo()) : null));
}

/** Imprime HTML en un iframe oculto, sin abrir ventanas emergentes. */
export function imprimirHtml(cuerpo: string, titulo: string): void {
  const iframe = document.createElement('iframe');
  iframe.setAttribute('aria-hidden', 'true');
  iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden';
  document.body.appendChild(iframe);
  const doc = iframe.contentDocument!;
  doc.open();
  doc.write(`<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${titulo.replace(/</g, '&lt;')}</title><style>
    @page { margin: 8mm; }
    html, body { margin: 0; background: #fff; }
    .hoja { display: flex; flex-wrap: wrap; gap: 5mm; }
    ${CSS_ETIQUETA}
  </style></head><body><div class="hoja">${cuerpo}</div></body></html>`);
  doc.close();
  const win = iframe.contentWindow!;
  const quitar = () => setTimeout(() => iframe.remove(), 500);
  win.addEventListener('afterprint', quitar, { once: true });
  setTimeout(() => {
    win.focus();
    win.print();
    // Safari no siempre dispara afterprint: se limpia igual pasado un minuto.
    setTimeout(() => iframe.isConnected && iframe.remove(), 60_000);
  }, 50);
}

@Component({
  selector: 'app-modal-etiqueta',
  imports: [FormsModule, Modal, Icono, Etiqueta],
  template: `
    <app-modal [titulo]="'Etiqueta de ' + tipo()" ancho="max-w-md" (cerrar)="cerrar.emit()">
      <div class="flex justify-center overflow-x-auto rounded-lg bg-ice-100 p-4" #vista>
        <app-etiqueta [tipo]="tipo()" [codigo]="codigo()" [titulo]="titulo()" [datos]="datos()" />
      </div>
      <p class="mt-3 text-xs text-ink-500">
        El QR se lee con el escáner del sistema o con la cámara del celular. Las barras sirven para pistolas lectoras.
      </p>
      <div class="mt-4 flex flex-wrap items-end justify-between gap-3">
        <label class="w-28">
          <span class="etiqueta">Copias</span>
          <input class="campo" type="number" min="1" max="60" name="copias" [ngModel]="copias()" (ngModelChange)="copias.set(acotar($event))" />
        </label>
        <button type="button" class="btn btn-primario" (click)="imprimir()"><app-icono nombre="imprimir" clase="size-4" /> Imprimir</button>
      </div>
    </app-modal>`,
})
export class ModalEtiqueta {
  tipo = input.required<TipoCodigo>();
  codigo = input.required<string>();
  titulo = input<string | null>(null);
  datos = input<DatoEtiqueta[]>([]);
  cerrar = output<void>();
  copias = signal(1);
  private vista = viewChild.required<ElementRef<HTMLElement>>('vista');

  acotar(v: unknown): number {
    const n = Math.round(Number(v));
    return Number.isFinite(n) ? Math.min(60, Math.max(1, n)) : 1;
  }

  imprimir(): void {
    const html = this.vista().nativeElement.querySelector('.etq')!.outerHTML;
    imprimirHtml(html.repeat(this.copias()), `Etiqueta ${this.codigo()}`);
  }
}
