// Manejo global de errores: cualquier excepción no controlada se registra en la consola
// y se le avisa al usuario con un mensaje claro, en lugar de que la pantalla falle en silencio.
import { ErrorHandler, Injectable, inject } from '@angular/core';
import { mensajeError } from './api';
import { Notificaciones } from './notificaciones';

@Injectable()
export class ManejadorErrores implements ErrorHandler {
  private avisos = inject(Notificaciones);
  private ultimo = '';
  private ultimoEn = 0;

  handleError(error: unknown): void {
    console.error('[FrioTrack] Error no controlado:', error);
    const texto = 'Ocurrió un error inesperado: ' + mensajeError(error);
    // Evita repetir el mismo aviso si el error se dispara varias veces seguidas.
    if (texto === this.ultimo && Date.now() - this.ultimoEn < 3000) return;
    this.ultimo = texto;
    this.ultimoEn = Date.now();
    this.avisos.error(texto);
  }
}
