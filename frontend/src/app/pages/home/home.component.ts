import { CommonModule } from '@angular/common';
import { Component, inject, OnInit } from '@angular/core';
import { FormBuilder, FormControl, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { IonicModule, Platform, PopoverController } from '@ionic/angular';
import { TranslateModule, TranslateService } from '@ngx-translate/core'; 
import { TraductorService } from 'src/app/services/traductor.service';
import { AuthService } from 'src/app/services/auth.service'; 
import { Router } from '@angular/router'; 
import { UtilsService } from 'src/app/services/utils.service';
import { SettingsComponent } from 'src/app/pages/shared/settings/settings.component';
import { ClienteService } from 'src/app/services/cliente.service';
import { ProductoService } from 'src/app/services/producto.service';
import { FiadosService } from 'src/app/services/fiados.service';
import { Cliente } from 'src/app/models/cliente.model';
import { Producto } from 'src/app/models/producto.model';
import { Fiado } from 'src/app/models/fiado.model';
import { lastValueFrom } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { Capacitor } from '@capacitor/core';
import { NetworkService } from 'src/app/services/network.service';
import { Network } from '@capacitor/network';
import { DateFormatPipe } from 'src/app/pipes/date-format.pipe';

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss'],
  imports: [IonicModule, TranslateModule, FormsModule, CommonModule, ReactiveFormsModule, DateFormatPipe],
  standalone: true,
})
export class HomeComponent implements OnInit {

  utils = inject(UtilsService);
  langs: string[] = [];
  currentLang: string
  isLoggedIn: boolean | null = null; // Cambiado a null inicialmente para manejar estado de carga
  showModalFiado = false;
  showModalEditar = false;
  showModalOtroFiado = false;
  showVisualizarFiadoModal = false;
  showDeleteModal = false;
  modalProductosAbierto = false;

  clientes: Cliente[] = [];
  busquedaCliente: string = '';
  clienteSeleccionado: Cliente | null = null;

  productos: Producto[] = [];
  productosSeleccionados: { producto: Producto, cantidad: number }[] = [];
  busquedaProducto = '';

  montoTotal: number = 0;
  Fiador: Fiado[] = []; // Array para almacenar los Fiador
  isLoadingFiador: boolean = false; // Nueva propiedad para controlar carga de Fiador

  Fiadoreleccionado: Fiado | null = null;

  mostrarInputPago: boolean = false;
  montoPago: number | null = null;
  montoPagoValido: boolean = false;
  errorMonto: string = '';

  isMobile: boolean;
  // Agrega estas propiedades a tu componente
  busquedaFiado: string = '';
  fiadosFiltrados: Fiado[] = [];
  fiadoSeleccionado: Fiado | null = null;

  isOnline: boolean = true;
  networkChecking: boolean = false;

  isSubmitting: boolean = false;

  private networkListener: any;
  private readonly fb = inject(FormBuilder);

  constructor(
    private popoverCtrl: PopoverController,
    private traductorService: TraductorService,
    private authService: AuthService,
    private router: Router,
    private utilsSvc: UtilsService,
    private translateService: TranslateService,
    private clienteService: ClienteService,
    private productoService: ProductoService,
    private FiadoService: FiadosService,
    private networkService: NetworkService,
    private platform: Platform
  ) {
    // Verifica si la plataforma es móvil
    this.isMobile = Capacitor.getPlatform() === 'android' || Capacitor.getPlatform() === 'ios';
    this.currentLang = this.traductorService.getCurrentLanguage(); // Establece el idioma actual
  }

  public formulario_fiado: FormGroup = this.fb.group({
    cliente: new FormControl('', [Validators.required]),
    productos: new FormControl([]), // Quitamos la validación requerida
    interes: new FormControl(0, [Validators.required, Validators.min(0)]),
    monto_total: new FormControl(0, [Validators.min(0.01)]) // Quitamos Validators.required
  });
  validarFormulario(): boolean {
    const form = this.formulario_fiado;
    const tieneProductos = this.productosSeleccionados.length > 0;
    const tieneMonto = form.get('monto_total')?.value > 0;

    // Validar que al menos tenga productos o monto
    if (!tieneProductos && !tieneMonto) {
      return false;
    }

    // Validar que el cliente esté seleccionado
    if (!form.get('cliente')?.value) {
      return false;
    }

    // Validar que el interés sea válido
    if (form.get('interes')?.invalid) {
      return false;
    }

    return true;
  }

  async ngOnInit() {
    // Verificación inicial de conexión
    await this.checkNetworkStatus();

    // Suscripción a cambios de estado de red
    this.setupNetworkListeners();

    // Manejar evento de resume (volver a la app)
    this.platform.resume.subscribe(() => {
      this.checkNetworkStatus(); // Verificar conexión al volver
    });

    this.networkService.onlineStatus$.subscribe(online => {
      this.isOnline = online;
    });
    this.langs = this.traductorService.getLangs(); // Obtén los idiomas disponibles

    // Verificar autenticación antes de mostrar cualquier contenido
    const estaAutenticado = await this.checkAuthentication();
    // Solo cargar datos si está autenticado
    if (estaAutenticado) {
      this.cargarFiador();
      this.cargarClientes();
      this.cargarProductos();
    }

    // Escuchar cambios en el estado de autenticación
    this.authService.logout$.subscribe(() => {
      this.isLoggedIn = false;
      // Limpiar datos cuando se cierra sesión
      this.clientes = [];
      this.productos = [];
      this.Fiador = [];
    });

    // Escuchar el evento de cambio de idioma
    window.addEventListener('languageChanged', () => {
      this.currentLang = this.traductorService.getCurrentLanguage();
      // Si deseas Editar el valor del ion-select, puedes hacerlo aquí
      // Editar el valor del ion-select
      const select = document.querySelector('ion-select');
      if (select) {
        select.value = this.currentLang; // Establece el valor del ion-select
      }

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

  ngOnDestroy() {
    // Limpiar listeners
    if (this.networkListener) {
      this.networkListener.remove();
    }
    window.removeEventListener('languageChanged', () => { });
  }

  async checkAuthentication(): Promise<boolean> {
    // Primero verificar conexión a internet
    const hasConnection = await this.networkService.checkConnection();

    if (!hasConnection) {
      // Si no hay conexión, asumimos que el usuario podría estar autenticado (para evitar cerrar sesión innecesariamente)
      this.isLoggedIn = true; // O podrías mantener el último estado conocido
      return true; // O false dependiendo de tu lógica de negocio
    }

    // Si hay conexión, proceder con la verificación del token
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

  cargarClientes() {
    this.clienteService.obtenerCliente().subscribe({
      next: (clientes) => {
        this.clientes = clientes;
      },
      error: (error) => {
        console.error('Error cargando clientes:', error);
      }
    });
  }

  ClienteSeleccionado(event: any) {
    const clienteId = event.detail.value;
    this.clienteSeleccionado = this.clientes.find(c => c.id === clienteId) || null;
  }

  cargarProductos() {
    this.productoService.obtenerProductos().subscribe({
      next: (productos) => {
        this.productos = productos;
      },
      error: (error) => {
        console.error('Error cargando productos:', error);
      }
    });
  }

  async registrar_fiado() {
    if (this.isSubmitting) return; // Evitar múltiples ejecuciones
    this.isSubmitting = true; // Bloquear botón

    const hasConnection = await this.networkService.checkConnection();

    if (!hasConnection) {
      this.isSubmitting = false;
      return;
    }

    // Validación manual para asegurar que al menos productos o monto_total estén presentes
    if (!this.validarFormulario()) {
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

    await loading.present();

    try {
      const fiadoData = {
        monto_total: this.calcularMontoTotal(),
        interes: this.formulario_fiado.get('interes')?.value,
        fecha_registro: new Date().toISOString(),
        cliente: this.formulario_fiado.get('cliente')?.value,
        productos: this.productosSeleccionados.map(item => ({
          producto_id: item.producto.id,
          cantidad: item.cantidad
        })),
        abono: 0
      };

      // 4. Registrar el fiado (usando await para esperar la respuesta)
      const response = await this.FiadoService.registrarFiado(fiadoData).toPromise();

      await loading.dismiss();
      this.isSubmitting = false;

      this.utilsSvc.presentToast({
        message: this.translateService.instant('Fiado agregado'),
        duration: 2000,
        color: 'success',
        position: 'middle',
        icon: 'checkmark-circle-outline'
      });
      this.cargarFiador();
      this.closeModalFiado();
      this.closeModalOtroFiado();

    } catch (error) {
      //console.error('Error:', error);
      let errorMessage = this.translateService.instant('Fiado error'); // Mensaje por defecto
      // Verificar si el error es de tipo HttpErrorResponse
      if (error instanceof HttpErrorResponse) {
        if (error.error && error.error.cliente) {
          errorMessage = this.translateService.instant('Fiado existente'); // Usamos la clave de traducción
        }
      }
      this.utilsSvc.presentToast({
        message: errorMessage,
        duration: 2000,
        color: 'danger',
        position: 'middle',
        icon: 'alert-circle-outline'
      });
    } finally {

      await loading.dismiss();
      this.isSubmitting = false;
    }
  }
  ///Todo este codigo es para poder agregar el producto al Fiado
  productosFiltrados(): Producto[] {
    if (!this.busquedaProducto) {
      return this.productos;
    }
    return this.productos.filter(p =>
      p.producto_nombre.toLowerCase().includes(this.busquedaProducto.toLowerCase())
    );
  }

  estaSeleccionado(producto: Producto): boolean {
    return this.productosSeleccionados.some(item => item.producto.id === producto.id);
  }

  toggleProductoSeleccionado(producto: Producto) {
    const index = this.productosSeleccionados.findIndex(item => item.producto.id === producto.id);

    if (index === -1) {
      // Añadir producto con cantidad inicial 1
      this.productosSeleccionados.push({ producto, cantidad: 1 });
    } else {
      // Remover producto
      this.productosSeleccionados.splice(index, 1);
    }
  }

  modificarCantidad(item: { producto: Producto, cantidad: number }, cambio: number) {
    const nuevaCantidad = item.cantidad + cambio;
    if (nuevaCantidad > 0) {
      item.cantidad = nuevaCantidad;
    } else {
      // Eliminar si la cantidad llega a 0
      this.eliminarProducto(item);
    }
    this.actualizarFormularioProductos();
  }

  eliminarProducto(item: { producto: Producto, cantidad: number }) {
    const index = this.productosSeleccionados.indexOf(item);
    if (index > -1) {
      this.productosSeleccionados.splice(index, 1);
    }
    this.actualizarFormularioProductos();
  }

  actualizarFormularioProductos() {
    const productosFormato = this.productosSeleccionados.map(item => ({
      producto_id: item.producto.id,
      cantidad: item.cantidad
    }));
    this.formulario_fiado.get('productos')?.setValue(productosFormato);
  }
  calcularSubtotal(): number {
    return this.productosSeleccionados.reduce((total, item) => {
      return total + (item.producto.precio) * item.cantidad;
    }, 0);
  }

  calcularMontoTotal(): number {
    let subtotal = 0;

    // Si hay productos seleccionados, calcular subtotal basado en ellos
    if (this.productosSeleccionados.length > 0) {
      subtotal = this.productosSeleccionados.reduce((total, item) => {
        return total + ((item.producto.precio) * item.cantidad);
      }, 0);
    } else {
      // Si no hay productos, usar el monto_total del formulario
      subtotal = this.formulario_fiado.get('monto_total')?.value || 0;
    }

    // Obtener el interés (convertirlo a decimal)
    const interes = this.formulario_fiado.get('interes')?.value || 0;
    const interesDecimal = interes / 100;

    // Calcular monto total con interés
    this.montoTotal = subtotal + (subtotal * interesDecimal);

    return this.montoTotal;
  }
  calcularInteres(): number {
    const subtotal = this.calcularSubtotal();
    const interes = this.formulario_fiado.get('interes')?.value || 0;
    return subtotal * (interes / 100);
  }
  actualizarMontoTotal() {
    // Forzar la actualización de la vista
    this.calcularMontoTotal();
  }

  // Modifica el método cargarFiador para inicializar fiadosFiltrados
  async cargarFiador() {
    const hasConnection = await this.networkService.checkConnection();
    if (!hasConnection) {
      this.isLoadingFiador = false;
      return;
    }
    this.isLoadingFiador = true;
    try {
      const Fiador = await lastValueFrom(this.FiadoService.obtenerFiado());
      this.Fiador = Fiador;
      //console.log('Fiador procesados:', this.Fiador);
      this.fiadosFiltrados = [...this.Fiador]; // Inicializa los fiados filtrados
    } catch (error) {
      //console.error('Error al cargar Fiador:', error);
      this.utilsSvc.presentToast({
        message: this.translateService.instant('Fiado error'),
        duration: 2000,
        color: 'danger',
        position: 'middle'
      });
    } finally {
      this.isLoadingFiador = false;
    }
  }

  // Método para filtrar los fiados en tiempo real
  filtrarFiados() {
    if (!this.busquedaFiado) {
      this.fiadosFiltrados = [...this.Fiador];
      return;
    }

    const termino = this.busquedaFiado.toLowerCase();
    this.fiadosFiltrados = this.Fiador.filter(fiado =>
      fiado.cliente_nombre.toLowerCase().includes(termino)
    );
  }
  // Agrega este método a tu componente
  obtenerNombreCliente(cliente: number | Cliente): string {
    if (typeof cliente === 'object') {
      return cliente.cliente_nombre;
    } else {
      const clienteEncontrado = this.clientes.find(c => c.id === cliente);
      return clienteEncontrado ? clienteEncontrado.cliente_nombre : 'Cliente no encontrado';
    }
  }
  //Agregar abono, es una funcion similar a Editar
  async agregarAbono() {
    // Verifica conexión a internet primero
    if (this.isSubmitting) return; // Evitar múltiples ejecuciones
    this.isSubmitting = true; // Bloquear botón

    const hasConnection = await this.networkService.checkConnection();

    if (!hasConnection) {
      this.isSubmitting = false;
      return;
    }


    // 1. Calcular el nuevo monto (resta)
    if (!this.montoPagoValido || !this.Fiadoreleccionado || this.montoPago === null) {
      return;
    }

    const loading = await this.utilsSvc.loading({
      spinner: 'crescent',
      cssClass: 'custom-loading'
    });
    await loading.present();
    //Formatear numero a 2 decimales
    const montoActualizado = parseFloat(
      (this.Fiadoreleccionado.deuda_total - this.montoPago).toFixed(2)
    );
    //Validacion para qe el monto no pueda ser menor que 0
    if (montoActualizado < 0) {
      this.utilsSvc.presentToast({
        message: this.translateService.instant('El monto resultante no puede ser negativo'),
        duration: 2000,
        color: 'danger'
      });
      loading.dismiss();
      return;
    }

    const abonoAnterior = this.Fiadoreleccionado.abono;
    const montoPagoParseado = parseFloat(this.montoPago.toFixed(2));

    this.FiadoService.abonarFiado(
      this.Fiadoreleccionado.id,
      montoPagoParseado,
      abonoAnterior
    ).subscribe({
      next: async (respuesta: any) => {

        await loading.dismiss();
        this.isSubmitting = false;
        if (respuesta?.detail === 'El fiado fue eliminado correctamente porque la deuda fue saldada.') {
          this.utilsSvc.presentToast({
            message: this.translateService.instant('El fiado fue eliminado porque ya no hay deuda'),
            duration: 2500,
            color: 'success',
            position: 'middle'
          });
        } else {
          this.utilsSvc.presentToast({
            message: this.translateService.instant('Abono agregado exitosamente'),
            duration: 2000,
            color: 'success',
            position: 'middle'
          });
        }

        // Actualiza vista según el resultado
        this.mostrarInputPago = false;
        this.showModalEditar = false;
        this.cargarFiador(); // Puedes optimizar esto si quieres actualizar localmente

        loading.dismiss();
      },
      error: (error) => {
        const mensaje = error?.error?.detail || 'Error al procesar abono';

        this.utilsSvc.presentToast({
          message: mensaje,
          duration: 2000,
          color: 'danger'
        });

        loading.dismiss();
        this.isSubmitting = false;
      }
    });
  }


  validarMontoPago() {
    if (this.montoPago === null || isNaN(this.montoPago)) {
      this.errorMonto = this.translateService.instant('El monto debe ser mayor a 0'),
        this.montoPagoValido = false;
      return;
    }

    const montoTotal = this.Fiadoreleccionado?.monto_total || 0;

    if (this.montoPago <= 0) {
      this.errorMonto = this.translateService.instant('El monto debe ser mayor a 0'),
        this.montoPagoValido = false;
    } else if (this.montoPago > montoTotal) {
      this.errorMonto = this.translateService.instant('El monto no puede ser mayor a la deuda actual'),
        this.montoPagoValido = false;
    } else {
      this.errorMonto = '';
      this.montoPagoValido = true;
    }
  }

  async eliminarFiado() {
    // Verifica conexión a internet primero
    const hasConnection = await this.networkService.checkConnection();
    if (!hasConnection) return;

    if (this.fiadoSeleccionado) {
      const loading = await this.utilsSvc.loading({
        spinner: 'crescent',
        cssClass: 'custom-loading'
      });
      await loading.present();

      try {
        this.FiadoService.eliminarFiado(this.fiadoSeleccionado.id).subscribe({
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


  cambiarIdioma(event: CustomEvent) {
    this.traductorService.setLanguage(event.detail.value); // Cambia el idioma usando el servicio
    this.currentLang = event.detail.value; // Actualiza el idioma actual

  }

  async ModalSettings(ev: Event) {
    const popover = await this.popoverCtrl.create({
      component: SettingsComponent,
      event: ev,
      translucent: true,
      showBackdrop: true
    });

    await popover.present();
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

  openModalFiadoProducto() {
    this.showModalFiado = true;
    // Resetear monto_total a 0 cuando es fiado de productos
    this.formulario_fiado.patchValue({
      monto_total: 0,
      abono: 0
    });
  }
  closeModalFiado() {
    this.showModalFiado = false;
    this.formulario_fiado.reset({
      interes: 0,
      productos: [],
      monto_total: 0
    });
    this.productosSeleccionados = [];
    this.clienteSeleccionado = null;
    this.montoTotal = 0;
  }
  // Añade estos métodos
  abrirModalProductos() {
    this.modalProductosAbierto = true;
  }

  agregarAbonoModalProductos() {
    this.modalProductosAbierto = false;
    this.actualizarFormularioProductos();
  }

  cerrarModalProductos() {
    this.modalProductosAbierto = false;
  }

  // Agrega estas funciones a tu componente
  openEditarModal(fiado: Fiado) {
    this.Fiadoreleccionado = fiado;
    this.formulario_fiado.patchValue({
      monto_total: fiado.monto_total,
      cliente: fiado.cliente,
      interes: fiado.interes
    });
    this.showModalEditar = true;
  }

  cerrarModalEditar() {
    this.showModalEditar = false;
    this.formulario_fiado.reset({
      monto_total: 0,
      interes: 0,
    });
  }

  cancelarPago() {
    this.mostrarInputPago = false;
    this.montoPago = null;
  }

  // Agrega estas funciones a tu componente
  openModalOtroFiado() {
    this.showModalOtroFiado = true;
    // Establecer el cliente actual desde el fiado seleccionado
    this.formulario_fiado.patchValue({
      cliente: this.Fiadoreleccionado?.cliente,  // Asegúrate que esto sea el ID, no el nombre
      monto_total: 0,
      interes: 0
    });
  }

  closeModalOtroFiado() {
    this.showModalOtroFiado = false;
    this.formulario_fiado.reset({
      interes: 0,
      productos: [],
      monto_total: 0
    });
    this.productosSeleccionados = [];
    this.montoTotal = 0;
  }


  openVisualizarFiadoModal(fiado: Fiado) {
    this.Fiadoreleccionado = fiado; // ¡Asigna el objeto fiado completo!
    // Si realmente necesitas parchear el formulario aquí para visualización, hazlo
    // Asegúrate de que `fiado.cliente` sea el ID si `formulario_fiado.get('cliente')` espera un ID
    this.formulario_fiado.patchValue({
      deuda_total: fiado.deuda_total,
      cliente: typeof fiado.cliente === 'object' ? fiado.cliente.id : fiado.cliente, // Asegura que sea el ID si fiado.cliente es un objeto Cliente
      interes: fiado.interes,
    });
    this.showVisualizarFiadoModal = true; // Asegúrate de que esta variable controla la visibilidad de TU MODAL DE VISUALIZACIÓN
    // Antes tenías `this.showModal = true;` que era para el modal de agregar.
  }

  // Renombra este método para que sea más claro
  cerrarVisualizarFiadoModal() { // Antes: cerrarVisualizarFiadoModalEditar()
    this.showVisualizarFiadoModal = false;
    this.Fiadoreleccionado = null; // Limpia la selección al cerrar
  }


  abrirModalEliminar(fiado: Fiado) {
    this.fiadoSeleccionado = fiado;
    this.showDeleteModal = true;
  }

  cerrarModalEliminar() {
    this.showDeleteModal = false;
    this.fiadoSeleccionado = null;
  }

  modalAbono() {
    this.mostrarInputPago = true;
    this.montoPago = null;
    this.montoPagoValido = false;
    this.errorMonto = '';
  }
}
