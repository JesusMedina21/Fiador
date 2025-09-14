import { Component, inject, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { IonicModule, AlertController} from '@ionic/angular';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { AuthService } from 'src/app/services/auth.service';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { UtilsService } from 'src/app/services/utils.service';

@Component({
  selector: 'app-email-new',
  templateUrl: './email-new.component.html',
  styleUrls: ['./email-new.component.scss'],
  imports: [IonicModule, TranslateModule, ReactiveFormsModule, CommonModule, FormsModule]
})
export class EmailNewComponent implements OnInit {

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

      this.authService.activarNewEmail({ uid, token }).subscribe({
        next: async (response: any) => {
          await loading.dismiss();
          
          // ✅ Login automático con tokens
          if (response.tokens) {
            this.authService.loginWithTokens(response.tokens);
            
            // 👇 Mostrar modal de felicitación
            const alert = await this.alertController.create({
              header: this.translateService.instant('Felicitaciones email confirmado'),
              message: this.translateService.instant('Ha iniciado sesión correctamente'),
              mode: 'ios',
              cssClass: 'biometric-alert',
              buttons: [
                {
                  text: 'OK',
                  handler: () => {
                    this.router.navigate(['/']);
                  }
                }
              ]
            });
            await alert.present();
          } else {
            // Si no vienen tokens, redirigir al login
            this.router.navigate(['/login']);
          }
        },
        error: async (error) => {
          await loading.dismiss();
          
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
      // Si no hay uid o token, redirigir al login
      this.router.navigate(['/login']);
    }
  }
}