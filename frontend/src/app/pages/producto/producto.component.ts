import { CommonModule } from '@angular/common';
import { Component, inject, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { IonicModule } from '@ionic/angular';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { AuthService } from 'src/app/services/auth.service';
import { UtilsService } from 'src/app/services/utils.service';
import { FormBuilder, FormControl, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { ProductoService } from 'src/app/services/producto.service';
import { Producto } from 'src/app/models/producto.model';
import { lastValueFrom } from 'rxjs';
import { Capacitor } from '@capacitor/core';
import { NetworkService } from 'src/app/services/network.service';

@Component({
  selector: 'app-producto',
  templateUrl: './producto.component.html',
  styleUrls: ['./producto.component.scss'],
  imports: [IonicModule, TranslateModule, CommonModule, ReactiveFormsModule, FormsModule]
})
export class ProductoComponent implements OnInit {

  showModal = false;
  showEditModal = false;
  showDeleteModal = false;
  private readonly fb = inject(FormBuilder);
  productos: Producto[] = []; // Añade esto al inicio de la clase
  productoSeleccionado: Producto | null = null;
  isLoggedIn: boolean | null = null; // Cambiado a null inicialmente para manejar estado de carga

  productosFiltrados: Producto[] = [];
  busquedaProducto: string = '';
  isLoadingProductos: boolean = false;

  isMobile: boolean;

  isOnline: boolean = true;
  networkChecking: boolean = false;

  constructor(
    private authService: AuthService,
    private router: Router,
    private utilsSvc: UtilsService,
    private translateService: TranslateService,
    private productoService: ProductoService,
    private networkService: NetworkService
  ) {
    // Verifica si la plataforma es móvil
    this.isMobile = Capacitor.getPlatform() === 'android' || Capacitor.getPlatform() === 'ios';
  }


  public formulario_producto: FormGroup = this.fb.group({
    producto_nombre: new FormControl('', [Validators.required, Validators.minLength(4)]),
    precio: new FormControl('', [
      Validators.required,
      Validators.min(0.01),
      this.validatePriceFormat.bind(this)
    ]),
  });

  // Validación personalizada (solo permite 1,000.00, 1000.50 o 1000)
  validatePriceFormat(control: FormControl): { [key: string]: boolean } | null {
    const value = control.value;
    if (value === null || value === '' || value === undefined) return null;

    // Regex que acepta:
    // - 1,000.00 (coma para miles, punto para decimales)
    // - 1000.50 (punto para decimales, sin comas)
    // - 1000 (entero sin decimales)
    const regex = /^(?:\d+|\d{1,3}(?:,\d{3})*)(?:\.\d{1,2})?$/;

    return regex.test(value) ? null : { 'invalidFormat': true };
  }
  // Función para limpiar el input en tiempo real
  cleanPriceInput(event: any) {
    let value = event.target.value;

    // Elimina caracteres no permitidos (solo números, comas y puntos)
    value = value.replace(/[^0-9,.]/g, '');

    // Asegura que solo haya una coma (para miles) y un punto (para decimales)
    const parts = value.split('.');
    if (parts.length > 2) {
      value = parts[0] + '.' + parts.slice(1).join('');
    }

    // Actualiza el valor en el formulario
    this.formulario_producto.get('precio')?.setValue(value, { emitEvent: false });
    event.target.value = value;
  }

  async ngOnInit() {
    this.networkService.onlineStatus$.subscribe(online => {
      this.isOnline = online;
    });
    await this.checkAuthentication(); // Verifica el estado de autenticación al iniciar
    this.cargarProductos();
  }


  async checkAuthentication(): Promise<boolean> {
    // Primero verificar conexión a internet
    const hasConnection = await this.networkService.checkConnection();

    if (!hasConnection) {
      // Comportamiento offline: verificar si hay token en localStorage
      const token = localStorage.getItem('token');
      this.isLoggedIn = !!token; // true si existe token, false si no
      return this.isLoggedIn;
    }

    // Si hay conexión, verificar el token con el servidor
    return new Promise((resolve) => {
      this.authService.VerificarToken().subscribe({
        next: (isValid) => {
          this.isLoggedIn = isValid;
          resolve(isValid);
        },
        error: () => {
          this.isLoggedIn = false;
          resolve(false);
        }
      });
    });
  }

  async registrar_producto() {
    // Verifica conexión a internet primero
    const hasConnection = await this.networkService.checkConnection();
    if (!hasConnection) return;
    if (!this.formulario_producto.valid) {
      this.utilsSvc.presentToast({
        message: this.translateService.instant('Completar_Campos'),
        duration: 2000,
        color: 'warning',
        position: 'middle',
        icon: 'alert-circle-outline'
      });
      return;
    }

    const loading = await this.utilsSvc.loading({
      spinner: 'crescent',
      cssClass: 'custom-loading'
    });

    try {
      await loading.present();

      const userId = Number(localStorage.getItem('userId'));
      if (isNaN(userId)) throw new Error('ID de usuario no válido');
      // Convierte el precio a formato numérico (elimina comas)
      const rawPrice = this.formulario_producto.get('precio')?.value;
      const formattedPrice = parseFloat(rawPrice.toString().replace(/,/g, ''));

      const producto: Producto = {
        usuario: userId,
        id: this.formulario_producto.get('id')?.value,
        producto_nombre: this.formulario_producto.get('producto_nombre')?.value,
        precio: formattedPrice  // Envía como número (ej: 1000.50)
      };

      // Convertir el Observable a Promise para usar await
      const response = await lastValueFrom(this.productoService.registrarProducto(producto));

      if (!response) throw new Error('Error en la respuesta del servidor');

      this.utilsSvc.presentToast({
        message: this.translateService.instant('Producto agregado'),
        duration: 2000,
        color: 'success',
        position: 'middle',
        icon: 'checkmark-circle-outline'
      });

      this.closeModal();
      await this.cargarProductos(); // Si cargarProductos es async
      this.router.navigateByUrl('/products');

    } catch (error: any) {
      //console.error('Error:', error);
      const mensajeError = error?.error?.non_field_errors?.[0];

      if (mensajeError === 'The fields usuario, producto_nombre must make a unique set.') {
        this.utilsSvc.presentToast({
          message: this.translateService.instant('Producto error'),
          duration: 2000,
          color: 'danger',
          position: 'middle',
          icon: 'alert-circle-outline'
        });
      } else {
        this.utilsSvc.presentToast({
          message: this.translateService.instant('Producto error agregado'),
          duration: 2000,
          color: 'danger',
          position: 'middle',
          icon: 'alert-circle-outline'
        });
      }
    } finally {
      await loading.dismiss(); // Siempre se cierra al final
    }
  }


  async cargarProductos() {
    const hasConnection = await this.networkService.checkConnection();
    if (!hasConnection) {
      this.isLoadingProductos = false;
      return;
    }
    this.isLoadingProductos = true;
    try {
      const productos = await lastValueFrom(this.productoService.obtenerProductos());
      this.productos = productos;
      this.productosFiltrados = [...this.productos];
    } catch (error) {
      console.error('Error al cargar productos:', error);
      this.utilsSvc.presentToast({
        message: this.translateService.instant('Error al cargar productos'),
        duration: 2000,
        color: 'danger',
        position: 'middle'
      });
    } finally {
      this.isLoadingProductos = false;
    }
  }

  filtrarProductos() {
    if (!this.busquedaProducto) {
      this.productosFiltrados = [...this.productos];
      return;
    }

    const termino = this.busquedaProducto.toLowerCase();
    this.productosFiltrados = this.productos.filter(producto =>
      producto.producto_nombre.toLowerCase().includes(termino)
    );
  }

  async editarProducto() {
    // Verifica conexión a internet primero
    const hasConnection = await this.networkService.checkConnection();
    if (!hasConnection) return;
    if (this.formulario_producto.valid && this.productoSeleccionado) {
      const loading = await this.utilsSvc.loading({
        spinner: 'crescent',
        cssClass: 'custom-loading'
      });
      await loading.present();

      try {
        // Convierte el precio a formato numérico (elimina comas)
        const rawPrice = this.formulario_producto.get('precio')?.value;
        const formattedPrice = parseFloat(rawPrice.toString().replace(/,/g, ''));

        const updateData = {
          producto_nombre: this.formulario_producto.get('producto_nombre')?.value,
          precio: formattedPrice  // Usa el precio formateado
        };

        //console.log('Datos a enviar al backend:', { 
        //  id: this.productoSeleccionado.id,
        //  updateData 
        //});

        this.productoService.editarProducto(
          this.productoSeleccionado.id,
          updateData // Envía solo los campos modificables
        ).subscribe({
          next: (response) => {
            this.utilsSvc.presentToast({
              message: this.translateService.instant('Producto editado'),
              duration: 2000,
              color: 'success',
              position: 'middle',
              icon: 'checkmark-circle-outline'
            });
            this.cargarProductos();
            this.cerrarModalEditar();
            loading.dismiss(); // Mover aquí
          },
          error: (error) => {
            const mensajeError = error?.error?.non_field_errors?.[0];

            if (mensajeError === 'The fields usuario, producto_nombre must make a unique set.') {
              this.utilsSvc.presentToast({
                message: this.translateService.instant('Producto error'),
                duration: 2000,
                color: 'danger',
                position: 'middle',
                icon: 'alert-circle-outline'
              });
            } else {
              this.utilsSvc.presentToast({
                message: this.translateService.instant('Producto error editar'),
                duration: 2000,
                color: 'danger',
                position: 'middle',
                icon: 'alert-circle-outline'
              });
            }
            loading.dismiss();
          }
        });
      } catch (error) {
        loading.dismiss(); // Mover aquí
      }
    }
  }

  async eliminarProducto() {
    // Verifica conexión a internet primero
    const hasConnection = await this.networkService.checkConnection();
    if (!hasConnection) return;
    if (this.productoSeleccionado) {
      const loading = await this.utilsSvc.loading({
        spinner: 'crescent',
        cssClass: 'custom-loading'
      });
      await loading.present();

      try {
        this.productoService.eliminarProducto(this.productoSeleccionado.id).subscribe({
          next: (response) => {
            this.utilsSvc.presentToast({
              message: this.translateService.instant('Producto eliminado'),
              duration: 2000,
              color: 'success',
              position: 'middle',
              icon: 'checkmark-circle-outline'
            });
            this.cargarProductos();
            this.cerrarModalEliminar();
            loading.dismiss(); // Mover aquí
          },
          error: (error) => {
            //console.error('Error al eliminar producto:', error);
            this.utilsSvc.presentToast({
              message: this.translateService.instant('Producto error eliminar'),
              duration: 2000,
              color: 'danger',
              position: 'middle',
              icon: 'alert-circle-outline'
            });
          }
        });
      } catch (error) {
        //console.error('Error inesperado:', error);
        loading.dismiss(); // Mover aquí
      }
    }
  }

  cerrarSesion(): void {
    // Guarda el token antes de limpiar para posible uso futuro
    const currentToken = localStorage.getItem('token');

    this.authService.logout();

    // Si había token, redirige a login con flag para mostrar vista de perfil
    if (currentToken) {
      this.router.navigate([''], {
        state: { showProfile: true }
      });
    }

    this.utilsSvc.presentToast({
      message: this.translateService.instant('Felicitaciones logout'),
      duration: 2000,
      color: 'success',
      position: 'middle',
      icon: 'alert-circle-outline'
    });
  }


  openModal() {
    this.showModal = true;
  }
  closeModal() {
    this.showModal = false;
    this.formulario_producto.reset(); // Resetear el formulario al cerrar
  }
  abrirModalEditar(producto: Producto) {
    this.productoSeleccionado = producto;
    this.formulario_producto.patchValue({
      producto_nombre: producto.producto_nombre,
      precio: producto.precio
    });
    this.showEditModal = true;
  }

  abrirModalEliminar(producto: Producto) {
    this.productoSeleccionado = producto;
    this.showDeleteModal = true;
  }
  cerrarModalEditar() {
    this.showEditModal = false;
    this.productoSeleccionado = null;
    this.formulario_producto.reset();
  }

  cerrarModalEliminar() {
    this.showDeleteModal = false;
    this.productoSeleccionado = null;
  }
}
