import { HttpInterceptorFn } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { tap } from 'rxjs';
import { Api } from './api';
import { urlApi } from './config';
import type { Credenciales, Rol } from './types';

export interface Sesion extends Credenciales {
  expira_en: number; // epoch ms
}

/**
 * Permisos de la interfaz. Reflejan SecurityConfig del backend
 * (el backend sigue siendo quien decide: aquí solo se ocultan acciones no permitidas).
 */
export type Permiso = 'escribir' | 'calidad' | 'productos' | 'usuarios';
const MATRIZ: Record<Permiso, Rol[]> = {
  escribir: ['ADMIN', 'OPERADOR', 'CALIDAD'],
  calidad: ['ADMIN', 'CALIDAD'],
  productos: ['ADMIN'],
  usuarios: ['ADMIN'],
};

const CLAVE = 'friotrack.session';

function leer(): Sesion | null {
  try {
    const raw = localStorage.getItem(CLAVE);
    if (!raw) return null;
    const s = JSON.parse(raw) as Sesion;
    if (!s.token || Date.now() >= s.expira_en) {
      localStorage.removeItem(CLAVE);
      return null;
    }
    return s;
  } catch {
    return null;
  }
}

@Injectable({ providedIn: 'root' })
export class Auth {
  private api = inject(Api);
  private router = inject(Router);
  readonly sesion = signal<Sesion | null>(leer());
  readonly rol = computed(() => this.sesion()?.rol ?? null);

  puede(p: Permiso): boolean {
    const r = this.rol();
    return !!r && MATRIZ[p].includes(r);
  }

  token(): string | null {
    const s = this.sesion();
    if (s && Date.now() >= s.expira_en) {
      this.limpiar();
      return null;
    }
    return s?.token ?? null;
  }

  async login(username: string, password: string): Promise<void> {
    const c = await this.api.post<Credenciales>('/api/auth/login', { username, password });
    const s: Sesion = { ...c, expira_en: Date.now() + (c.expira_en_segundos || 7200) * 1000 };
    try {
      localStorage.setItem(CLAVE, JSON.stringify(s));
    } catch {
      /* almacenamiento no disponible: la sesión vive solo en memoria */
    }
    this.sesion.set(s);
  }

  logout(): void {
    this.limpiar();
    this.router.navigate(['/login']);
  }

  /** Sesión vencida o rechazada por el backend (401). */
  expirar(): void {
    if (!this.sesion()) return;
    this.limpiar();
    this.router.navigate(['/login'], { queryParams: { volver: this.router.url } });
  }

  private limpiar(): void {
    try {
      localStorage.removeItem(CLAVE);
    } catch {
      /* noop */
    }
    this.sesion.set(null);
  }
}

/** Agrega el token JWT a las llamadas al backend y cierra la sesión si el backend responde 401. */
export const jwtInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(Auth);
  const esApi = req.url.startsWith(urlApi());
  const esLogin = req.url.endsWith('/api/auth/login');
  const token = esApi && !esLogin ? auth.token() : null;
  const r = token ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req;
  return next(r).pipe(
    tap({
      error: (e: { status?: number }) => {
        if (esApi && !esLogin && e?.status === 401) auth.expirar();
      },
    }),
  );
};

export const authGuard: CanActivateFn = (_route, state) => {
  const auth = inject(Auth);
  return auth.token() ? true : inject(Router).createUrlTree(['/login'], { queryParams: { volver: state.url } });
};

export const invitadoGuard: CanActivateFn = () => {
  const auth = inject(Auth);
  return auth.token() ? inject(Router).createUrlTree(['/dashboard']) : true;
};

export function permisoGuard(p: Permiso): CanActivateFn {
  return () => {
    const auth = inject(Auth);
    return auth.puede(p) ? true : inject(Router).createUrlTree(['/dashboard']);
  };
}
