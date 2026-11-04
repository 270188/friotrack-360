import { Component, OnInit, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Api, mensajeError } from '../core/api';
import { Auth } from '../core/auth';
import { accion, carga } from '../core/carga';
import { EtiquetaPipe, FechaPipe } from '../core/pipes';
import { ROLES, type Rol, type Usuario } from '../core/types';
import { Alerta, Cargando, Icono, Insignia, Modal, Paginacion, Vacio } from '../shared/ui';

@Component({
  selector: 'app-form-usuario',
  imports: [FormsModule, Modal, Alerta, EtiquetaPipe],
  template: `
    <app-modal [titulo]="usuario() ? 'Editar ' + usuario()!.username : 'Nuevo usuario'" (cerrar)="cerrar.emit()">
      <form class="grid-form" (ngSubmit)="guardar()">
        @if (a.error()) { <app-alerta class="col-completa">{{ a.error() }}</app-alerta> }
        <label class="block"><span class="etiqueta">Nombre</span><input class="campo" name="nombre" required maxlength="100" [(ngModel)]="f.nombre" /></label>
        <label class="block"><span class="etiqueta">Apellido</span><input class="campo" name="apellido" required maxlength="100" [(ngModel)]="f.apellido" /></label>
        <label class="block"><span class="etiqueta">Usuario</span>
          <input class="campo" name="username" required maxlength="80" autocomplete="off" [disabled]="!!usuario()" [(ngModel)]="f.username" />
        </label>
        <label class="block"><span class="etiqueta">Rol</span>
          <select class="campo" name="rol" [(ngModel)]="f.rol">@for (r of roles; track r) { <option [value]="r">{{ r | etiqueta }}</option> }</select>
        </label>
        @if (!usuario()) {
          <label class="col-completa block"><span class="etiqueta">Contraseña</span>
            <input type="password" class="campo" name="password" required minlength="8" maxlength="255" autocomplete="new-password" [(ngModel)]="f.password" />
            <span class="mt-1 block text-xs text-ink-500">Mínimo 8 caracteres.</span>
          </label>
        }
        <label class="col-completa flex items-center gap-2 text-sm text-ink-800">
          <input type="checkbox" class="size-4 accent-frost-500" name="activo" [(ngModel)]="f.activo" /> Usuario activo
        </label>
        <div class="acciones-form">
          <button type="button" class="btn btn-secundario" (click)="cerrar.emit()">Cancelar</button>
          <button type="submit" class="btn btn-primario" [disabled]="a.enviando()">@if (a.enviando()) { <span class="spinner"></span> } Guardar</button>
        </div>
      </form>
    </app-modal>`,
})
export class FormUsuario implements OnInit {
  private api = inject(Api);
  usuario = input<Usuario | null>(null);
  cerrar = output<void>();
  guardado = output<Usuario>();
  a = accion();
  roles = ROLES;
  f = { nombre: '', apellido: '', username: '', password: '', rol: 'OPERADOR' as Rol, activo: true };

  ngOnInit(): void {
    const u = this.usuario();
    if (u) this.f = { nombre: u.nombre, apellido: u.apellido, username: u.username, password: '', rol: u.rol, activo: u.activo };
  }

  async guardar(): Promise<void> {
    const u = this.usuario();
    const r = await this.a.ejecutar(() =>
      u
        ? this.api.put<Usuario>(`/api/usuario/${u.id_usuario}`, { nombre: this.f.nombre, apellido: this.f.apellido, rol: this.f.rol, activo: this.f.activo })
        : this.api.post<Usuario>('/api/usuario', { ...this.f, username: this.f.username.trim() }),
    );
    if (r) this.guardado.emit(r);
  }
}

const DESCRIPCION_ROL: Record<Rol, string> = {
  ADMIN: 'Todo, incluidos usuarios y umbrales.',
  OPERADOR: 'Registra lotes, despachos, controles y eventos.',
  CALIDAD: 'Lo del operador + incidencias, bloqueo y liberación de lotes.',
  SUPERVISOR: 'Solo lectura: panel, trazabilidad e historial.',
};

@Component({
  selector: 'app-usuarios',
  imports: [Alerta, Cargando, Icono, Insignia, Paginacion, Vacio, FormUsuario, EtiquetaPipe, FechaPipe],
  template: `
    <header class="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 class="text-2xl font-bold tracking-tight text-ink-900">Usuarios</h1>
        <p class="mt-1 text-sm text-ink-700">Control de acceso por roles (RBAC). Cada operación crítica queda firmada con el usuario que la realizó.</p>
      </div>
      <button class="btn btn-primario" (click)="form.set('nuevo')"><app-icono nombre="mas" clase="size-4" /> Nuevo usuario</button>
    </header>
    @if (aviso(); as av) { <app-alerta class="mb-4" [tono]="av.t">{{ av.m }}</app-alerta> }

    <div class="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      @for (r of roles; track r) {
        <div class="rounded-xl bg-white p-4 ring-1 ring-ink-300/40">
          <p class="text-sm font-bold text-ink-900">{{ r | etiqueta }}</p>
          <p class="mt-1 text-xs text-ink-700">{{ descripcion[r] }}</p>
        </div>
      }
    </div>

    <section class="tarjeta">
      @if (lista.error()) { <div class="p-4"><app-alerta>{{ lista.error() }}</app-alerta></div> }
      @if (lista.cargando() && !lista.data()) { <app-cargando /> }
      @if (lista.data(); as p) {
        @if (p.content.length === 0) {
          <app-vacio titulo="No hay usuarios" />
        } @else {
          <div class="tabla-wrap">
            <table class="tabla">
              <thead><tr><th>Usuario</th><th>Nombre</th><th>Rol</th><th>Estado</th><th>Alta</th><th></th></tr></thead>
              <tbody>
                @for (u of p.content; track u.id_usuario) {
                  <tr class="hover:bg-ice-50">
                    <td class="font-semibold text-ink-900">{{ u.username }}</td>
                    <td>{{ u.nombre }} {{ u.apellido }}</td>
                    <td><app-insignia tono="info" [texto]="u.rol | etiqueta" /></td>
                    <td><app-insignia [valor]="u.activo ? 'ACTIVO' : 'INACTIVO'" /></td>
                    <td>{{ u.fecha_creacion | fecha }}</td>
                    <td class="text-right whitespace-nowrap">
                      <button class="btn btn-fantasma btn-sm" (click)="form.set(u)">Editar</button>
                      @if (u.id_usuario !== miId) {
                        <button class="btn btn-fantasma btn-sm" (click)="alternar(u)">{{ u.activo ? 'Desactivar' : 'Activar' }}</button>
                      }
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
          <app-paginacion [pagina]="pagina()" [totalPaginas]="p.totalPages" [total]="p.totalElements" (cambiar)="pagina.set($event); lista.recargar()" />
        }
      }
    </section>

    @if (form(); as fm) {
      <app-form-usuario [usuario]="fm === 'nuevo' ? null : fm" (cerrar)="form.set(null)" (guardado)="guardado($event)" />
    }`,
})
export class UsuariosPage {
  private api = inject(Api);
  miId = inject(Auth).sesion()?.id_usuario;
  roles = ROLES;
  descripcion = DESCRIPCION_ROL;
  pagina = signal(0);
  form = signal<Usuario | 'nuevo' | null>(null);
  aviso = signal<{ t: 'ok' | 'alerta'; m: string } | null>(null);
  lista = carga(() => this.api.pagina<Usuario>('/api/usuario', { page: this.pagina(), size: 20, sort: 'idUsuario,asc' }));

  guardado(u: Usuario): void {
    this.form.set(null);
    this.aviso.set({ t: 'ok', m: `Usuario ${u.username} guardado.` });
    void this.lista.recargar();
  }
  async alternar(u: Usuario): Promise<void> {
    try {
      if (u.activo) await this.api.del(`/api/usuario/${u.id_usuario}`);
      else await this.api.patch(`/api/usuario/${u.id_usuario}/activar`);
      this.aviso.set({ t: 'ok', m: `Usuario ${u.username} ${u.activo ? 'desactivado' : 'activado'}.` });
      void this.lista.recargar();
    } catch (e) {
      this.aviso.set({ t: 'alerta', m: mensajeError(e) });
    }
  }
}
