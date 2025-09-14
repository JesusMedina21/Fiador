import { Component, inject, OnInit } from '@angular/core';
import { FormBuilder, FormControl, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from 'src/app/services/auth.service';
import { UtilsService } from 'src/app/services/utils.service';
import { IonicModule } from '@ionic/angular';
import { CommonModule } from '@angular/common';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

@Component({
  selector: 'app-forgot-account',
  templateUrl: './forgot-account.component.html',
  styleUrls: ['./forgot-account.component.scss'],
  imports: [IonicModule, TranslateModule, ReactiveFormsModule, CommonModule, FormsModule]
})

export class ForgotAccountComponent implements OnInit {

  formulario_forgot: FormGroup = this.fb.group({
    email: new FormControl('', [Validators.required, Validators.email])
  });

  formulario_email!: FormGroup;
  private translateService = inject(TranslateService);
  isSubmitting = false;

  // 🔽 Control del tipo de recuperación
  tipoRecuperacion: 'password' | 'email' = 'password';

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private utilsSvc: UtilsService,
  ) { }

  ngOnInit() {
    this.formulario_email = this.fb.group({
      email: ['', [Validators.required, Validators.email]]
    });
  }

  async enviarReset() {
    if (this.isSubmitting || this.formulario_forgot.invalid) return;

    this.isSubmitting = true;

    const loading = await this.utilsSvc.loading({
      spinner: 'crescent',
      cssClass: 'custom-loading'
    });

    await loading.present();

    const email = this.formulario_forgot.value.email;

    this.authService.ForgotPassword(email).subscribe({
      next: async () => {
        await loading.dismiss();
        this.isSubmitting = false;
        await this.utilsSvc.presentToast({
          message: this.translateService.instant('Reestablecer contraseña'),
          duration: 3000,
          color: 'success',
          position: 'middle',
          icon: 'mail-outline'
        });
      },
      error: async (error) => {
        await loading.dismiss();
        this.isSubmitting = false;
        await this.utilsSvc.presentToast({
          message: this.translateService.instant('Error reestablecer'),
          duration: 3000,
          color: 'danger',
          position: 'middle',
          icon: 'alert-circle-outline'
        });
      }
    });
  }

  async enviarResetEmail() {
    if (this.isSubmitting || this.formulario_email.invalid) return;
    this.isSubmitting = true;

    const loading = await this.utilsSvc.loading({
      spinner: 'crescent',
      cssClass: 'custom-loading'
    });

    await loading.present();

    const email = this.formulario_email.value.email;

    this.authService.ForgotEmail(email).subscribe({
      next: async () => {
        await loading.dismiss();
        this.isSubmitting = false;
        await this.utilsSvc.presentToast({
          message: this.translateService.instant('Reestablecer email'),
          duration: 3000,
          position: 'middle',
          color: 'success',
          icon: 'mail-outline'
        });
      },
      error: async (err) => {
        await loading.dismiss();
        this.isSubmitting = false;

        // 🔽 Detectamos si el backend manda un mensaje específico
        let errorMsg = this.translateService.instant('Correo inexistente');
        if (err.status === 400 && err.error?.email) {
          errorMsg = this.translateService.instant('Correo inexistente');
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
}
