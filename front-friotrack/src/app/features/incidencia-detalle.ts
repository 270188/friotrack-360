import { Component, OnInit, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Api } from '../core/api';
import { Auth } from '../core/auth';
import { accion, carga } from '../core/carga';
import { etiqueta, limpiar } from '../core/format';
import { EtiquetaPipe, FechaHoraPipe } from '../core/pipes';
import { PRIORIDADES, TIPOS_INCIDENCIA, type EstadoIncidencia, type Evidencia, type Incidencia, type Usuario } from '../core/types';
import { ListaEvidencias } from '../shared/dominio';
import { Alerta, Cargando, Insignia, Modal } from '../shared/ui';

const TRANSICIONES: Record<EstadoIncidencia, EstadoIncidencia[]> = {
  ABIERTA: ['EN_PROCESO', 'RESUELTA', 'CERRADA'],
  EN_PROCESO: ['RESUELTA', 'CERRADA'],
  RESUELTA: ['CERRADA', 'EN_PROCESO'],
  CERRADA: [],
};
const CICLO: EstadoIncidencia[] = ['ABIERTA', 'EN_PROCESO', 'RESUELTA', 'CERRADA'];

/** Texto del botón para pasar de `actual` a `nuevo`. */
function textoAccion(actual: EstadoIncidencia, nuevo: EstadoIncidencia): string {
  if (nuevo === 'EN_PROCESO') return actual === 'RESUELTA' ? 'Reabrir' : 'Iniciar atención';
  const textos: Partial<Record<EstadoIncidencia, string>> = { ABIERTA: 'Reabrir', RESUELTA: 'Marcar resuelta', CERRADA: 'Cerrar' };
  return textos[nuevo] ?? etiqueta(nuevo);
}

// ---------------------------------------------------------------------------
// Cambio de estado: exige causa raíz para resolver o cerrar
// ---------------------------------------------------------------------------
@Component({
  selector: 'app-cambio-estado',
  imports: [FormsModule, Modal, Alerta, EtiquetaPipe],
  template: `
    <app-modal [titulo]="titulo()" (cerrar)="cerrar.emit()">
      <form class="space-y-4" (ngSubmit)="guardar()">
        @if (a.error()) { <app-alerta>{{ a.error() }}</app-alerta> }
        <p class="text-sm text-ink-700">Estado: <b>{{ inc().estado | etiqueta }}</b> → <b>{{ estado() | etiqueta }}</b></p>
        <label class="block"><span class="etiqueta">{{ exigeCausa() ? 'Causa raíz (obligatoria)' : 'Causa raíz' }}</span>
          <textarea class="campo min-h-20" name="causa" maxlength="4000" [required]="exigeCausa()" [(ngModel)]="f.causa"></textarea>
        </label>
        <label class="block"><span class="etiqueta">Acción correctiva</span>
          <textarea class="campo min-h-20" name="accion" maxlength="4000" [(ngModel)]="f.accion"></textarea>
        </label>
        <label class="block"><span class="etiqueta">Responsable</span>
          <select class="campo" name="resp" [(ngModel)]="f.id_responsable">
            <option value="">Sin cambios</option>
            @for (u of responsables(); track u.id_usuario) { <option [value]="'' + u.id_usuario">{{ u.nombre }} {{ u.apellido }} ({{ u.username }})</option> }
          </select>
        </label>
        <label class="block"><span class="etiqueta">Comentario (opcional)</span>
          <input class="campo" name="motivo" maxlength="500" [(ngModel)]="f.motivo" />
          <span class="mt-1 block text-xs text-ink-500">Se registra en el historial del lote.</span>
        </label>
        <div class="flex justify-end gap-2">
          <button type="button" class="btn btn-secundario" (click)="cerrar.emit()">Cancelar</button>
          <button type="submit" class="btn" [class]="exigeCausa() ? 'btn-exito' : 'btn-primario'" [disabled]="a.enviando() || (exigeCausa() && !f.causa.trim())">
            @if (a.enviando()) { <span class="spinner"></span> } Confirmar
          </button>
        </div>
      </form>
    </app-modal>`,
})
export class CambioEstado implements OnInit {
  private api = inject(Api);
  inc = input.required<Incidencia>();
  estado = input.required<EstadoIncidencia>();
  responsables = input<Usuario[]>([]);
  cerrar = output<void>();
  guardado = output<void>();
  a = accion();
  f = { causa: '', accion: '', id_responsable: '', motivo: '' };
  exigeCausa = computed(() => this.estado() === 'RESUELTA' || this.estado() === 'CERRADA');
  titulo = computed(() => `${textoAccion(this.inc().estado, this.estado())} · #${this.inc().id_incidencia}`);

  ngOnInit(): void {
    const i = this.inc();
    this.f = { causa: i.causa ?? '', accion: i.accion ?? '', id_responsable: i.id_responsable ? String(i.id_responsable) : '', motivo: '' };
  }

  async guardar(): Promise<void> {
    const r = await this.a.ejecutar(() =>
      this.api.patch<Incidencia>(`/api/incidencia/${this.inc().id_incidencia}/estado`, {
        estado: this.estado(),
        causa: this.f.causa.trim() || null,
        accion: this.f.accion.trim() || null,
        id_responsable: this.f.id_responsable ? Number(this.f.id_responsable) : null,
        motivo: this.f.motivo.trim() || null,
      }),
    );
    if (r) this.guardado.emit();
  }
}

// ---------------------------------------------------------------------------
// Edición de la incidencia
// ---------------------------------------------------------------------------
@Component({
  selector: 'app-editar-incidencia',
  imports: [FormsModule, Modal, Alerta, EtiquetaPipe],
  template: `
    <app-modal [titulo]="'Editar incidencia #' + inc().id_incidencia" (cerrar)="cerrar.emit()">
      <form class="grid-form" (ngSubmit)="guardar()">
        @if (a.error()) { <app-alerta class="col-completa">{{ a.error() }}</app-alerta> }
        <label class="block"><span class="etiqueta">Tipo</span>
          <select class="campo" name="tipo" [(ngModel)]="f.tipo">@for (t of tipos; track t) { <option [value]="t">{{ t | etiqueta }}</option> }</select>
        </label>
        <label class="block"><span class="etiqueta">Prioridad</span>
          <select class="campo" name="prioridad" [(ngModel)]="f.prioridad">@for (p of prioridades; track p) { <option [value]="p">{{ p | etiqueta }}</option> }</select>
        </label>
        <label class="col-completa block"><span class="etiqueta">Descripción</span>
          <textarea class="campo min-h-20" name="desc" maxlength="4000" [(ngModel)]="f.descripcion"></textarea>
        </label>
        <label class="col-completa block"><span class="etiqueta">Causa raíz</span>
          <textarea class="campo min-h-16" name="causa" maxlength="4000" [(ngModel)]="f.causa"></textarea>
        </label>
        <label class="col-completa block"><span class="etiqueta">Acción correctiva</span>
          <textarea class="campo min-h-16" name="accion" maxlength="4000" [(ngModel)]="f.accion"></textarea>
        </label>
        <label class="col-completa block"><span class="etiqueta">Responsable</span>
          <select class="campo" name="resp" [(ngModel)]="f.id_responsable">
            <option value="">—</option>
            @for (u of responsables(); track u.id_usuario) { <option [value]="'' + u.id_usuario">{{ u.nombre }} {{ u.apellido }} ({{ u.username }})</option> }
          </select>
        </label>
        <div class="acciones-form">
          <button type="button" class="btn btn-secundario" (click)="cerrar.emit()">Cancelar</button>
          <button type="submit" class="btn btn-primario" [disabled]="a.enviando()">@if (a.enviando()) { <span class="spinner"></span> } Guardar</button>
        </div>
      </form>
    </app-modal>`,
})
export class EditarIncidencia implements OnInit {
  private api = inject(Api);
  inc = input.required<Incidencia>();
  responsables = input<Usuario[]>([]);
  cerrar = output<void>();
  guardado = output<void>();
  a = accion();
  tipos = TIPOS_INCIDENCIA;
  prioridades = PRIORIDADES;
  f = { tipo: '', prioridad: '', descripcion: '', causa: '', accion: '', id_responsable: '' };

  ngOnInit(): void {
    const i = this.inc();
    this.f = {
      tipo: i.tipo,
      prioridad: i.prioridad,
      descripcion: i.descripcion,
      causa: i.causa ?? '',
      accion: i.accion ?? '',
      id_responsable: i.id_responsable ? String(i.id_responsable) : '',
    };
  }

  async guardar(): Promise<void> {
    const r = await this.a.ejecutar(() =>
      this.api.put<Incidencia>(
        `/api/incidencia/${this.inc().id_incidencia}`,
        limpiar({ ...this.f, id_responsable: this.f.id_responsable ? Number(this.f.id_responsable) : null }),
      ),
    );
    if (r) this.guardado.emit();
  }
}

// ---------------------------------------------------------------------------
// Nueva evidencia
// ---------------------------------------------------------------------------
@Component({
  selector: 'app-nueva-evidencia',
  imports: [FormsModule, Modal, Alerta, EtiquetaPipe],
  template: `
    <app-modal titulo="Adjuntar evidencia" (cerrar)="cerrar.emit()">
      <form class="space-y-4" (ngSubmit)="guardar()">
        @if (a.error()) { <app-alerta>{{ a.error() }}</app-alerta> }
        <div class="grid gap-4 sm:grid-cols-2">
          <label class="block"><span class="etiqueta">Tipo</span>
            <select class="campo" name="tipo" [(ngModel)]="f.tipo">@for (t of tipos; track t) { <option [value]="t">{{ t | etiqueta }}</option> }</select>
          </label>
          <label class="block"><span class="etiqueta">Nombre del archivo</span>
            <input class="campo" name="nombre" required maxlength="255" placeholder="foto_termometro.jpg" [(ngModel)]="f.nombre_archivo" />
          </label>
        </div>
        <label class="block"><span class="etiqueta">URL o ubicación</span>
          <input class="campo" type="url" name="url" maxlength="500" placeholder="https://…" [(ngModel)]="f.url" />
          <span class="mt-1 block text-xs text-ink-500">Enlace verificable al archivo (repositorio, nube, etc.).</span>
        </label>
        <label class="block"><span class="etiqueta">Descripción</span>
          <textarea class="campo min-h-16" name="desc" maxlength="500" [(ngModel)]="f.descripcion"></textarea>
        </label>
        <div class="flex justify-end gap-2">
          <button type="button" class="btn btn-secundario" (click)="cerrar.emit()">Cancelar</button>
          <button type="submit" class="btn btn-primario" [disabled]="a.enviando() || !f.nombre_archivo.trim()">@if (a.enviando()) { <span class="spinner"></span> } Adjuntar</button>
        </div>
      </form>
    </app-modal>`,
})
export class NuevaEvidencia {
  private api = inject(Api);
  idIncidencia = input.required<number>();
  cerrar = output<void>();
  guardado = output<void>();
  a = accion();
  tipos = ['FOTO', 'DOCUMENTO', 'REPORTE', 'REGISTRO_SENSOR', 'OTRO'];
  f = { tipo: 'FOTO', nombre_archivo: '', url: '', descripcion: '' };

  async guardar(): Promise<void> {
    const r = await this.a.ejecutar(() => this.api.post<Evidencia>(`/api/incidencia/${this.idIncidencia()}/evidencias`, limpiar({ ...this.f })));
    if (r) this.guardado.emit();
  }
}

// ---------------------------------------------------------------------------
// Página de detalle
// ---------------------------------------------------------------------------
@Component({
  selector: 'app-incidencia-detalle',
  imports: [RouterLink, Alerta, Cargando, Insignia, ListaEvidencias, CambioEstado, EditarIncidencia, NuevaEvidencia, EtiquetaPipe, FechaHoraPipe],
  template: `
    @if (inc.error()) { <app-alerta>{{ inc.error() }}</app-alerta> }
    @if (!inc.data() && !inc.error()) { <app-cargando /> }
    @if (inc.data(); as i) {
      <header class="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div class="min-w-0">
          <a routerLink="/incidencias" class="mb-1 block text-xs font-medium text-ink-500 hover:underline">← Incidencias</a>
          <h1 class="flex flex-wrap items-center gap-3 text-2xl font-bold tracking-tight text-ink-900">
            Incidencia #{{ i.id_incidencia }} <app-insignia [valor]="i.estado" /> <app-insignia [valor]="i.prioridad" />
          </h1>
          <p class="mt-1 text-sm text-ink-700">{{ i.tipo | etiqueta }} · registrada {{ i.fecha_creacion | fechaHora }}</p>
        </div>
        @if (auth.puede('calidad')) {
          <div class="flex flex-wrap items-center gap-2">
            @if (i.estado !== 'CERRADA') { <button class="btn btn-secundario" (click)="editar.set(true)">Editar</button> }
            <button class="btn btn-secundario" (click)="evidencia.set(true)">Adjuntar evidencia</button>
            @for (e of transiciones(); track e) {
              <button class="btn" [class]="e === 'CERRADA' || e === 'RESUELTA' ? 'btn-exito' : 'btn-primario'" (click)="nuevoEstado.set(e)">{{ texto(i.estado, e) }}</button>
            }
          </div>
        }
      </header>
      @if (aviso()) { <app-alerta class="mb-4" tono="ok">{{ aviso() }}</app-alerta> }

      <section class="tarjeta mb-6 px-5 py-5">
        <ol class="grid grid-cols-4 gap-2">
          @for (p of pasos(); track p.estado) {
            <li>
              <div class="h-1.5 rounded-full" [class]="p.hecho ? (i.estado === 'ABIERTA' ? 'bg-alert-500' : 'bg-frost-500') : 'bg-ice-200'"></div>
              <p class="mt-2 text-xs font-semibold sm:text-sm" [class]="p.hecho ? 'text-ink-900' : 'text-ink-500'">{{ p.estado | etiqueta }}</p>
            </li>
          }
        </ol>
      </section>

      <div class="grid gap-6 lg:grid-cols-3">
        <section class="tarjeta lg:col-span-2">
          <div class="titulo-seccion"><h2>Detalle de la no conformidad</h2></div>
          <div class="space-y-5 px-5 py-5">
            <dl class="dato"><dt>Descripción</dt><dd class="whitespace-pre-line">{{ i.descripcion }}</dd></dl>
            <div class="grid gap-5 sm:grid-cols-2">
              <dl class="dato rounded-lg p-4" [class]="i.causa ? 'bg-ice-50' : 'bg-warn-50'">
                <dt>Causa raíz</dt>
                <dd class="whitespace-pre-line">@if (i.causa) { {{ i.causa }} } @else { <span class="text-[#a26f00]">Pendiente de registrar</span> }</dd>
              </dl>
              <dl class="dato rounded-lg p-4" [class]="i.accion ? 'bg-ice-50' : 'bg-warn-50'">
                <dt>Acción correctiva</dt>
                <dd class="whitespace-pre-line">@if (i.accion) { {{ i.accion }} } @else { <span class="text-[#a26f00]">Pendiente de registrar</span> }</dd>
              </dl>
            </div>
          </div>
        </section>
        <section class="tarjeta">
          <div class="titulo-seccion"><h2>Contexto</h2></div>
          <dl class="grid grid-cols-2 gap-4 px-5 py-4">
            <div class="dato"><dt>Lote</dt><dd><a class="font-semibold text-frost-600 hover:underline" [routerLink]="['/lotes', i.id_lote]">{{ i.codigo_lote }}</a></dd></div>
            <div class="dato"><dt>Despacho</dt><dd>
              @if (i.id_despacho) { <a class="font-semibold text-frost-600 hover:underline" [routerLink]="['/despachos', i.id_despacho]">{{ i.codigo_despacho }}</a> } @else { — }
            </dd></div>
            <div class="dato"><dt>Origen</dt><dd>{{ i.id_control ? 'Lectura #' + i.id_control + ' (automática)' : 'Registro manual' }}</dd></div>
            <div class="dato"><dt>Responsable</dt><dd>{{ i.username_responsable ?? '—' }}</dd></div>
            <div class="dato"><dt>Cierre</dt><dd>{{ i.fecha_cierre | fechaHora }}</dd></div>
            <div class="dato"><dt>Tiempo de resolución</dt><dd>{{ i.minutos_resolucion != null ? i.minutos_resolucion + ' min' : '—' }}</dd></div>
          </dl>
        </section>
      </div>

      <section class="tarjeta mt-6">
        <div class="titulo-seccion"><h2>Evidencias ({{ i.evidencias.length }})</h2></div>
        <app-lista-evidencias [items]="i.evidencias" />
      </section>

      @if (nuevoEstado(); as e) {
        <app-cambio-estado [inc]="i" [estado]="e" [responsables]="responsables()" (cerrar)="nuevoEstado.set(null)"
          (guardado)="cambiado(e)" />
      }
      @if (editar()) {
        <app-editar-incidencia [inc]="i" [responsables]="responsables()" (cerrar)="editar.set(false)"
          (guardado)="editar.set(false); aviso.set('Incidencia actualizada.'); inc.recargar()" />
      }
      @if (evidencia()) {
        <app-nueva-evidencia [idIncidencia]="i.id_incidencia" (cerrar)="evidencia.set(false)"
          (guardado)="evidencia.set(false); aviso.set('Evidencia adjuntada.'); inc.recargar()" />
      }
    }`,
})
export class IncidenciaDetallePage {
  private api = inject(Api);
  auth = inject(Auth);
  id = input.required<string>();
  aviso = signal<string | null>(null);
  nuevoEstado = signal<EstadoIncidencia | null>(null);
  editar = signal(false);
  evidencia = signal(false);
  texto = textoAccion;

  inc = carga(() => this.api.get<Incidencia>(`/api/incidencia/${this.id()}`), { inmediato: false });
  usuarios = carga(() => this.api.get<Usuario[]>('/api/usuario/activos'));
  responsables = computed(() => (this.usuarios.data() ?? []).filter((u) => u.rol === 'CALIDAD' || u.rol === 'ADMIN'));
  transiciones = computed(() => TRANSICIONES[this.inc.data()?.estado ?? 'CERRADA']);
  pasos = computed(() => {
    const actual = CICLO.indexOf(this.inc.data()?.estado ?? 'ABIERTA');
    return CICLO.map((estado, i) => ({ estado, hecho: i <= actual }));
  });

  constructor() {
    effect(() => {
      this.id();
      untracked(() => {
        this.aviso.set(null);
        void this.inc.recargar();
      });
    });
  }

  cambiado(e: EstadoIncidencia): void {
    this.nuevoEstado.set(null);
    this.aviso.set(`Incidencia actualizada a ${etiqueta(e)}.`);
    void this.inc.recargar();
  }
}
