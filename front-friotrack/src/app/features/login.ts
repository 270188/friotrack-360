import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { mensajeError } from '../core/api';
import { Auth } from '../core/auth';
import { nombreMarca } from '../core/config';
import { Alerta, Icono } from '../shared/ui';

@Component({
  selector: 'app-login',
  imports: [FormsModule, Alerta, Icono],
  template: `
    <div class="grid min-h-screen lg:grid-cols-[1.1fr_1fr]">
      <section class="relative hidden overflow-hidden bg-ink-900 p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <app-icono nombre="copo" clase="size-[28rem]" class="pointer-events-none absolute -right-24 -bottom-24 text-ink-800" />
        <div class="relative flex items-center gap-3">
          <span class="grid size-10 place-items-center rounded-xl bg-frost-500"><app-icono nombre="copo" clase="size-6" /></span>
          <span class="text-lg font-bold">{{ marca }}</span>
        </div>
        <div class="relative max-w-md">
          <h1 class="text-4xl leading-tight font-bold">Cada lote, cada lectura, cada decisión.</h1>
          <p class="mt-4 text-base text-ink-300">
            Reconstruye la historia completa de un lote o envío: qué ocurrió, cuándo, quién intervino y qué decisión se tomó.
          </p>
        </div>
        <ul class="relative grid grid-cols-3 gap-4 text-sm">
          @for (p of pilares; track p[0]) {
            <li class="rounded-xl bg-white/5 p-4">
              <p class="font-semibold text-frost-300">{{ p[0] }}</p>
              <p class="mt-1 text-ink-300">{{ p[1] }}</p>
            </li>
          }
        </ul>
      </section>

      <section class="flex items-center justify-center px-6 py-12">
        <form (ngSubmit)="enviar()" class="w-full max-w-sm space-y-5">
          <div>
            <div class="mb-6 flex items-center gap-2 lg:hidden">
              <span class="grid size-9 place-items-center rounded-lg bg-frost-500 text-white"><app-icono nombre="copo" /></span>
              <span class="text-lg font-bold">{{ marca }}</span>
            </div>
            <h2 class="text-2xl font-bold text-ink-900">Iniciar sesión</h2>
            <p class="mt-1 text-sm text-ink-700">Ingresa con tu usuario asignado.</p>
          </div>
          @if (error()) { <app-alerta>{{ error() }}</app-alerta> }
          <label class="block"><span class="etiqueta">Usuario</span>
            <input class="campo" name="username" autocomplete="username" required autofocus [(ngModel)]="username" />
          </label>
          <label class="block"><span class="etiqueta">Contraseña</span>
            <input class="campo" type="password" name="password" autocomplete="current-password" required [(ngModel)]="password" />
          </label>
          <button type="submit" class="btn btn-primario w-full py-2.5" [disabled]="enviando()">
            @if (enviando()) { <span class="spinner"></span> } Ingresar
          </button>
        </form>
      </section>
    </div>`,
})
export class LoginPage {
  marca = nombreMarca();
  private auth = inject(Auth);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  username = '';
  password = '';
  error = signal<string | null>(null);
  enviando = signal(false);
  pilares = [
    ['Cadena de frío', 'Lecturas contra umbrales por producto'],
    ['No conformidades', 'Del registro al cierre validado'],
    ['Auditoría', 'Eventos inmutables con actor y hora'],
  ];

  async enviar(): Promise<void> {
    this.error.set(null);
    this.enviando.set(true);
    try {
      await this.auth.login(this.username.trim(), this.password);
      const v = this.route.snapshot.queryParamMap.get('volver');
      const destino = v && v.startsWith('/') && !v.startsWith('//') && !v.startsWith('/login') ? v : '/dashboard';
      await this.router.navigateByUrl(destino);
    } catch (e) {
      this.error.set(mensajeError(e));
    } finally {
      this.enviando.set(false);
    }
  }
}
