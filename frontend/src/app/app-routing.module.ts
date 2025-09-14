import { NgModule } from '@angular/core';
import { PreloadAllModules, RouterModule, Routes } from '@angular/router';
import { authGuard } from './guards/auth.guard';
import { noauthGuard } from './guards/noauth.guard';
const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/home/home.component').then(m => m.HomeComponent)
  },
  {
    path: 'register',
    loadComponent: () => import('./pages/auth/register/register.component').then(m => m.RegisterComponent),
    canActivate: [authGuard]
  },
  {
    path: 'login',
    loadComponent: () => import('./pages/auth/login/login.component').then(m => m.LoginComponent),
    canActivate: [authGuard]
  },
  {
    path: 'profile',
    loadComponent: () => import('./pages/profile/profile.component').then(m => m.ProfileComponent),
    canActivate: [noauthGuard]
  },
  {
    path: 'products',
    loadComponent: () => import('./pages/producto/producto.component').then(m => m.ProductoComponent),
    canActivate: [noauthGuard]
  },
  {
    path: 'clients',
    loadComponent: () => import('./pages/cliente/cliente.component').then(m => m.ClienteComponent),
    canActivate: [noauthGuard]
  },
  {
    path: 'forgot-account',
    loadComponent: () => import('./pages/auth/forgot-account/forgot-account.component').then(m => m.ForgotAccountComponent),
  },
  {
    path: 'password/confirm/:uid/:token',
    loadComponent: () => import('./pages/auth/forgot-account/confirm-pasword/confirm-pasword.component').then(m => m.ConfirmPaswordComponent),
  },
  {
    path: 'activate/:uid/:token',
    loadComponent: () => import('./pages/auth/activate/email/email.component').then(m => m.EmailComponent),
  },
  {
    path: 'activate/new-email/:uid/:token',
    loadComponent: () => import('./pages/auth/activate/email-new/email-new.component').then(m => m.EmailNewComponent),
  },
  {
    path: 'email/confirm/:uid/:token',
    loadComponent: () => import('./pages/auth/confirm-email/confirm-email.component').then(m => m.confirmEmailComponent),
  },
  {
    path: 'google/callback',
    loadComponent: () => import('./pages/auth/oauth2/oauth2.component').then(m => m.Oauth2Component)
  },
  {
    path: 'error',
    loadComponent: () => import('./pages/error/error.component').then(m => m.ErrorComponent)
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
