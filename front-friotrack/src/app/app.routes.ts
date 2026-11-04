import { Routes } from '@angular/router';
import { authGuard, invitadoGuard, permisoGuard } from './core/auth';
import { Shell } from './features/shell';

export const routes: Routes = [
  { path: 'login', canActivate: [invitadoGuard], title: 'Iniciar sesión · FrioTrack 360', loadComponent: () => import('./features/login').then((m) => m.LoginPage) },
  {
    path: '',
    component: Shell,
    canActivate: [authGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      { path: 'dashboard', title: 'Panel · FrioTrack 360', loadComponent: () => import('./features/dashboard').then((m) => m.DashboardPage) },
      { path: 'lotes', title: 'Lotes · FrioTrack 360', loadComponent: () => import('./features/lotes').then((m) => m.LotesPage) },
      { path: 'lotes/:id', title: 'Lote · FrioTrack 360', loadComponent: () => import('./features/lote-detalle').then((m) => m.LoteDetallePage) },
      { path: 'despachos', title: 'Despachos · FrioTrack 360', loadComponent: () => import('./features/despachos').then((m) => m.DespachosPage) },
      { path: 'despachos/:id', title: 'Despacho · FrioTrack 360', loadComponent: () => import('./features/despacho-detalle').then((m) => m.DespachoDetallePage) },
      { path: 'controles', title: 'Controles · FrioTrack 360', loadComponent: () => import('./features/controles').then((m) => m.ControlesPage) },
      { path: 'incidencias', title: 'Incidencias · FrioTrack 360', loadComponent: () => import('./features/incidencias').then((m) => m.IncidenciasPage) },
      { path: 'incidencias/:id', title: 'Incidencia · FrioTrack 360', loadComponent: () => import('./features/incidencia-detalle').then((m) => m.IncidenciaDetallePage) },
      { path: 'trazabilidad', title: 'Trazabilidad · FrioTrack 360', loadComponent: () => import('./features/trazabilidad').then((m) => m.TrazabilidadPage) },
      { path: 'eventos', title: 'Historial · FrioTrack 360', loadComponent: () => import('./features/eventos').then((m) => m.EventosPage) },
      { path: 'productos', title: 'Productos · FrioTrack 360', loadComponent: () => import('./features/productos').then((m) => m.ProductosPage) },
      { path: 'usuarios', title: 'Usuarios · FrioTrack 360', canActivate: [permisoGuard('usuarios')], loadComponent: () => import('./features/usuarios').then((m) => m.UsuariosPage) },
    ],
  },
  { path: '**', title: 'No encontrado · FrioTrack 360', loadComponent: () => import('./features/no-encontrado').then((m) => m.NoEncontradoPage) },
];
