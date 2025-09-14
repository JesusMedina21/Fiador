import { CommonModule } from '@angular/common';
import { Component, inject, OnInit } from '@angular/core';
import { AbstractControl, FormBuilder, FormControl, FormGroup, FormsModule, ReactiveFormsModule, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { IonicModule, NavController } from '@ionic/angular';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Capacitor } from '@capacitor/core';
import { User } from 'src/app/models/user.model';
import { AuthService } from 'src/app/services/auth.service';
import { NetworkService } from 'src/app/services/network.service';
import { UtilsService } from 'src/app/services/utils.service';

@Component({
  selector: 'app-register',
  templateUrl: './register.component.html',
  styleUrls: ['./register.component.scss'],
  imports: [IonicModule, TranslateModule, ReactiveFormsModule, CommonModule, FormsModule]
})
export class RegisterComponent implements OnInit {

  private readonly fb = inject(FormBuilder);
  private authService = inject(AuthService);

  isSubmitting: boolean = false;
  isMobile: boolean;

  constructor(
    private router: Router,
    private utilsSvc: UtilsService,
    private translateService: TranslateService,
    private navCtrl: NavController, //ESTE codigo siempre ve a a llevar a la pagina anterior 
    private networkService: NetworkService
  ) { 
      // Verifica si la plataforma es móvil
      this.isMobile = Capacitor.getPlatform() === 'android' || Capacitor.getPlatform() === 'ios';
    }


  public formulario_registro: FormGroup = this.fb.group({
    username: new FormControl('', [Validators.required, Validators.minLength(4)]),
    email: new FormControl('', [Validators.email, Validators.required]),
    recovery_email: new FormControl('', [Validators.email, Validators.required]),
    biometric: new FormControl(null),
    password: new FormControl('', [Validators.required, Validators.minLength(8)]),
    confirm_password: new FormControl('', [Validators.required, Validators.minLength(8)])
  }, {
    validators: this.contraseñasCoinciden() // Aquí está el cambio importante
  });


  goBack() {
    this.navCtrl.back(); // Va a la página anterior
  }

  ngOnInit() { }


  private contraseñasCoinciden(): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      const contrasena = control.get('password')?.value;
      const confirmPassword = control.get('confirm_password')?.value;
      return contrasena === confirmPassword ? null : { 'contraseñasCoinciden': true }; // Corrección: usar 'contraseñasCoinciden' como clave
    };
  }

  googleLogin() {
    this.authService.googleLogin();
  }

  googleLoginMovil() {
    this.authService.googleLoginMovil();
  }

  async registrar() {
    if (this.isSubmitting) return; // Evita múltiples ejecuciones
    this.isSubmitting = true; // Bloquea el botón

    const hasConnection = await this.networkService.checkConnection();
    if (!hasConnection) return;

    if (this.formulario_registro.valid) {
      const loading = await this.utilsSvc.loading({
        spinner: 'crescent',
        cssClass: 'custom-loading'
      });

      await loading.present();

      try {
        const objeto: User = {
          id: this.formulario_registro.value.id,
          email: this.formulario_registro.value.email,
          recovery_email: this.formulario_registro.value.recovery_email,
          username: this.formulario_registro.value.username,
          password: this.formulario_registro.value.password,
          biometric: this.formulario_registro.value.biometric,
        };

        this.authService.registroUsuario(objeto).subscribe({
          next: async () => {
            localStorage.setItem('last_registered_email', objeto.email);
            localStorage.setItem('last_registered_password', objeto.password);
            await loading.dismiss();
            this.isSubmitting = false;

            // ✅ Mensaje de confirmación en lugar de login automático
            await this.utilsSvc.presentToast({
              message: this.translateService.instant('Confirmar Email'),
              duration: 3000,
              color: 'success',
              position: 'middle',
              icon: 'mail-outline'
            });

            // 👉 Opcional: mandamos al login
            this.router.navigate(['/login']);
          },
          error: async (error) => {
            let message = this.translateService.instant('Error registro');
            let color: 'danger' | 'warning' = 'danger';

            if (error.status === 400 || error.status === 409) {
              // Caso email ya existe
              if (error.error?.email?.[0]) {
                message = this.translateService.instant('Cuenta existente');
              }

              // Caso recovery_email ya existe
              else if (error.error?.recovery_email?.[0]) {
                message = this.translateService.instant('Ese correo de recuperación ya existe, agrega otro');
              }
            }


            await this.utilsSvc.presentToast({
              message,
              duration: 2000,
              color,
              position: 'middle',
              icon: 'alert-circle-outline'
            });

            await loading.dismiss();
            this.isSubmitting = false;
          }
        });

      } catch (error) {
        await this.utilsSvc.presentToast({
          message: this.translateService.instant('Completar_Campos'),
          duration: 2000,
          color: 'danger',
          position: 'middle',
          icon: 'alert-circle-outline'
        });

        this.isSubmitting = false;
        await loading.dismiss();
      }

    } else {
      this.utilsSvc.presentToast({
        message: this.translateService.instant('Completar_Campos'),
        duration: 2000,
        color: 'warning',
        position: 'middle',
        icon: 'alert-circle-outline'
      });
      this.isSubmitting = false;
    }
  }

}