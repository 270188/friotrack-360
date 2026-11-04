import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { Api, ApiError, mensajeError, normalizarPagina } from './api';
import { Auth, jwtInterceptor } from './auth';

describe('normalizarPagina', () => {
  it('acepta PagedModel (content + page) en snake_case', () => {
    const p = normalizarPagina<number>({ content: [1, 2], page: { size: 2, number: 0, total_elements: 5, total_pages: 3 } });
    expect(p).toEqual({ content: [1, 2], totalElements: 5, totalPages: 3, number: 0, size: 2 });
  });
  it('acepta PageImpl directo', () => {
    const p = normalizarPagina<number>({ content: [1], total_elements: 1, total_pages: 1, number: 0, size: 20 });
    expect(p.totalElements).toBe(1);
    expect(p.size).toBe(20);
  });
});

describe('mensajeError', () => {
  it('incluye los errores por campo del backend', () => {
    expect(mensajeError(new ApiError(400, 'Error de validacion', { codigo_lote: 'no debe estar vacío' }))).toBe(
      'Error de validacion: codigo lote no debe estar vacío',
    );
  });
});

describe('Api + interceptor JWT', () => {
  let api: Api;
  let http: HttpTestingController;
  let auth: Auth;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(withInterceptors([jwtInterceptor])), provideHttpClientTesting()],
    });
    api = TestBed.inject(Api);
    http = TestBed.inject(HttpTestingController);
    auth = TestBed.inject(Auth);
  });
  afterEach(() => http.verify());

  async function iniciarSesion(rol = 'CALIDAD') {
    const p = auth.login('calidad', 'secreto123');
    http.expectOne('http://localhost:8080/api/auth/login').flush({
      token: 'abc', tipo: 'Bearer', id_usuario: 2, username: 'calidad', rol, expira_en_segundos: 7200,
    });
    await p;
  }

  it('guarda la sesión y envía el token en las siguientes llamadas', async () => {
    await iniciarSesion();
    expect(auth.sesion()?.username).toBe('calidad');
    const p = api.get('/api/lote', { estado: 'DISPONIBLE', q: '' });
    const req = http.expectOne((r) => r.url === 'http://localhost:8080/api/lote');
    expect(req.request.headers.get('Authorization')).toBe('Bearer abc');
    expect(req.request.params.get('estado')).toBe('DISPONIBLE');
    expect(req.request.params.has('q')).toBe(false); // los filtros vacíos no se envían
    req.flush({ content: [] });
    await p;
  });

  it('no envía token al login', async () => {
    await iniciarSesion();
    const p = auth.login('admin', 'admin123');
    const req = http.expectOne('http://localhost:8080/api/auth/login');
    expect(req.request.headers.has('Authorization')).toBe(false);
    req.flush({ token: 'x', tipo: 'Bearer', id_usuario: 1, username: 'admin', rol: 'ADMIN', expira_en_segundos: 10 });
    await p;
  });

  it('traduce el error uniforme del backend', async () => {
    await iniciarSesion();
    const p = api.patch('/api/lote/3/liberar');
    http.expectOne('http://localhost:8080/api/lote/3/liberar').flush(
      { status: 422, mensaje: 'El lote LOT-1 no esta bloqueado' },
      { status: 422, statusText: 'Unprocessable Entity' },
    );
    await expect(p).rejects.toMatchObject({ status: 422, message: 'El lote LOT-1 no esta bloqueado' });
  });

  it('cierra la sesión y vuelve al login cuando el backend responde 401', async () => {
    await iniciarSesion();
    const router = TestBed.inject(Router);
    const nav = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    const p = api.get('/api/dashboard');
    http.expectOne('http://localhost:8080/api/dashboard').flush({ mensaje: 'Token vencido' }, { status: 401, statusText: 'Unauthorized' });
    await expect(p).rejects.toBeInstanceOf(ApiError);
    expect(auth.sesion()).toBeNull();
    expect(nav).toHaveBeenCalledWith(['/login'], expect.anything());
  });
});

describe('permisos por rol (reflejan SecurityConfig)', () => {
  const casos: [string, Record<string, boolean>][] = [
    ['ADMIN', { escribir: true, calidad: true, productos: true, usuarios: true }],
    ['CALIDAD', { escribir: true, calidad: true, productos: false, usuarios: false }],
    ['OPERADOR', { escribir: true, calidad: false, productos: false, usuarios: false }],
    ['SUPERVISOR', { escribir: false, calidad: false, productos: false, usuarios: false }],
  ];
  for (const [rol, esperado] of casos) {
    it(rol, () => {
      TestBed.configureTestingModule({ providers: [provideRouter([]), provideHttpClient()] });
      const auth = TestBed.inject(Auth);
      auth.sesion.set({ token: 't', tipo: 'Bearer', id_usuario: 1, username: 'u', rol: rol as never, expira_en_segundos: 60, expira_en: Date.now() + 60000 });
      for (const [p, v] of Object.entries(esperado)) expect(auth.puede(p as never)).toBe(v);
    });
  }
});
