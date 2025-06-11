import { Component, inject, OnDestroy, OnInit } from '@angular/core';
import { FormBuilder, FormControl, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AlertController, IonicModule, NavController, ToastController } from '@ionic/angular';
//este import lo saco de esta url 
import { NativeBiometric, BiometryType } from "capacitor-native-biometric";
//https://www.npmjs.com/package/capacitor-native-biometric
import { Capacitor } from '@capacitor/core';
import * as CryptoJS from 'crypto-js';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { CommonModule } from '@angular/common';
import { UtilsService } from 'src/app/services/utils.service';
import { Login } from 'src/app/models/login';
import { AuthService } from 'src/app/services/auth.service';
import { Subject, takeUntil } from 'rxjs';
import { NetworkService } from 'src/app/services/network.service';

//este codigo es hecho en el tutorial para el correcto funcionamiento
//de la huella en celulares
const key = 'codigopruebaencriptado'
interface User { email: string, password: string }

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss'],
  imports: [IonicModule, TranslateModule, ReactiveFormsModule, CommonModule],
})
export class LoginComponent implements OnInit, OnDestroy {

  showFingerprintButton: boolean = false;

  private readonly fb = inject(FormBuilder);

  private authService = inject(AuthService);
  public showProfileView: boolean = false;
  public lastUsername: string = '';

  private destroy$ = new Subject<void>();

  public formulario_login: FormGroup = this.fb.group({
    email: new FormControl('', [Validators.email, Validators.required]),
    password: new FormControl('', [Validators.required, Validators.minLength(8)]),
  })

  isMobile: boolean;

  constructor(
    private router: Router,
    private alertController: AlertController,
    private toastController: ToastController,
    private utilsSvc: UtilsService,
    private navCtrl: NavController, //ESTE codigo siempre ve a a llevar a la pagina anterior 
    private translateService: TranslateService,
    private networkService: NetworkService
  ) {
    // Verifica si la plataforma es móvil
    this.isMobile = Capacitor.getPlatform() === 'android' || Capacitor.getPlatform() === 'ios';

    // Suscribirse a eventos de logout
    this.authService.logout$.pipe(
      takeUntil(this.destroy$)
    ).subscribe(() => {
      this.checkBiometricData();
    });

  }

  goBack() {
    this.navCtrl.back(); // Va a la página anterior
  }

  ngOnInit() {
    this.checkBiometricData();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  async iniciar_sesion_web() {
    const hasConnection = await this.networkService.checkConnection();
    if (!hasConnection) return;
    if (this.formulario_login.valid) {
      const loading = await this.utilsSvc.loading({
        spinner: 'crescent',
        cssClass: 'custom-loading'
      });

      await loading.present(); // Mostrar loading

      const objeto: Login = {
        email: this.formulario_login.value.email,
        password: this.formulario_login.value.password
      };

      this.authService.login(objeto).subscribe({
        next: async (data) => {
          if (data && data.access) {
            localStorage.setItem("token", data.access);

            // Obtener detalles del usuario
            this.authService.getUserDetails().subscribe({
              next: async (user) => {
                localStorage.setItem('userId', user.id.toString()); // Almacenar el id del usuario
                //El loading se coloca en este lugar para indicar que aqui se cerrara cuando se complete todo el proceso
                await loading.dismiss();

                await this.utilsSvc.presentToast({
                  message: this.translateService.instant('Felicitaciones login'),
                  duration: 2000,
                  color: 'success',
                  position: 'middle',
                  icon: 'checkmark-circle-outline'
                });
                this.router.navigate(['/']);
              },
              error: async (err) => {
                //console.error('Error al obtener detalles del usuario:', err);
                await this.utilsSvc.presentToast({
                  message: this.translateService.instant('Error al obtener detalles del usuario'),
                  duration: 2500,
                  color: 'danger',
                  position: 'middle',
                  icon: 'alert-circle-outline'
                });
              }
            });
          } else {
            await this.utilsSvc.presentToast({
              message: this.translateService.instant('Error login'),
              duration: 2000,
              color: 'danger',
              position: 'middle',
              icon: 'alert-circle-outline'
            });
          }
        },
        error: async (err) => {
          await loading.dismiss();
          //console.error('Error en el inicio de sesión:', err);
          await this.utilsSvc.presentToast({
            message: this.translateService.instant('Login incorrecto'),
            duration: 2500,
            color: 'danger',
            position: 'middle',
            icon: 'alert-circle-outline'
          });
        }
      });
    }
  }


  async iniciar_sesion_huella() {

    const hasConnection = await this.networkService.checkConnection();
    if (!hasConnection) return;
    if (this.formulario_login.valid) {

      const loading = await this.utilsSvc.loading({
        spinner: 'crescent',
        cssClass: 'custom-loading'
      });

      await loading.present();

      try {
        const formValue = this.formulario_login.value as User;

        // PRIMERO validamos las credenciales
        const loginResponse = await this.authService.login(formValue).toPromise();

        if (!loginResponse || !loginResponse.access) {
          throw new Error('Credenciales inválidas');
        }

        //const huella_disponible = true //codigo para pruebas en el navegador
        const huella_disponible = await this.funcion_huella_disponible();

        const huella_existente = localStorage.getItem('biometric');
        //lo que dices es que si en la variable biometric
        //existe en el localStorage, el existe lo usa con el getItem la
        //variable biometric

        const noPreguntarHuella = localStorage.getItem('noPreguntarHuella');

        //Al tener esta constante noPreguntarHuella, almacena la informacion en el
        //localstorage, lo que hace que el !noPreguntarHuella no ejecute la pregunta del
        //acceso biometrico si la variable es true en el localStorage

        if (huella_disponible && !huella_existente && !noPreguntarHuella) {
          const alert = await this.alertController.create({
            header: this.translateService.instant('ACCESO_BIOMETRICO'), // Traducción del encabezado
            message: this.translateService.instant('PERMITIR_ACCESO_BIOMETRICO'), // Traducción del mensaje
            mode: 'ios',
            backdropDismiss: false,
            cssClass: 'biometric-alert', // Css personalizado
            buttons: [
              //Este codigo es lo que debe hacer si el usuario cancelo la huella
              {
                text: this.translateService.instant('NO_GRACIAS'), // Traducción del botón "No, gracias"
                role: 'cancel',
                handler: async () => {
                  localStorage.setItem('noPreguntarHuella', 'true'); // Almacena la variable noPreguntarHuella
                  const innerLoading = await this.utilsSvc.loading({
                    spinner: 'crescent',
                    cssClass: 'custom-loading'
                  });
                  await innerLoading.present();
                  try {

                    await this.hacerLoginSinHuella(formValue);
                  } catch (error) {
                    //console.error(error);
                    await this.errorHuella(error);
                  } finally {
                    innerLoading.dismiss();
                  }
                }
              },
              //Este codigo es lo que debe hacer si el usuario acepto la huella
              {

                text: this.translateService.instant('HABILITAR'),
                handler: async () => {
                  const innerLoading = await this.utilsSvc.loading({
                    spinner: 'crescent',
                    cssClass: 'custom-loading'
                  });
                  await innerLoading.present();

                  try {
                    await this.guardarHuellaYActualizarUsuario(formValue);
                  } catch (error) {
                    //console.error(error);
                    await this.errorHuella(error);
                  } finally {
                    innerLoading.dismiss();
                  }
                }
              }
            ]
          });

          await alert.present();
          return;

        }

        await this.hacerLoginSinHuella(formValue);

      } catch (error) {

        this.utilsSvc.presentToast({
          message: this.translateService.instant('Login incorrecto'),
          duration: 2000,
          color: 'danger',
          position: 'middle',
          icon: 'alert-circle-outline'
        });

      } finally {
        loading.dismiss(); // Oculta el loading pase lo que pase
      }


    } else {
      this.utilsSvc.presentToast({
        message: this.translateService.instant('Completa_Campos_Login_Huella'),
        duration: 2000,
        color: 'warning',
        position: 'middle',
        icon: 'alert-circle-outline'
      });
    }

  }

  //Este codigo es en caso de que el usuario dijo que no queria registrar la huella para logearse
  async hacerLoginSinHuella(formValue: User) {
    try {
      const loginResponse = await this.authService.login(formValue).toPromise();
      if (loginResponse && loginResponse.access) {
        localStorage.setItem('token', loginResponse.access);

        // Obtener datos del usuario para almacenar el userId
        const userDetails = await this.authService.getUserDetails().toPromise();
        if (userDetails) {
          localStorage.setItem('userId', userDetails.id.toString()); // Almacenar el id del usuario
        }

        await this.utilsSvc.presentToast({
          message: this.translateService.instant('Felicitaciones login'),
          duration: 2000,
          color: 'success',
          position: 'middle',
          icon: 'checkmark-circle-outline'
        });

        this.router.navigateByUrl('/');
      }
    } catch (error) {
      await this.errorHuella(error);
    }
  }


  //Guardar huella de manera encriptada en caso de que el usuario haya escogido logearse con huella
  private async guardarHuellaYActualizarUsuario(formValue: User) {
    try {
      // Para desarrollar en el navegador
      //const verified = true;

      const verified = await this.performBiometricVerificatin()

      if (!verified) throw new Error('Biometric verification failed');

      // 2. Encriptar credenciales
      const credentials = JSON.stringify(formValue);
      const encryptedData = CryptoJS.AES.encrypt(credentials, key).toString();
      localStorage.setItem('biometric', encryptedData);

      // 3. Hacer login
      const loginResponse = await this.authService.login(formValue).toPromise();
      if (!loginResponse) throw new Error('Login failed');

      // 4. Actualizar usuario con huella en el backend
      await this.authService.updateUserWithBiometric(encryptedData).toPromise();

      // 5. Obtener datos del usuario para almacenar el userId
      const userDetails = await this.authService.getUserDetails().toPromise();
      if (userDetails) {
        localStorage.setItem('userId', userDetails.id.toString()); // Almacenar el id del usuario
      }

      // 6. Mostrar éxito y redirigir
      await this.utilsSvc.presentToast({
        message: this.translateService.instant('Huella registrada'),
        duration: 2000,
        color: 'success',
        position: 'middle',
        icon: 'checkmark-circle-outline'
      });

      this.formulario_login.reset();
      this.router.navigateByUrl('/');

    } catch (error) {
      //console.error('Error al guardar huella:', error);
      await this.errorHuella(error);
    }
  }
  //Esta es la funcionalidad del icono de la huella despues que el usaurio agrego la huella
  async registrarHuella() {
    const verified = await this.performBiometricVerificatin();

    if (verified) {
      const credentials = this.obtenerDatosConHuella();
      if (credentials) {
        this.authService.login(credentials).subscribe({
          next: (response) => {
            // Después de login exitoso, verificamos si ya tiene huella registrada en el backend
            const userId = this.authService.getCurrentUserId();
            if (userId) {
              const biometricData = localStorage.getItem('biometric') || '';
              this.authService.updateUserWithBiometric(biometricData).subscribe({
                next: () => this.router.navigateByUrl('/'),
                error: () => this.errorHuella()
              });
            } else {
              this.errorHuella();
            }
          },
          error: () => this.errorHuella()
        });
      }



      //puedo hacer login con estas credenciales
      //se mandan desencriptadas a firebase o encriptadas al backend
      //todo depende de la necesidad y como se quiere implementar en el proyecto
      //ojo, todo esto es referente al console.log

    } else {
      await this.errorHuella();
    }
  }


  ///Este codigo de Autenticacion lo voy a sacar de esta url
  //https://www.npmjs.com/package/capacitor-native-biometric

  //Verificacion Biometrica
  async performBiometricVerificatin() {

    // const result = await NativeBiometric.isAvailable();

    //if(!result.isAvailable) return;

    //const isFaceID = result.biometryType == BiometryType.FACE_ID;

    const verified = await NativeBiometric.verifyIdentity(
      //{
      //reason: "For easy log in",
      //title: "Log in",
      //subtitle: "Maybe add subtitle here?",
      //description: "Maybe a description too?",
      //}
    )
      .then(() => true)
      .catch(() => false);

    return verified


  }


  ///Funcion para que el HTML pregunta si quiere agregar huella despues de cancelarla
  async preguntarAgregarHuella() {
    const formValue = this.formulario_login.value as User;

    if (!this.formulario_login.valid) {
      this.utilsSvc.presentToast({
        message: this.translateService.instant('Completar_Campos'),
        duration: 2000,
        color: 'warning',
        position: 'middle',
        icon: 'alert-circle-outline'
      });
      return;
    }

    const alert = await this.alertController.create({
      header: this.translateService.instant('ACCESO_BIOMETRICO'),
      message: this.translateService.instant('PERMITIR_ACCESO_BIOMETRICO'),
      mode: 'ios',
      backdropDismiss: false,
      cssClass: 'biometric-alert', // Css personalizado
      buttons: [
        {
          text: this.translateService.instant('NO'),
          role: 'cancel',
          handler: async () => {
            await this.utilsSvc.presentToast({
              message: this.translateService.instant('Huella cancelada'),
              duration: 2000,
              color: 'warning',
              icon: 'alert-circle-outline',
              position: 'middle'
            });
          }
        },



        {
          text: this.translateService.instant('SI'),
          handler: async () => {
            const innerLoading = await this.utilsSvc.loading({
              spinner: 'crescent',
              cssClass: 'custom-loading'
            });
            await innerLoading.present();

            try {

              localStorage.removeItem('noPreguntarHuella');
              await this.guardarHuellaYActualizarUsuario(formValue);
            } catch (error) {
              //console.error(error);
              await this.errorHuella(error);
            } finally {
              innerLoading.dismiss();
            }
          }
        }
      ]
    });

    await alert.present();
  }


  // Agrega este método en tu clase LoginComponent
  NoPreguntarHuella(): boolean {
    return localStorage.getItem('noPreguntarHuella') !== null;
  }

  //Validacion para saber si la huella esta disponible
  async funcion_huella_disponible() {

    const available = await NativeBiometric.isAvailable(
    )
      .then(res => res.isAvailable)
      .catch(() => false);

    return available

  }


  obtenerDatosConHuella() {
    const encryptedData = localStorage.getItem('biometric');
    if (encryptedData) {
      const bytes = CryptoJS.AES.decrypt(encryptedData, key);
      const credentials = JSON.parse(bytes.toString(CryptoJS.enc.Utf8));

      return credentials
    } else {
      return null;
    }

  }

  //Error al no ingresar la huella
  async errorHuella(error?: any) {
    let message = this.translateService.instant('Login incorrecto huella');

    // Mensajes más específicos según el tipo de error
    if (error?.status === 401) {
      message = this.translateService.instant('ERROR_AUTENTICACION');
    } else if (error?.status === 404) {
      message = this.translateService.instant('USUARIO_NO_ENCONTRADO');
    } else if (error?.message?.includes('Failed to update biometric data')) {
      message = this.translateService.instant('ERROR_ACTUALIZAR_HUELLA');
    }

    const toast = await this.toastController.create({
      message: message,
      duration: 2000,
      color: 'danger',
      icon: 'alert-circle-outline'
    });
    toast.present();
  }


  //Codigo para mantener el perfil e iniciar con la pura huella despues de cerrar sesion
  private checkBiometricData() {
    const biometricData = localStorage.getItem('biometric');
    if (biometricData) {
      try {
        const bytes = CryptoJS.AES.decrypt(biometricData, key);
        const credentials = JSON.parse(bytes.toString(CryptoJS.enc.Utf8));
        this.lastUsername = credentials.email.split('@')[0];
        this.showProfileView = true;
      } catch (error) {
        //console.error('Error al decodificar datos biométricos:', error);
        this.showProfileView = false;
      }
    } else {
      this.showProfileView = false;
    }
  }

  //Este codigo es cuando el usuario despues que cerro sesion y tiene la huella y quiere logearse con otro perfil
  UsarOtraCuenta() {
    // Borrar los datos biométricos almacenados
    localStorage.removeItem('biometric');

    // Borro este dato por si acaso
    localStorage.removeItem('noPreguntarHuella');

    // Restablecer la vista
    this.showProfileView = false;
    this.formulario_login.reset();
  }

  // Método para iniciar sesión directamente con huella sin agregar usuario ni contraseña
  async loginWithBiometric() {
    // Crear y mostrar el loading
    const loading = await this.utilsSvc.loading({
      spinner: 'crescent',
      cssClass: 'custom-loading'
    });

    try {
      await loading.present();


      //const verified = true; //prueba en el navegador

      // 1. Primero verificar la huella
      const verified = await this.performBiometricVerificatin();
      if (!verified) {
        throw new Error('Verificación biométrica fallida');
      }

      // 2. Obtener credenciales almacenadas
      const credentials = this.obtenerDatosConHuella();
      if (!credentials) {
        throw new Error('No se encontraron credenciales biométricas');
      }

      // 3. Intentar login con las credenciales
      const loginResponse = await this.authService.login(credentials).toPromise();
      if (!loginResponse?.access) {
        throw new Error('Credenciales inválidas');
      }

      // 4. Login exitoso
      localStorage.setItem('token', loginResponse.access);

      // Obtener datos del usuario para almacenar el userId
      const userDetails = await this.authService.getUserDetails().toPromise();
      if (userDetails) {
        localStorage.setItem('userId', userDetails.id.toString()); // Almacenar el id del usuario
      }

      await this.utilsSvc.presentToast({
        message: this.translateService.instant('Felicitaciones login'),
        duration: 2000,
        color: 'success',
        position: 'middle',
        icon: 'checkmark-circle-outline'
      });

      this.router.navigateByUrl('/');

    } catch (error) {
      await this.errorHuella(error);

    } finally {
      await loading.dismiss();
    }
  }
}
