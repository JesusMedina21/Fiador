// src/app/core/interceptors/api-interceptor.ts
import { Injectable } from '@angular/core';
import {
  HttpRequest,
  HttpHandler,
  HttpEvent,
  HttpInterceptor,
  HttpHeaders
} from '@angular/common/http';
import { Observable } from 'rxjs';

// Usa los mismos valores que en tu servicio
const API_SECRET_HEADER = 'X-Api-Secret';
const API_SECRET_VALUE = 'tucodigo';

@Injectable()
export class AppInterceptor implements HttpInterceptor {
  intercept(request: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    // Clona la petición y añade los headers necesarios
    const modifiedRequest = request.clone({
      headers: this.getHeaders(request)
    });

    return next.handle(modifiedRequest);
  }

  private getHeaders(request: HttpRequest<unknown>): HttpHeaders {
    let headers = request.headers;

    // Añade el header secreto a todas las peticiones
    if (!headers.has(API_SECRET_HEADER)) {
      headers = headers.set(API_SECRET_HEADER, API_SECRET_VALUE);
    }

    // Añade el token de autorización si está disponible (excepto para registro/login)
    const token = localStorage.getItem('token');
    if (token && !this.isAuthRequest(request)) {
      headers = headers.set('Authorization', `Bearer ${token}`);
    }

    return headers;
  }

  private isAuthRequest(request: HttpRequest<unknown>): boolean {
    // Lista de endpoints que no requieren el header Authorization
    const authEndpoints = [
      'user/register',
      'login'
    ];
    return authEndpoints.some(endpoint => request.url.includes(endpoint));
  }
}