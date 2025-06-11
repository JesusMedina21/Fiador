import { CommonModule } from '@angular/common';
import { Component, inject, OnInit } from '@angular/core';
import { AbstractControl, FormBuilder, FormControl, FormGroup, FormsModule, ReactiveFormsModule, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { IonicModule, NavController } from '@ionic/angular';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Login } from 'src/app/models/login';
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

  constructor(
    private router: Router,
    private utilsSvc: UtilsService,
    private translateService: TranslateService,
    private navCtrl: NavController, //ESTE codigo siempre ve a a llevar a la pagina anterior 
    private networkService: NetworkService
  ) { }


  public formulario_registro: FormGroup = this.fb.group({
    username: new FormControl('', [Validators.required, Validators.minLength(4)]),
    email: new FormControl('', [Validators.email, Validators.required]),
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

  async registrar() {
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
          username: this.formulario_registro.value.username,
          password: this.formulario_registro.value.password,
          biometric: this.formulario_registro.value.biometric,
        };

        this.authService.registroUsuario(objeto).subscribe({
          next: () => {
            // Pasamos loading al login
            this.loginUsuario(objeto.email, objeto.password, loading); // ✅ PASAR loading

          },
          error: async (error) => {

            let message = this.translateService.instant('Error registro'); // Mensaje por defecto
            let color: 'danger' | 'warning' = 'danger';

            if (error.status === 400 || error.status === 409) {
              if (error.error?.email?.[0] || (typeof error.error === 'string' && error.error.includes('email'))) {
                message = this.translateService.instant('Cuenta existente');


              }
            }

            await this.utilsSvc.presentToast({
              message: message,
              //uso message, en vez de definir aqui mismo, porque segun el tipo de error
              //es el tipo de mensaje
              duration: 2000,
              color,
              position: 'middle',
              icon: 'alert-circle-outline'
            });

            await loading.dismiss();
          }
        });

      } catch (error) {
        //console.error(error);

        await this.utilsSvc.presentToast({
          message: this.translateService.instant('Completar_Campos'),
          duration: 2000,
          color: 'danger',
          position: 'middle',
          icon: 'alert-circle-outline'
        });

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
    }
  }


  async loginUsuario(email: string, password: string, loading?: HTMLIonLoadingElement) {

    const hasConnection = await this.networkService.checkConnection();
    if (!hasConnection) return;

    const loginObject: Login = { email, password };

    this.authService.login(loginObject).subscribe({
      next: (response) => {
        if (response && response.access) {
          // 1. Guardar token
          localStorage.setItem('token', response.access);

          // 2. Obtener detalles del usuario (incluyendo userId)
          this.authService.getUserDetails().subscribe({
            next: async (user) => {

              // 3. Guardar userId en localStorage
              localStorage.setItem('userId', user.id.toString());

              // 4. Mostrar mensaje de éxito
              await this.utilsSvc.presentToast({
                message: this.translateService.instant('Felicitaciones registro'),
                duration: 2000,
                color: 'success',
                position: 'middle',
                icon: 'checkmark-circle-outline'
              });

              // 5. Cerrar loading (ahora que TODO está completo)
              await loading?.dismiss();

              // 6. Navegar
              this.router.navigate(['/']);

            },
            error: async (err) => {
              //console.error("Error al obtener detalles del usuario:", err);
              await loading?.dismiss();

              await this.utilsSvc.presentToast({
                message: 'Error al obtener información del usuario',
                duration: 2500,
                color: 'warning',
                position: 'middle',
                icon: 'alert-circle-outline'
              });
            }
          });
        } else {
          //console.log("Respuesta inesperada:", response);
          loading?.dismiss();

        }
      },
      error: async (error) => {
        //console.error("Error en el login:", error);

        await loading?.dismiss(); // Cerramos el primer loading

        // Segundo loading opcional antes del mensaje de error
        const errorLoading = await this.utilsSvc.loading({
          message: 'Verificando...',
          duration: 800, // corto
          spinner: 'dots',
          cssClass: 'custom-loading'
        });

        await errorLoading.present();

        await this.utilsSvc.presentToast({
          message:
            error.status === 0
              ? 'Has perdido la conexión a Internet. Intenta más tarde.'
              : error.status === 401
                ? 'Las credenciales no coinciden.'
                : 'Error al intentar iniciar sesión.',
          duration: 2500,
          color: error.status === 0 ? 'warning' : 'danger',
          position: 'middle',
          icon: 'alert-circle-outline'
        });

        await errorLoading.dismiss();
      }
    });
  }


}
