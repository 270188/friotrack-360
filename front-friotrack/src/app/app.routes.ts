import { Routes } from '@angular/router';
import { authGuard, invitadoGuard, permisoGuard } from './core/auth';
import { Shell } from './features/shell';

export const routes: Routes = [
  { path: 'login', canActivate: [invitadoGuard], title: 'Iniciar sesión', loadComponent: () => import('./features/login').then((m) => m.LoginPage) },
  {
    path: '',
    component: Shell,
    canActivate: [authGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      { path: 'dashboard', title: 'Panel', loadComponent: () => import('./features/dashboard').then((m) => m.DashboardPage) },
      { path: 'lotes', title: 'Lotes', loadComponent: () => import('./features/lotes').then((m) => m.LotesPage) },
      { path: 'lotes/:id', title: 'Lote', loadComponent: () => import('./features/lote-detalle').then((m) => m.LoteDetallePage) },
      { path: 'despachos', title: 'Despachos', loadComponent: () => import('./features/despachos').then((m) => m.DespachosPage) },
      { path: 'despachos/:id', title: 'Despacho', loadComponent: () => import('./features/despacho-detalle').then((m) => m.DespachoDetallePage) },
      { path: 'controles', title: 'Controles', loadComponent: () => import('./features/controles').then((m) => m.ControlesPage) },
      { path: 'incidencias', title: 'Incidencias', loadComponent: () => import('./features/incidencias').then((m) => m.IncidenciasPage) },
      { path: 'incidencias/:id', title: 'Incidencia', loadComponent: () => import('./features/incidencia-detalle').then((m) => m.IncidenciaDetallePage) },
      { path: 'trazabilidad', title: 'Trazabilidad', loadComponent: () => import('./features/trazabilidad').then((m) => m.TrazabilidadPage) },
      { path: 'eventos', title: 'Historial', loadComponent: () => import('./features/eventos').then((m) => m.EventosPage) },
      { path: 'productos', title: 'Productos', loadComponent: () => import('./features/productos').then((m) => m.ProductosPage) },
      { path: 'usuarios', title: 'Usuarios', canActivate: [permisoGuard('usuarios')], loadComponent: () => import('./features/usuarios').then((m) => m.UsuariosPage) },
    ],
  },
  { path: '**', title: 'No encontrado', loadComponent: () => import('./features/no-encontrado').then((m) => m.NoEncontradoPage) },
];
