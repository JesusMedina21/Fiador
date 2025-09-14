import { Component, inject, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { IonicModule, AlertController } from '@ionic/angular';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { AuthService } from 'src/app/services/auth.service';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { UtilsService } from 'src/app/services/utils.service';
import { finalize } from 'rxjs/operators';

@Component({
  selector: 'app-email',
  templateUrl: './email.component.html',
  styleUrls: ['./email.component.scss'],
  imports: [IonicModule, TranslateModule, ReactiveFormsModule, CommonModule, FormsModule]
})
export class EmailComponent implements OnInit {

  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private authService = inject(AuthService);
  private utilsSvc = inject(UtilsService);
  private alertController = inject(AlertController);

  constructor(private translateService: TranslateService) {}

  async ngOnInit(): Promise<void> {
    const uid = this.route.snapshot.paramMap.get('uid');
    const token = this.route.snapshot.paramMap.get('token');

    if (uid && token) {
      // Mostrar loading
      const loading = await this.utilsSvc.loading({
        spinner: 'crescent',
        cssClass: 'custom-loading'
      });
      await loading.present();

      this.authService.activarEmail({ uid, token }).pipe(
        finalize(() => loading.dismiss()) // Asegura que el loading se cierre
      ).subscribe({
        next: async () => {
          // ✅ Ahora hacemos el auto-login DESPUÉS de que la activación termine
          await this.autoLogin();
          
          const alert = await this.alertController.create({
            header: this.translateService.instant('Felicitaciones email confirmado'),
            message: this.translateService.instant('Ha iniciado sesión correctamente'),
            mode: 'ios',
            cssClass: 'biometric-alert',
            buttons: [
              {
                text: 'OK',
                handler: () => {
                  this.router.navigate(['/']); // Redirige al home
                }
              }
            ]
          });
          await alert.present();
        },
        error: async (error) => {
          let errorMessage = this.translateService.instant('Error activando la cuenta');
          
          if (error.status === 400) {
            if (error.error?.token) {
              errorMessage = this.translateService.instant('Token inválido o expirado');
            } else if (error.error?.detail) {
              errorMessage = error.error.detail;
            }
          }
          
          await this.utilsSvc.presentToast({
            message: errorMessage,
            duration: 3000,
            color: 'danger',
            position: 'middle'
          });
          
          this.router.navigate(['/login']);
        }
      });
    } else {
      this.router.navigate(['/login']);
    }
  }

  private async autoLogin(): Promise<void> {
    const email = localStorage.getItem('last_registered_email');
    const password = localStorage.getItem('last_registered_password');

    if (!email || !password) {
      this.router.navigate(['/login']);
      return;
    }

    try {
      // Usamos una promesa para esperar a que el login termine
      await this.authService.login({ email, password }).toPromise();
      
      // Limpiamos las credenciales solo si el login fue exitoso
      localStorage.removeItem('last_registered_email');
      localStorage.removeItem('last_registered_password');
      
    } catch (error) {
      console.error('Error en auto-login:', error);
      // Si falla el auto-login, redirigimos al login normal
      this.router.navigate(['/login']);
    }
  }
}