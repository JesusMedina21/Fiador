import { HttpClient, HttpHeaders } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { api } from '../api/api';
import { Router } from '@angular/router';
import { catchError, map, Observable, of, throwError } from 'rxjs';
import { Fiado } from '../models/fiado.model';

@Injectable({
  providedIn: 'root'
})
export class FiadosService {

  private http = inject(HttpClient);
  private apiUrl: string = api.apiUrl;

  constructor(private router: Router) { }

  getToken(): string | null {
    return localStorage.getItem('token');
  }

  registrarFiado(fiado: any): Observable<any> {
    const token = this.getToken();
    const headers = new HttpHeaders().set('Authorization', `Bearer ${token}`)
      .set('Content-Type', 'application/json');

    return this.http.post<any>(`${this.apiUrl}fiado/`, fiado, { headers }).pipe(
      catchError(error => {
        //console.error('Error agregando fiado:', error);
        return throwError(() => error); // Propaga el error para manejo en el componente
      })
    );
  }

  obtenerFiado(): Observable<Fiado[]> {
    const token = this.getToken();
    const headers = new HttpHeaders().set('Authorization', `Bearer ${token}`);

    return this.http.get<Fiado[]>(`${this.apiUrl}fiado/`, { headers }).pipe(
      catchError(error => {
        //console.error('Error obteniendo Fiador:', error);
        return of([]); // Retorna un array vacío en caso de error
      })
    );
  }

  abonarFiado(id: number, montoAbono: number, abonoActual: number): Observable<any> {
    const token = this.getToken();
    const headers = new HttpHeaders()
      .set('Authorization', `Bearer ${token}`)
      .set('Content-Type', 'application/json');

    const nuevoAbono = parseFloat((Number(abonoActual) + Number(montoAbono)).toFixed(2));


    const body = {
      abono: nuevoAbono,
      fecha_registro: new Date().toISOString()
    };

    return this.http.patch(`${this.apiUrl}fiado/${id}/`, body, { headers }).pipe(
      catchError(error => {
        //console.error('Error registrando abono:', error);
        return throwError(() => error);
      })
    );
  }
  actualizarMontoFiado(id: number, montoTotal: number): Observable<Fiado> {
    const token = this.getToken();
    const headers = new HttpHeaders()
      .set('Authorization', `Bearer ${token}`)
      .set('Content-Type', 'application/json');

    // Asegúrate de que el cuerpo tenga el formato correcto
    const body = {
      monto_total: Number(montoTotal) // Conversión explícita a número
    };

    //console.log('Enviando al backend:', body); // Para depuración

    return this.http.patch<Fiado>(`${this.apiUrl}fiado/${id}/`, body, { headers }).pipe(
      catchError(error => {
        //console.error('Detalles del error:', error.error);
        return throwError(() => error);
      })
    );
  }
  eliminarFiado(id: number): Observable<any> {
    const token = this.getToken();
    const headers = new HttpHeaders().set('Authorization', `Bearer ${token}`);

    return this.http.delete<any>(`${this.apiUrl}fiado/${id}/`, { headers }).pipe(
      catchError(error => {
        //console.error('Error eliminando producto:', error);
        return of(null);
      })
    );
  }

}
