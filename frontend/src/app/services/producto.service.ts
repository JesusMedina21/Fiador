import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Router } from '@angular/router';
import { catchError, map, Observable, of } from 'rxjs';
import { api } from '../api/api';
import { Producto } from '../models/producto.model';

@Injectable({
  providedIn: 'root'
})
export class ProductoService {



  private http = inject(HttpClient);
  private apiUrl: string = api.apiUrl;

  constructor(private router: Router) { }

  getToken(): string | null {
    return localStorage.getItem('token');
  }

  registrarProducto(producto: Producto): Observable<any> {
    const token = this.getToken();
    const headers = new HttpHeaders().set('Authorization', `Bearer ${token}`);

    return this.http.post<Producto>(`${this.apiUrl}producto/`, producto, { headers })
  }

  obtenerProductos(): Observable<any> {
    const token = this.getToken();
    const headers = new HttpHeaders().set('Authorization', `Bearer ${token}`);

    return this.http.get<any>(`${this.apiUrl}producto/`, { headers }).pipe(
      map((response) => {
        const userId = Number(localStorage.getItem('userId'));
        return response.filter((producto: Producto) => producto.usuario === userId);
      }),
      catchError(error => {
        //console.error('Error obteniendo productos:', error);
        return of([]);
      })
    );
  }

  editarProducto(id: number, updateData: { producto_nombre: string, precio: string | number }): Observable<any> {
    const token = this.getToken();
    const headers = new HttpHeaders()
      .set('Authorization', `Bearer ${token}`)
      .set('Content-Type', 'application/json');

    // Asegúrate que el precio sea número
    const body = {
      ...updateData,
      precio: parseFloat(updateData.precio.toString())
    };

    return this.http.patch(`${this.apiUrl}producto/${id}/`, body, { headers })
  }
  eliminarProducto(id: number): Observable<any> {
    const token = this.getToken();
    const headers = new HttpHeaders().set('Authorization', `Bearer ${token}`);

    return this.http.delete<any>(`${this.apiUrl}producto/${id}/`, { headers }).pipe(
      catchError(error => {
        //console.error('Error eliminando producto:', error);
        return of(null);
      })
    );
  }
}


