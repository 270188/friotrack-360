import { Component, computed, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Api, ApiError, mensajeError } from '../../core/api';
import { Auth } from '../../core/auth';
import { carga } from '../../core/carga';
import type { ConCambiosPendientes } from '../../core/guards';
import { Notificaciones } from '../../core/notificaciones';
import { FechaPipe, EtiquetaPipe } from '../../core/pipes';
import type { Usuario } from '../../core/types';
import { claveSegura, coinciden, distintos, mensajeCampo } from '../../core/validadores';
import { FortalezaClave } from '../../shared/fortaleza-clave/fortaleza-clave';
import { Alerta, Cargando } from '../../shared/ui';

/**
 * Perfil del usuario y cambio de su propia contraseña.
 * Formulario reactivo con validadores de Angular y propios (de campo y de grupo).
 */
@Component({
  selector: 'app-mi-cuenta',
  imports: [ReactiveFormsModule, Alerta, Cargando, FortalezaClave, FechaPipe, EtiquetaPipe],
  templateUrl: './mi-cuenta.html',
  styleUrl: './mi-cuenta.scss',
})
export class MiCuenta implements ConCambiosPendientes {
  private api = inject(Api);
  private fb = inject(NonNullableFormBuilder);
  private avisos = inject(Notificaciones);
  auth = inject(Auth);

  perfil = carga(() => this.api.get<Usuario>('/api/auth/me'));
  iniciales = computed(() => {
    const p = this.perfil.data();
    return p ? (p.nombre.charAt(0) + p.apellido.charAt(0)).toUpperCase() : '';
  });

  form = this.fb.group(
    {
      actual: ['', [Validators.required]],
      nueva: ['', [Validators.required, Validators.minLength(8), Validators.maxLength(64), claveSegura()]],
      confirmar: ['', [Validators.required]],
    },
    { validators: [coinciden('nueva', 'confirmar'), distintos('nueva', 'actual')] },
  );

  mostrar = signal(false);
  enviando = signal(false);
  error = signal<string | null>(null);
  nivel = signal(0);

  /** Mensaje de error de un campo (o del grupo, para la confirmación y la nueva clave). */
  mensaje(campo: 'actual' | 'nueva' | 'confirmar'): string | null {
    const c = this.form.controls[campo];
    const propio = mensajeCampo(c, campo === 'nueva' ? 'La contraseña' : 'Este campo');
    if (propio) return propio;
    if (campo === 'confirmar' && this.form.hasError('noCoinciden') && c.touched) return 'No coincide con la nueva contraseña.';
    if (campo === 'nueva' && this.form.hasError('iguales') && c.touched) return 'Debe ser distinta de la contraseña actual.';
    return null;
  }

  async guardar(): Promise<void> {
    this.error.set(null);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const { actual, nueva } = this.form.getRawValue();
    this.enviando.set(true);
    this.form.disable();
    try {
      await this.api.patch<Usuario>('/api/auth/password', { password_actual: actual, password_nuevo: nueva });
      this.form.enable();
      this.form.reset();
      this.avisos.ok('Contraseña actualizada. Úsala la próxima vez que inicies sesión.');
    } catch (e) {
      this.form.enable();
      if (e instanceof ApiError && /actual no es correcta/i.test(e.message)) {
        // Error del servidor asociado a un campo concreto.
        this.form.controls.actual.setErrors({ servidor: e.message });
        this.form.controls.actual.markAsTouched();
      } else {
        this.error.set(mensajeError(e));
      }
    } finally {
      this.enviando.set(false);
    }
  }

  tieneCambiosPendientes(): boolean {
    return this.form.dirty && !this.enviando();
  }
}
