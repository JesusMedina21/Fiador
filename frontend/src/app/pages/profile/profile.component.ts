import { Component, inject } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { AuthService } from 'src/app/services/auth.service';
import { UtilsService } from 'src/app/services/utils.service';
import { TranslateService } from '@ngx-translate/core';
import { IonicModule, ModalController } from '@ionic/angular';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'app-profile',
  templateUrl: './profile.component.html',
  styleUrls: ['./profile.component.scss'],
  imports: [IonicModule, TranslateModule, ReactiveFormsModule, CommonModule]
})
export class ProfileComponent {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private utilsSvc = inject(UtilsService);
  private translateService = inject(TranslateService);
  private modalCtrl = inject(ModalController);

  profileForm: FormGroup;
  isSubmitting = false;
  currentUser: any;
  primaryEmail: string = ''; // 👈 Nueva propiedad para el email principal

  constructor() {
    this.profileForm = this.fb.group({
      username: ['', [Validators.required, Validators.minLength(3)]],
      recovery_email: ['', [Validators.required, Validators.email]]
    });

    this.loadUserData();
  }
  async cambiarEmail() {
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

  async loadUserData() {
    const loading = await this.utilsSvc.loading({
      spinner: 'crescent',
      cssClass: 'custom-loading'
    });
    await loading.present();

    this.authService.getUserDetails().subscribe({
      next: (user) => {
        loading.dismiss();
        this.currentUser = user;
        this.primaryEmail = user.email; // 👈 Guardamos el email principal
        this.profileForm.patchValue({
          username: user.username,
          recovery_email: user.recovery_email
        });
      },
      error: async (error) => {
        loading.dismiss();
        await this.utilsSvc.presentToast({
          message: this.translateService.instant('Error al cargar datos del usuario'),
          duration: 3000,
          color: 'danger',
          position: 'middle',
          icon: 'alert-circle-outline'
        });
        this.close();
      }
    });
  }

  async onSubmit() {
    if (this.profileForm.invalid || this.isSubmitting) return;

    this.isSubmitting = true;

    const loading = await this.utilsSvc.loading({
      spinner: 'crescent',
      cssClass: 'custom-loading',
    });
    await loading.present();

    this.authService.updateUserProfile(this.profileForm.value).subscribe({
      next: async (updatedUser) => {
        await loading.dismiss();
        this.isSubmitting = false;

        await this.utilsSvc.presentToast({
          message: this.translateService.instant('Perfil actualizado exitosamente'),
          duration: 3000,
          color: 'success',
          position: 'middle',
          icon: 'checkmark-circle-outline'
        });

        this.modalCtrl.dismiss({ updated: true });
      },
      error: async (error) => {
        await loading.dismiss();
        this.isSubmitting = false;

        let errorMessage = this.translateService.instant('Error al actualizar perfil');
        
        if (error.status === 400) {
          if (error.error?.username) {
            errorMessage = error.error.username[0];
          } else if (error.error?.recovery_email) {
            errorMessage = error.error.recovery_email[0];
          }
        } else if (error.status === 401) {
          errorMessage = this.translateService.instant('No autorizado');
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

  close() {
    this.modalCtrl.dismiss();
  }
}