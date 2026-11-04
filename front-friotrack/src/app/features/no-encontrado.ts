import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-no-encontrado',
  imports: [RouterLink],
  template: `
    <div class="flex min-h-screen flex-col items-center justify-center gap-3 px-6 text-center">
      <p class="text-sm font-semibold text-frost-600">404</p>
      <h1 class="text-2xl font-bold text-ink-900">Página no encontrada</h1>
      <a routerLink="/dashboard" class="text-sm font-semibold text-frost-600 hover:underline">Volver al panel</a>
    </div>`,
})
export class NoEncontradoPage {}
