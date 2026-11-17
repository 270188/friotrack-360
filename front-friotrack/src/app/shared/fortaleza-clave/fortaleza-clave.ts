import { Component, computed, effect, input, output } from '@angular/core';

/** Nivel de la contraseña: 0 vacía, 1 débil, 2 aceptable, 3 buena, 4 fuerte. */
export function nivelClave(clave: string): number {
  if (!clave) return 0;
  let puntos = 0;
  if (clave.length >= 8) puntos++;
  if (clave.length >= 12) puntos++;
  if (/[a-záéíóúñ]/.test(clave) && /[A-ZÁÉÍÓÚÑ]/.test(clave)) puntos++;
  if (/\d/.test(clave)) puntos++;
  if (/[^A-Za-z0-9ÁÉÍÓÚáéíóúÑñ]/.test(clave)) puntos++;
  return Math.max(1, Math.min(4, puntos));
}

const TEXTOS = ['', 'Débil', 'Aceptable', 'Buena', 'Fuerte'];

/**
 * Indicador visual de la fortaleza de una contraseña.
 * Recibe la clave con input() y avisa al padre cada cambio de nivel con output().
 */
@Component({
  selector: 'app-fortaleza-clave',
  templateUrl: './fortaleza-clave.html',
  styleUrl: './fortaleza-clave.scss',
})
export class FortalezaClave {
  clave = input('');
  nivelCambio = output<number>();

  nivel = computed(() => nivelClave(this.clave()));
  texto = computed(() => TEXTOS[this.nivel()]);
  segmentos = [1, 2, 3, 4];

  constructor() {
    effect(() => this.nivelCambio.emit(this.nivel()));
  }
}
