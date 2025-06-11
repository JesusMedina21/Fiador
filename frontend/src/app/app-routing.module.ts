import { NgModule } from '@angular/core';
import { PreloadAllModules, RouterModule, Routes } from '@angular/router';
import { authGuard } from './guards/auth.guard';
import { noauthGuard } from './guards/noauth.guard';
const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/home/home.component').then( m => m.HomeComponent)
  },
  {
    path: 'register',
    loadComponent: () => import('./pages/auth/register/register.component').then( m => m.RegisterComponent),
    canActivate: [authGuard] 
  },
  {
    path: 'login',
    loadComponent: () => import('./pages/auth/login/login.component').then( m => m.LoginComponent),
    canActivate: [authGuard] 
  },
  {
    path: 'products',
    loadComponent: () => import('./pages/producto/producto.component').then( m => m.ProductoComponent),
    canActivate: [noauthGuard] 
  },
  {
    path: 'clients',
    loadComponent: () => import('./pages/cliente/cliente.component').then( m => m.ClienteComponent),
    canActivate: [noauthGuard] 
  },
  {
    path: 'error',
    loadComponent: () => import('./pages/error/error.component').then( m => m.ErrorComponent)
  },
  {
    path: '**',
    redirectTo: 'error'  // Redirige a la página de error para rutas no encontradas
  }
];

@NgModule({
  imports: [
    RouterModule.forRoot(routes, { preloadingStrategy: PreloadAllModules })
  ],
  exports: [RouterModule]
})
export class AppRoutingModule { }
