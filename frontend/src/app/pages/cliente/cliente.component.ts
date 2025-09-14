import { CommonModule } from '@angular/common';
import { Component, inject, OnInit } from '@angular/core';
import { FormBuilder, FormControl, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { IonicModule } from '@ionic/angular';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { lastValueFrom } from 'rxjs';
import { Cliente } from 'src/app/models/cliente.model';
import { AuthService } from 'src/app/services/auth.service';
import { ClienteService } from 'src/app/services/cliente.service';
import { UtilsService } from 'src/app/services/utils.service';

import { Capacitor } from '@capacitor/core';
import { NetworkService } from 'src/app/services/network.service';
import { Network } from '@capacitor/network';

@Component({
  selector: 'app-cliente',
  templateUrl: './cliente.component.html',
  styleUrls: ['./cliente.component.scss'],
  imports: [IonicModule, TranslateModule, ReactiveFormsModule, CommonModule, FormsModule]
})
export class ClienteComponent implements OnInit {

  //Variables

  showModal = false;
  showEditModal = false;
  showDeleteModal = false;
  private readonly fb = inject(FormBuilder);
  isLoggedIn: boolean | null = null; // Cambiado a null inicialmente para manejar estado de carga
  clientes: Cliente[] = []; // Añade esto al inicio de la clase
  clienteSeleccionado: Cliente | null = null;

  isMobile: boolean;
  busquedaCliente: string = '';
  clientesFiltrados: Cliente[] = [];
  isLoadingClientes: boolean = false;

  isOnline: boolean = true;

  isSubmitting: boolean = false;

  networkChecking: boolean = false;

  private networkListener: any;

  constructor(
    private authService: AuthService,
    private router: Router,
    private utilsSvc: UtilsService,
    private translateService: TranslateService,
    private clienteService: ClienteService,
    private networkService: NetworkService
  ) {
    // Verifica si la plataforma es móvil
    this.isMobile = Capacitor.getPlatform() === 'android' || Capacitor.getPlatform() === 'ios';
  }


  public formulario_cliente: FormGroup = this.fb.group({
    cliente_nombre: new FormControl('', [Validators.required, Validators.minLength(4)]),
  });


  async ngOnInit() {
    // Verificación inicial de conexión
    await this.checkNetworkStatus();

    // Suscripción a cambios de estado de red
    this.setupNetworkListeners();
    this.networkService.onlineStatus$.subscribe(async online => {
      this.isOnline = online;

      // Si pasamos de offline a online, recargamos los clientes
      if (online && this.clientes.length === 0) {
        await this.cargarClientes();
      }
    });

    this.checkAuthentication();
    this.cargarClientes();
  }

  setupNetworkListeners() {
    // Listener de Capacitor Network
    this.networkListener = Network.addListener('networkStatusChange', async (status) => {
      this.isOnline = status.connected;
      if (this.isOnline) {
        // Si hay conexión, recargar los fiados
        location.reload(); // Recarga la página
      }
    });

    // Listener adicional de tu servicio si es necesario
    this.networkService.onlineStatus$.subscribe(online => {
      this.isOnline = online;
    });
  }

  //Codigo para que cuando de una app y vuelva a entrar los botones sigan habilitados
  async checkNetworkStatus() {
    this.networkChecking = true;
    try {
      const status = await Network.getStatus();
      this.isOnline = status.connected;
    } catch (error) {
      console.error('Error checking network:', error);
      this.isOnline = false;
    } finally {
      this.networkChecking = false;
    }
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
  async registrar_cliente() {
    if (this.isSubmitting) return; // Evitar múltiples ejecuciones
    this.isSubmitting = true; // Bloquear botón

    const hasConnection = await this.networkService.checkConnection();

    if (!hasConnection) {
      this.isSubmitting = false;
      return;
    }
    if (!this.formulario_cliente.valid) {
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

      const cliente: Cliente = {
        fiador: userId,
        cliente_nombre: this.formulario_cliente.get('cliente_nombre')?.value,
        id: this.formulario_cliente.get('id')?.value,
      };

      const response = await lastValueFrom(this.clienteService.registrarCliente(cliente));

      if (!response) throw new Error('Error en la respuesta del servidor');

      this.utilsSvc.presentToast({
        message: this.translateService.instant('Cliente agregado'),
        duration: 2000,
        color: 'success',
        position: 'middle',
        icon: 'checkmark-circle-outline'
      });

      await loading.dismiss(); // Siempre se cierra al final
      this.isSubmitting = false;
      this.closeModal();
      await this.cargarClientes(); // Si cargarClientes es async
      this.router.navigateByUrl('/clients');

    } catch (error: any) {
      //console.error('Error:', error);
      const mensajeError = error?.error?.non_field_errors?.[0];

      await loading.dismiss(); // Siempre se cierra al final
      this.isSubmitting = false;
      if (mensajeError === 'The fields fiador, cliente_nombre must make a unique set.') {
        this.utilsSvc.presentToast({
          message: this.translateService.instant('Cliente error'),
          duration: 2000,
          color: 'danger',
          position: 'middle',
          icon: 'alert-circle-outline'
        });
      } else {
        this.utilsSvc.presentToast({
          message: this.translateService.instant('Cliente error agregado'),
          duration: 2000,
          color: 'danger',
          position: 'middle',
          icon: 'alert-circle-outline'
        });
      }
    } finally {
      await loading.dismiss(); // Siempre se cierra al final
      this.isSubmitting = false;
    }
  }


  async cargarClientes() {
    this.isLoadingClientes = true;
    try {
      const clientes = await lastValueFrom(this.clienteService.obtenerCliente());
      this.clientes = clientes;
      this.clientesFiltrados = [...this.clientes]; // Inicializa los clientes filtrados
    } catch (error) {
      console.error('Error al cargar clientes:', error);
      this.utilsSvc.presentToast({
        message: this.translateService.instant('Error al cargar clientes'),
        duration: 2000,
        color: 'danger',
        position: 'middle'
      });
    } finally {
      this.isLoadingClientes = false;
    }
  }
  filtrarClientes() {
    if (!this.busquedaCliente) {
      this.clientesFiltrados = [...this.clientes];
      return;
    }

    const termino = this.busquedaCliente.toLowerCase();
    this.clientesFiltrados = this.clientes.filter(cliente =>
      cliente.cliente_nombre.toLowerCase().includes(termino)
    );
  }
  async editarCliente() {

    if (this.isSubmitting) return; // Evitar múltiples ejecuciones
    this.isSubmitting = true; // Bloquear botón

    const hasConnection = await this.networkService.checkConnection();

    if (!hasConnection) {
      this.isSubmitting = false;
      return;
    }

    if (this.formulario_cliente.valid && this.clienteSeleccionado) {
      const loading = await this.utilsSvc.loading({
        spinner: 'crescent',
        cssClass: 'custom-loading'
      });
      await loading.present();

      try {
        const updateData = {
          cliente_nombre: this.formulario_cliente.get('cliente_nombre')?.value,
        };

        //console.log('Datos a enviar al backend:', { 
        //  id: this.productoSeleccionado.id,
        //  updateData 
        //});

        this.clienteService.editarCliente(
          this.clienteSeleccionado.id,
          updateData // Envía solo los campos modificables
        ).subscribe({
          next: (response) => {
            this.utilsSvc.presentToast({
              message: this.translateService.instant('Cliente editado'),
              duration: 2000,
              color: 'success',
              position: 'middle',
              icon: 'checkmark-circle-outline'
            });
            this.cargarClientes();
            this.cerrarModalEditar();
            loading.dismiss(); // Mover aquí
          },
          error: (error) => {
            const mensajeError = error?.error?.non_field_errors?.[0];

            loading.dismiss(); // Mover aquí
            this.isSubmitting = false;
            if (mensajeError === 'The fields fiador, cliente_nombre must make a unique set.') {
              this.utilsSvc.presentToast({
                message: this.translateService.instant('Cliente error'),
                duration: 2000,
                color: 'danger',
                position: 'middle',
                icon: 'alert-circle-outline'
              });
            } else {
              this.utilsSvc.presentToast({
                message: this.translateService.instant('Cliente error editar'),
                duration: 2000,
                color: 'danger',
                position: 'middle',
                icon: 'alert-circle-outline'
              });
            }
            loading.dismiss();
            this.isSubmitting = false;
          }
        });
      } catch (error) {
        loading.dismiss(); // Mover aquí
        this.isSubmitting = false;
      }
    }
  }

  async eliminarCliente() {
    // Verifica conexión a internet primero
    const hasConnection = await this.networkService.checkConnection();
    if (!hasConnection) return;
    if (this.clienteSeleccionado) {
      const loading = await this.utilsSvc.loading({
        spinner: 'crescent',
        cssClass: 'custom-loading'
      });
      await loading.present();

      try {
        this.clienteService.eliminarCliente(this.clienteSeleccionado.id).subscribe({
          next: (response) => {
            this.utilsSvc.presentToast({
              message: this.translateService.instant('Cliente eliminado'),
              duration: 2000,
              color: 'success',
              position: 'middle',
              icon: 'checkmark-circle-outline'
            });
            this.cargarClientes();
            this.cerrarModalEliminar();
            loading.dismiss(); // Mover aquí
          },
          error: (error) => {
            //console.error('Error al eliminar producto:', error);
            this.utilsSvc.presentToast({
              message: this.translateService.instant('Cliente error eliminar'),
              duration: 2000,
              color: 'danger',
              position: 'middle',
              icon: 'alert-circle-outline'
            });
            loading.dismiss(); // Mover aquí
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
    this.formulario_cliente.reset(); // Resetear el formulario al cerrar
  }

  abrirModalEditar(cliente: Cliente) {
    this.clienteSeleccionado = cliente;
    this.formulario_cliente.patchValue({
      cliente_nombre: cliente.cliente_nombre,
    });
    this.showEditModal = true;
  }

  abrirModalEliminar(cliente: Cliente) {
    this.clienteSeleccionado = cliente;
    this.showDeleteModal = true;
  }

  cerrarModalEditar() {
    this.showEditModal = false;
    this.clienteSeleccionado = null;
    this.formulario_cliente.reset();
  }

  cerrarModalEliminar() {
    this.showDeleteModal = false;
    this.clienteSeleccionado = null;
  }


}
