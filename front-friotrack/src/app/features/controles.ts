import { Component, inject, signal } from '@angular/core';
import { Api } from '../core/api';
import { Auth } from '../core/auth';
import { carga } from '../core/carga';
import type { Control } from '../core/types';
import { TablaControles } from '../shared/dominio';
import { FormControl } from '../shared/formularios';
import { Alerta, Cargando, Icono } from '../shared/ui';

@Component({
  selector: 'app-controles',
  imports: [Alerta, Cargando, Icono, TablaControles, FormControl],
  template: `
    <header class="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 class="text-2xl font-bold tracking-tight text-ink-900">Controles de temperatura</h1>
        <p class="mt-1 text-sm text-ink-700">Cada lectura se evalúa contra el rango configurado del producto. Si se desvía, se abre una incidencia automáticamente.</p>
      </div>
      @if (auth.puede('escribir')) {
        <button class="btn btn-primario" (click)="nueva.set(true)"><app-icono nombre="mas" clase="size-4" /> Registrar lectura</button>
      }
    </header>
    @if (aviso()) { <app-alerta class="mb-4" tono="ok">{{ aviso() }}</app-alerta> }

    <section class="tarjeta">
      <div class="titulo-seccion"><h2>Lecturas fuera de rango @if (fuera.data()) { ({{ fuera.data()!.length }}) }</h2></div>
      @if (fuera.error()) { <div class="p-4"><app-alerta>{{ fuera.error() }}</app-alerta></div> }
      @if (fuera.cargando() && !fuera.data()) { <app-cargando /> }
      @if (fuera.data(); as d) { <app-tabla-controles [controles]="d" /> }
    </section>
    <p class="mt-3 text-xs text-ink-500">El historial completo de lecturas de un lote o despacho está en su ficha de trazabilidad.</p>

    @if (nueva()) {
      <app-form-control (cerrar)="nueva.set(false)" (guardado)="registrada($event)" />
    }`,
})
export class ControlesPage {
  private api = inject(Api);
  auth = inject(Auth);
  nueva = signal(false);
  aviso = signal<string | null>(null);
  fuera = carga(() => this.api.get<Control[]>('/api/control/fuera-de-rango'));

  registrada(c: Control): void {
    this.nueva.set(false);
    this.aviso.set(`Lectura registrada en ${c.codigo_despacho} / ${c.codigo_lote}: ${c.resultado === 'NORMAL' ? 'dentro del rango' : 'fuera de rango'}.`);
    void this.fuera.recargar();
  }
}
