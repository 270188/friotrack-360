import { Component, computed, inject, signal } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { Auth, type Permiso } from '../core/auth';
import { nombreMarca } from '../core/config';
import { EtiquetaPipe } from '../core/pipes';
import { Icono } from '../shared/ui';

interface Item {
  ruta: string;
  texto: string;
  icono: string;
  permiso?: Permiso;
}

const NAV: { grupo: string; items: Item[] }[] = [
  { grupo: 'Operación', items: [
    { ruta: '/dashboard', texto: 'Panel', icono: 'panel' },
    { ruta: '/lotes', texto: 'Lotes', icono: 'lote' },
    { ruta: '/despachos', texto: 'Despachos', icono: 'despacho' },
    { ruta: '/controles', texto: 'Controles', icono: 'control' },
  ] },
  { grupo: 'Calidad', items: [
    { ruta: '/incidencias', texto: 'Incidencias', icono: 'incidencia' },
    { ruta: '/trazabilidad', texto: 'Trazabilidad', icono: 'traza' },
    { ruta: '/eventos', texto: 'Historial', icono: 'evento' },
  ] },
  { grupo: 'Configuración', items: [
    { ruta: '/productos', texto: 'Productos', icono: 'producto' },
    { ruta: '/usuarios', texto: 'Usuarios', icono: 'usuario', permiso: 'usuarios' },
  ] },
];

@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, NgTemplateOutlet, Icono, EtiquetaPipe],
  template: `
    <ng-template #bloqueMarca>
      <div class="flex items-center gap-2.5 px-6 py-5">
        <span class="grid size-8 place-items-center rounded-lg bg-frost-500 text-white"><app-icono nombre="copo" /></span>
        <div class="leading-tight">
          <p class="text-sm font-bold text-white">{{ marca }}</p>
          <p class="text-[11px] text-ink-300">Trazabilidad en frío</p>
        </div>
      </div>
    </ng-template>

    <ng-template #nav>
      <nav class="flex flex-1 flex-col gap-6 overflow-y-auto px-3 py-5" aria-label="Principal">
        @for (g of grupos(); track g.grupo) {
          <div>
            <p class="px-3 pb-2 text-[11px] font-semibold tracking-[0.12em] text-ink-300/70 uppercase">{{ g.grupo }}</p>
            <ul class="space-y-0.5">
              @for (i of g.items; track i.ruta) {
                <li>
                  <a [routerLink]="i.ruta" routerLinkActive="bg-white/10 text-white!" ariaCurrentWhenActive="page" (click)="menu.set(false)"
                    class="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-ink-300 transition hover:bg-white/5 hover:text-white">
                    <app-icono [nombre]="i.icono" clase="size-[18px]" />{{ i.texto }}
                  </a>
                </li>
              }
            </ul>
          </div>
        }
      </nav>
    </ng-template>

    <ng-template #usuario>
      <div class="border-t border-white/10 px-4 py-4">
        <div class="flex items-center gap-3">
          <span class="grid size-9 place-items-center rounded-full bg-ink-800 text-sm font-bold text-frost-300 uppercase">{{ iniciales() }}</span>
          <div class="min-w-0 flex-1 leading-tight">
            <p class="truncate text-sm font-semibold text-white">{{ auth.sesion()?.username }}</p>
            <p class="text-xs text-ink-300">{{ auth.rol() | etiqueta }}</p>
          </div>
          <button type="button" (click)="auth.logout()" class="cursor-pointer rounded-md p-2 text-ink-300 hover:bg-white/10 hover:text-white"
            aria-label="Cerrar sesión" title="Cerrar sesión"><app-icono nombre="salir" clase="size-[18px]" /></button>
        </div>
      </div>
    </ng-template>

    <div class="min-h-screen lg:pl-64">
      <aside class="fixed inset-y-0 left-0 hidden w-64 flex-col bg-ink-900 lg:flex">
        <ng-container [ngTemplateOutlet]="bloqueMarca" />
        <ng-container [ngTemplateOutlet]="nav" />
        <ng-container [ngTemplateOutlet]="usuario" />
      </aside>

      <div class="sticky top-0 z-30 flex items-center justify-between bg-ink-900 px-4 py-3 lg:hidden">
        <div class="flex items-center gap-2 text-white">
          <span class="grid size-7 place-items-center rounded-md bg-frost-500"><app-icono nombre="copo" clase="size-4" /></span>
          <span class="text-sm font-bold">{{ marca }}</span>
        </div>
        <button type="button" (click)="menu.set(true)" class="cursor-pointer rounded-md p-2 text-white" aria-label="Abrir menú"><app-icono nombre="menu" /></button>
      </div>
      @if (menu()) {
        <div class="fixed inset-0 z-40 lg:hidden">
          <div class="absolute inset-0 bg-ink-950/60" (click)="menu.set(false)"></div>
          <aside class="absolute inset-y-0 left-0 flex w-72 flex-col bg-ink-900">
            <ng-container [ngTemplateOutlet]="bloqueMarca" />
            <ng-container [ngTemplateOutlet]="nav" />
            <ng-container [ngTemplateOutlet]="usuario" />
          </aside>
        </div>
      }

      <main class="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <router-outlet />
      </main>
    </div>`,
})
export class Shell {
  auth = inject(Auth);
  marca = nombreMarca();
  menu = signal(false);
  iniciales = computed(() => (this.auth.sesion()?.username ?? '').slice(0, 2));
  grupos = computed(() => {
    this.auth.rol();
    return NAV.map((g) => ({ ...g, items: g.items.filter((i) => !i.permiso || this.auth.puede(i.permiso)) })).filter((g) => g.items.length);
  });
}
