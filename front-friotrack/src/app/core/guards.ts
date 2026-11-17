// Guards de navegación que no dependen de la sesión.
import { CanDeactivateFn } from '@angular/router';

/** Pantallas con un formulario que se puede abandonar a medio llenar. */
export interface ConCambiosPendientes {
  tieneCambiosPendientes(): boolean;
}

/** Pregunta antes de salir de una pantalla con cambios sin guardar. */
export const cambiosPendientesGuard: CanDeactivateFn<ConCambiosPendientes> = (componente) =>
  !componente.tieneCambiosPendientes() || window.confirm('Tienes cambios sin guardar. ¿Salir de todos modos?');
