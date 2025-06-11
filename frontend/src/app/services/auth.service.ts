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
        localStorage.setItem('token', response.access);
        //localStorage.setItem('refresh', response.refresh); // Si tienes refresh token
        return response;
      }),
      catchError(error => {
        return throwError(() => error);
      })
    );
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

}
