import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { api } from '../api/api';
import { User } from '../models/user.model';
import { map, Observable, catchError, of, throwError, Subject } from 'rxjs';
import { AccesoRespuesta } from '../models/accesorespuesta';
import { Login } from '../models/login';
import { Router } from '@angular/router';
import { jwtDecode } from 'jwt-decode';
import { UtilsService } from './utils.service';
import { TranslateService } from '@ngx-translate/core';
import { Browser } from '@capacitor/browser';

@Injectable({
  providedIn: 'root'
})
export class AuthService {

  private http = inject(HttpClient);
  private apiUrl: string = api.apiUrl;


  private logoutSubject = new Subject<void>();
  logout$ = this.logoutSubject.asObservable();

  private utilsSvc = inject(UtilsService);

  constructor(private router: Router, private translateService: TranslateService) { }

  registroUsuario(objeto: User): Observable<User> {
    return this.http.post<User>(`${this.apiUrl}user/register/`, objeto);
  }

  //Para esto es el uso de la Libreria JwtDecode
  //private getUserIdFromToken(token: string): string {
  //  const decoded: any = jwtDecode(token);
  //  return decoded.id;
  //}

  login(objeto: Login): Observable<AccesoRespuesta> {
    return this.http.post<AccesoRespuesta>(`${this.apiUrl}login/`, objeto).pipe(
      map(response => {
        localStorage.removeItem('last_registered_email');
        localStorage.removeItem('last_registered_password');
        localStorage.setItem('token', response.access);
        //localStorage.setItem('refresh', response.refresh); // Si tienes refresh token
        return response;
      }),
      catchError(error => {
        return throwError(() => error);
      })
    );
  }

  updateUserProfile(userData: { username?: string; recovery_email?: string }): Observable<User> {
    const userId = this.getCurrentUserId();
    if (!userId) {
      return throwError(() => new Error('No user ID available'));
    }

    const headers = new HttpHeaders({
      'Authorization': `Bearer ${localStorage.getItem('token')}`
    });

    // Solo enviamos los campos que queremos actualizar
    const updateData: any = {};
    if (userData.username !== undefined) updateData.username = userData.username;
    if (userData.recovery_email !== undefined) updateData.recovery_email = userData.recovery_email;

    return this.http.patch<User>(`${this.apiUrl}user/${userId}/`, updateData, { headers }).pipe(
      catchError(error => {
        return throwError(() => error);
      })
    );
  }
  deleteAccount(): Observable<any> {
    const userId = this.getCurrentUserId();
    if (!userId) {
      return throwError(() => new Error('No user ID available'));
    }

    const headers = new HttpHeaders({
      'Authorization': `Bearer ${localStorage.getItem('token')}`
    });

    return this.http.delete(`${this.apiUrl}user/${userId}/`, { headers }).pipe(
      catchError(error => {
        return throwError(() => error);
      })
    );
  }

  /////////////Inicio de sesion con Google en navegador
  googleLogin(): void {
    const redirectUrl = `${this.apiUrl}auth/o/login/google-oauth2/?redirect_uri=https://fiador.vercel.app/google/callback`;
    window.location.href = redirectUrl;
  }
  /////////////Inicio de sesion con Google en movil
  // En tu AuthService
  async googleLoginMovil(): Promise<void> {
    // ✅ Agregar parámetro source=mobile_app para que Django sepa que es móvil
    const redirectUrl = `${this.apiUrl}auth/o/login/google-oauth2/?redirect_uri=https://fiador.vercel.app/google/callback&source=mobile_app`;

    await Browser.open({
      url: redirectUrl,
      windowName: '_self',
      presentationStyle: 'popover'
    });
  }

  isAuthenticated(): boolean {
    return !!localStorage.getItem('token');
  }

  logout(): void {
    // Guardamos temporalmente el token antes de limpiar
    const currentToken = localStorage.getItem('token');

    // Limpiamos el localStorage
    localStorage.removeItem('token');
    localStorage.removeItem('userId');

    // Navegamos al login pasando un estado
    this.logoutSubject.next(); // Emitir evento de logout
    this.router.navigate(['/login'], {
      state: { fromLogout: true } // Enviamos este flag
    });
  }

  updateUserWithBiometric(biometricData: string): Observable<any> {
    const userId = this.getCurrentUserId();
    if (!userId) throw new Error('No user ID available');

    const headers = new HttpHeaders({
      'Authorization': `Bearer ${localStorage.getItem('token')}`
    });
    return this.http.patch(`${this.apiUrl}user/${userId}/`, { biometric: biometricData }, { headers });
  }

  getCurrentUserEmail(): Observable<string> {
    const userId = this.getCurrentUserId();
    if (!userId) {
      return throwError(() => new Error('No user ID available'));
    }

    const headers = new HttpHeaders({
      'Authorization': `Bearer ${localStorage.getItem('token')}`
    });

    return this.http.get<User>(`${this.apiUrl}user/${userId}/`, { headers }).pipe(
      map(user => user.email), // Ajusta según la estructura de tu modelo User
      catchError(error => {
        return throwError(() => error);
      })
    );
  }

  // O si prefieres obtener el email directamente del token (si está incluido):
  getEmailFromToken(): string | null {
    const token = localStorage.getItem('token');
    if (!token) return null;

    try {
      const decoded: any = jwtDecode(token);
      return decoded.email; // Asegúrate de que el token incluya el email
    } catch (error) {
      console.error('Error decoding token:', error);
      return null;
    }
  }

  getCurrentUserId(): string | null {
    const token = localStorage.getItem('token');
    if (!token) return null;

    try {
      const decoded: any = jwtDecode(token);
      return decoded.user_id || decoded.id;
    } catch (error) {
      //console.error('Error decoding token:', error);
      return null;
    }
  }

  VerificarToken(): Observable<boolean> {
    const token = localStorage.getItem('token');
    if (!token) {
      return of(false);
    }

    return this.getUserDetails().pipe(
      map(() => true),
      catchError(() => {
        this.TokenExpirado();
        return of(false);
      })
    );
  }

  async TokenExpirado() {
    // Limpiar localStorage
    localStorage.removeItem('token');
    localStorage.removeItem('userId');

    // Mostrar toast similar a cerrarSesion
    await this.utilsSvc.presentToast({
      message: this.translateService.instant('Sesion expirada'),
      duration: 5000,
      color: 'warning',
      position: 'middle',
      icon: 'alert-circle-outline'
    });

    // Emitir evento de logout
    this.logoutSubject.next();

    // Navegar al login
    this.router.navigate(['/'], {
      state: { sessionExpired: true }
    });
  }

  // Nuevo método para obtener los datos del usuario como el ID después de iniciar sesión
  // Este metodo es llamado en el login para almacenar el userId en localStorage
  getUserDetails(): Observable<User> {
    const userId = this.getCurrentUserId();
    if (!userId) throw new Error('No user ID available');
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${localStorage.getItem('token')}`
    });
    return this.http.get<User>(`${this.apiUrl}user/${userId}/`, { headers });
  }
  // En tu AuthService
  loginWithTokens(tokens: { access: string; refresh: string }): void {
    localStorage.setItem('token', tokens.access);

    // Opcional: obtener detalles del usuario
    this.getUserDetails().subscribe({
      next: (user) => {
        console.log('Usuario autenticado:', user);
      },
      error: (error) => {
        console.error('Error obteniendo detalles del usuario:', error);
      }
    });
  }
  /// Confirmar Email
  // En tu AuthService - MODIFICA el endpoint de activación
  activarEmail(data: { uid: string, token: string }): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}auth/activate/`, data).pipe(
      // Si el backend no devuelve tokens, forzamos que devuelva un objeto con éxito
      map(response => {
        return response || { success: true }; // Asegura que siempre haya respuesta
      }),
      catchError(error => {
        return throwError(() => error);
      })
    );
  }

  //Confirmar nuevo Email
  activarNewEmail(data: { uid: string, token: string }): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}auth/activate/new-email/`, data);
  }


  /// Recuperar contraseña
  ForgotPassword(email: string): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}auth/reset/password/`, { email });
  }
  //Escribir nueva contraseña
  confirmResetPassword(data: { uid: string, token: string, new_password: string }): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}auth/reset/password/confirm/`, data);
  }

  /////Este endpoint es cuando el usuario ha olvidado por completo su email y quiere reestablecer
  //La diferencia entre reset/email y change/email es que reset pide codigo al correo secundario
  //y change/email pide codigo al correo principal
  ForgotEmail(recovery_email: string) {
    return this.http.post<any>(`${this.apiUrl}auth/reset/email/`, { recovery_email });
  }

  /// Endpoint cuando el usuario no ha olvidado su email pero igual lo quiere cambiar
  //La diferencia entre reset/email y change/email es que reset pide codigo al correo secundario
  //y change/email pide codigo al correo principal
  changeEmail(): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}auth/change/email/`, {});
  }

  confirmEmail(data: { uid: string; token: string; new_email: string }): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}auth/email/confirm/`, data);
  }

}
