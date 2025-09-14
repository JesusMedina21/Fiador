import { Component, ElementRef, inject, Input, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { TraductorService } from 'src/app/services/traductor.service';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { AlertController, IonicModule, PopoverController } from '@ionic/angular';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormControl, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { ThemeService } from 'src/app/services/theme.service';
import { UtilsService } from 'src/app/services/utils.service';
import { AuthService } from 'src/app/services/auth.service';
import { Network } from '@capacitor/network';
import { Router } from '@angular/router';
import { lastValueFrom } from 'rxjs';

@Component({
  selector: 'app-settings',
  templateUrl: './settings.component.html',
  styleUrls: ['./settings.component.scss'],
  imports: [IonicModule, TranslateModule, ReactiveFormsModule, CommonModule, FormsModule],
})
export class SettingsComponent implements OnInit, OnDestroy {


  @ViewChild('miBoton') miBotonRef!: ElementRef<HTMLButtonElement>;

  private fb = inject(FormBuilder);
  private utilsSvc = inject(UtilsService);
  private authService = inject(AuthService);
  private router = inject(Router);
  private alertController = inject(AlertController); // ✅ Agregar AlertController

  isSubmitting = false;
  isSubmittingEmail = false;
  networkChecking: boolean = false;
  isOnline: boolean = true;
  deletingAccount = false; // ✅ Nueva variable para controlar el estado de eliminación

  langs: string[] = [];
  currentLang: string = '';
  showModalCambiarEmail = false;
  showModalEliminarCuenta = false;
  currentUserEmail: string = '';

  constructor(
    private traductorService: TraductorService,
    private translateService: TranslateService,
    public themeService: ThemeService,
    private popoverCtrl: PopoverController
  ) {
    this.langs = this.traductorService.getLangs();
    this.currentLang = this.traductorService.getCurrentLanguage();
    this.currentUserEmail = this.authService.getCurrentUserId() || '';
  }

  formulario_forgot_email: FormGroup = this.fb.group({
    email: new FormControl('', [Validators.required, Validators.email])
  });

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
  async cambiarEmail() {
    // 🎯 Inicia el proceso de envío y habilita el loading
    this.isSubmittingEmail = true;

    const loading = await this.utilsSvc.loading({
      spinner: 'crescent',
      cssClass: 'custom-loading'
    });
    await loading.present();

    this.authService.changeEmail().subscribe({
      next: async () => {
        await loading.dismiss();
        await this.utilsSvc.presentToast({
          message: this.translateService.instant('Reestablecer email'),
          duration: 3000,
          color: 'success',
          position: 'middle',
          icon: 'mail-outline'
        });
        // 🎯 Deshabilita el botón al finalizar con éxito
        this.isSubmittingEmail = false;
      },
      error: async (err) => {
        await loading.dismiss();
        // 🎯 Deshabilita el botón en caso de error
        this.isSubmittingEmail = false;

        // 🔽 Manejo de mensajes de error desde el backend
        let errorMsg = this.translateService.instant('Si inicias sesion con Google no puedes cambiar tu email');
        if (err.status === 400 && err.error?.detail) {
          errorMsg = err.error.detail;
        }

        await this.utilsSvc.presentToast({
          message: errorMsg,
          duration: 3000,
          position: 'middle',
          color: 'danger',
          icon: 'alert-circle-outline'
        });
      }
    });
  }

  async cambiarContrasena() {
    // 🎯 Deshabilita el botón al inicio
    this.isSubmitting = true;

    // Tu lógica original para obtener el email
    let userEmail = this.authService.getEmailFromToken();
    if (!userEmail) {
      try {
        const email = await lastValueFrom(this.authService.getCurrentUserEmail());
        userEmail = email;
      } catch (error) {
        await this.utilsSvc.presentToast({
          message: this.translateService.instant('Error reestablecer'),
          duration: 3000,
          color: 'danger',
          position: 'middle',
          icon: 'alert-circle-outline'
        });
        // 🎯 Re-habilita el botón en caso de error temprano
        this.isSubmitting = false;
        return;
      }
    }

    // 🎯 El loading debe ir después de la lógica de obtención del email
    const loading = await this.utilsSvc.loading({
      spinner: 'crescent',
      cssClass: 'custom-loading'
    });
    await loading.present();

    this.authService.ForgotPassword(userEmail).subscribe({
      next: async () => {
        await loading.dismiss();
        await this.utilsSvc.presentToast({
          message: this.translateService.instant('Reestablecer contraseña'),
          duration: 3000,
          color: 'success',
          position: 'middle',
          icon: 'mail-outline'
        });
        // 🎯 Re-habilita el botón cuando el proceso es exitoso
        this.isSubmitting = false;
      },
      error: async (err) => {
        await loading.dismiss();
        // 🎯 Re-habilita el botón en caso de error del backend
        this.isSubmitting = false;


      let errorMsg = this.translateService.instant('No puedes restablecer la contraseña. Tu cuenta está registrada a través de Google.');

        // ✅ Lógica mejorada para la traducción del error del backend
        if (err.status === 400 && err.error?.detail) {
          // Asumiendo que el mensaje de backend es consistente
          if (err.error.detail === "No puedes restablecer la contraseña. Tu cuenta está registrada a través de Google.") {
            errorMsg = this.translateService.instant('No puedes restablecer la contraseña. Tu cuenta está registrada a través de Google');
          } else {
            // Para otros errores 400, como de validación
            errorMsg = err.error.detail;
          }
        } else if (err.status === 404) {
          errorMsg = this.translateService.instant('Error reestablecer');
        }

        await this.utilsSvc.presentToast({
          message: errorMsg,
          duration: 3000,
          position: 'middle',
          color: 'danger',
          icon: 'alert-circle-outline'
        });
      }
    });
  }


  async eliminarCuenta() {
    // ✅ Mostrar alerta de confirmación
    const alert = await this.alertController.create({
      header: this.translateService.instant('Confirmar eliminación'),
      message: this.translateService.instant('¿Estás seguro de que quieres eliminar tu cuenta? Esta acción es irreversible.'),
      cssClass: 'biometric-alert', // Css personalizado
      buttons: [
        {
          text: this.translateService.instant('Cancelar'),
          role: 'cancel',
          cssClass: 'secondary'
        },
        {
          text: this.translateService.instant('Eliminar'),
          handler: () => {
            this.confirmarEliminacion();
          }
        }
      ]
    });

    await alert.present();
  }

  async confirmarEliminacion() {
    this.deletingAccount = true;

    // ✅ Cerrar también el popover si está abierto
    await this.popoverCtrl.dismiss().catch(() => { });

    const loading = await this.utilsSvc.loading({
      spinner: 'crescent',
      cssClass: 'custom-loading',
      message: this.translateService.instant('Eliminando cuenta...')
    });

    await loading.present();

    this.authService.deleteAccount().subscribe({
      next: async () => {
        await loading.dismiss();
        this.deletingAccount = false;

        // ✅ Cerrar el modal de eliminación primero
        this.closeModalEliminarCuenta();

        // ✅ Mostrar mensaje de éxito
        await this.utilsSvc.presentToast({
          message: this.translateService.instant('Cuenta eliminada exitosamente'),
          duration: 3000,
          color: 'success',
          position: 'middle',
          icon: 'checkmark-circle-outline'
        });

        // ✅ Cerrar sesión y redirigir
        this.authService.logout();
        this.closeModalEliminarCuenta();
        this.router.navigate(['/']);
      },
      error: async (error) => {
        await loading.dismiss();
        this.deletingAccount = false;

        let errorMessage = this.translateService.instant('Error al eliminar la cuenta');

        if (error.status === 401) {
          errorMessage = this.translateService.instant('No autorizado');
        } else if (error.status === 404) {
          errorMessage = this.translateService.instant('Usuario no encontrado');
        } else if (error.status === 500) {
          errorMessage = this.translateService.instant('Error del servidor');
        }

        await this.utilsSvc.presentToast({
          message: errorMessage,
          duration: 3000,
          color: 'danger',
          position: 'middle',
          icon: 'alert-circle-outline'
        });
      }
    });
  }


  async toggleTheme() {
    this.themeService.toggleTheme();
    await this.popoverCtrl.dismiss(); // Cierra el popover después de cambiar el tema
  }


  async cambiarIdioma(event: CustomEvent) {
    this.traductorService.setLanguage(event.detail.value);
    this.currentLang = event.detail.value;
    await this.popoverCtrl.dismiss(); // Cierra el popover después de cambiar el idioma
  }

  ngOnInit() { }

  ngOnDestroy(): void {
    if (this.miBotonRef && this.miBotonRef.nativeElement === document.activeElement) {
      document.body.focus(); // O enfocar otro elemento apropiado
    }
  }

  openModalCambiarEmail() {
    this.showModalCambiarEmail = true;
  }

  closeModalCambiarEmail() {
    this.showModalCambiarEmail = false;
  }

  openModalEliminarCuenta() {
    this.showModalEliminarCuenta = true;
  }

  closeModalEliminarCuenta() {
    this.showModalEliminarCuenta = false;
  }


}
