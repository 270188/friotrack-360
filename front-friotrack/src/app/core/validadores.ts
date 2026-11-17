// Validadores propios para formularios reactivos y los mensajes que se muestran bajo cada campo.
import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

const vacio = (v: unknown) => v === null || v === undefined || (typeof v === 'string' && v.trim() === '');

/** Contraseña segura: al menos una letra y un número (el largo se valida con Validators.minLength). */
export function claveSegura(): ValidatorFn {
  return (c: AbstractControl): ValidationErrors | null => {
    const v = String(c.value ?? '');
    if (!v) return null;
    return /[A-Za-zÁÉÍÓÚáéíóúÑñ]/.test(v) && /\d/.test(v) ? null : { claveSegura: true };
  };
}

/** Validador de grupo: dos campos deben coincidir (por ejemplo, la contraseña y su confirmación). */
export function coinciden(campo: string, confirmacion: string): ValidatorFn {
  return (g: AbstractControl): ValidationErrors | null => {
    const a = g.get(campo)?.value;
    const b = g.get(confirmacion)?.value;
    return vacio(b) || a === b ? null : { noCoinciden: true };
  };
}

/** Validador de grupo: dos campos deben ser distintos (la nueva contraseña no puede ser la actual). */
export function distintos(campo: string, otro: string): ValidatorFn {
  return (g: AbstractControl): ValidationErrors | null => {
    const a = g.get(campo)?.value;
    const b = g.get(otro)?.value;
    return vacio(a) || vacio(b) || a !== b ? null : { iguales: true };
  };
}

/**
 * Validador de grupo: si se llenan ambos límites, el mínimo debe ser menor que el máximo.
 * Devuelve un error con el nombre del par, por ejemplo { rangoTemperatura: true }.
 */
export function rangoValido(min: string, max: string, nombre: string): ValidatorFn {
  return (g: AbstractControl): ValidationErrors | null => {
    const a = g.get(min)?.value;
    const b = g.get(max)?.value;
    if (vacio(a) || vacio(b)) return null;
    return Number(a) < Number(b) ? null : { [nombre]: true };
  };
}

/** Documento peruano: 8 dígitos (DNI) u 11 dígitos que empiezan con 10, 15, 17 o 20 (RUC). */
export function documentoPeruano(tipo: 'DNI' | 'RUC'): ValidatorFn {
  return (c: AbstractControl): ValidationErrors | null => {
    const v = String(c.value ?? '').trim();
    if (!v) return null;
    if (tipo === 'DNI') return /^\d{8}$/.test(v) ? null : { dni: true };
    return /^(10|15|17|20)\d{9}$/.test(v) ? null : { ruc: true };
  };
}

/** Primer mensaje de error de un control, listo para mostrar. null si no hay error o aún no se tocó. */
export function mensajeCampo(c: AbstractControl | null, etiqueta = 'Este campo'): string | null {
  if (!c || !c.errors || !(c.touched || c.dirty)) return null;
  const e = c.errors;
  if (e['required']) return 'Completa este campo.';
  if (e['minlength']) return `${etiqueta} debe tener al menos ${e['minlength'].requiredLength} caracteres.`;
  if (e['maxlength']) return `${etiqueta} admite como máximo ${e['maxlength'].requiredLength} caracteres.`;
  if (e['min']) return `${etiqueta} debe ser mayor o igual a ${e['min'].min}.`;
  if (e['max']) return `${etiqueta} debe ser menor o igual a ${e['max'].max}.`;
  if (e['claveSegura']) return 'Usa al menos una letra y un número.';
  if (e['dni']) return 'El DNI debe tener 8 dígitos.';
  if (e['ruc']) return 'El RUC debe tener 11 dígitos y empezar con 10, 15, 17 o 20.';
  if (e['servidor']) return String(e['servidor']);
  return `${etiqueta} no es válido.`;
}
