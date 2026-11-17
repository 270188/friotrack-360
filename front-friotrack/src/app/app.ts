import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Notificaciones } from './shared/notificaciones/notificaciones';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, Notificaciones],
  template: '<router-outlet /><app-notificaciones />',
})
export class App {}
