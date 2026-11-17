import { Component, inject } from '@angular/core';
import { Notificaciones as ServicioNotificaciones } from '../../core/notificaciones';

/** Muestra los avisos del servicio Notificaciones (comunicación entre componentes por un servicio). */
@Component({
  selector: 'app-notificaciones',
  templateUrl: './notificaciones.html',
  styleUrl: './notificaciones.scss',
})
export class Notificaciones {
  servicio = inject(ServicioNotificaciones);
}
