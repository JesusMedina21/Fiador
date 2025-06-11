import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Router } from '@angular/router';
import { catchError, map, Observable, of } from 'rxjs';
import { api } from '../api/api';
import { Cliente } from '../models/cliente.model';

@Injectable({
  providedIn: 'root'
})
export class ClienteService {


  private http = inject(HttpClient);
  private apiUrl: string = api.apiUrl;

  constructor(private router: Router) { }

  getToken(): string | null {
    return localStorage.getItem('token');
  }

  registrarCliente(cliente: Cliente): Observable<any> {
    const token = this.getToken();
    const headers = new HttpHeaders().set('Authorization', `Bearer ${token}`);

    return this.http.post<Cliente>(`${this.apiUrl}cliente/`, cliente, { headers })
  }

  obtenerCliente(): Observable<any> {
    const token = this.getToken();
    const headers = new HttpHeaders().set('Authorization', `Bearer ${token}`);

    return this.http.get<any>(`${this.apiUrl}cliente/`, { headers }).pipe(
      map((response) => {
        const userId = Number(localStorage.getItem('userId'));
        return response.filter((cliente: Cliente) => cliente.fiador === userId);
      }),
      catchError(error => {
        //console.error('Error obteniendo clientes:', error);
        return of([]);
      })
    );
  }

  editarCliente(id: number, updateData: { cliente_nombre: string}): Observable<any> {
    const token = this.getToken();
    const headers = new HttpHeaders()
      .set('Authorization', `Bearer ${token}`)
      .set('Content-Type', 'application/json');

    // Asegúrate que el precio sea número
    const body = {
      ...updateData
    };

    return this.http.patch(`${this.apiUrl}cliente/${id}/`, body, { headers })
  }

  eliminarCliente(id: number): Observable<any> {
    const token = this.getToken();
    const headers = new HttpHeaders().set('Authorization', `Bearer ${token}`);

    return this.http.delete<any>(`${this.apiUrl}cliente/${id}/`, { headers }).pipe(
      catchError(error => {
        //console.error('Error eliminando cliente:', error);
        return of(null);
      })
    );
  }
}
