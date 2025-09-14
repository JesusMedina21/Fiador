import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormBuilder, FormControl, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from 'src/app/services/auth.service';
import { UtilsService } from 'src/app/services/utils.service';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { IonicModule } from '@ionic/angular';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-confirm-email',
  templateUrl: './confirm-email.component.html',
  styleUrls: ['./confirm-email.component.scss'],
  imports: [IonicModule, TranslateModule, ReactiveFormsModule, CommonModule, FormsModule]
})
export class confirmEmailComponent implements OnInit {

  form!: FormGroup;
  uid!: string;
  token!: string;
  isSubmitting = false;
  loading: HTMLIonLoadingElement | null = null;

  constructor(
    private route: ActivatedRoute,
    private fb: FormBuilder,
    private authSvc: AuthService,
    private utilsSvc: UtilsService,
    private translate: TranslateService,
    private router: Router
  ) { }

  ngOnInit() {
    // 🔽 obtener uid y token de la URL
    this.uid = this.route.snapshot.paramMap.get('uid') || '';
    this.token = this.route.snapshot.paramMap.get('token') || '';

    // 🔽 inicializar formulario con validaciones
    this.form = this.fb.group({
      new_email: new FormControl('', [
        Validators.required, 
        Validators.email,
        Validators.pattern(/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/)
      ])
    });
  }

  async onSubmit() {
    if (this.form.invalid || this.isSubmitting) return;

    this.isSubmitting = true;
    
    // Mostrar loading
    this.loading = await this.utilsSvc.loading({
      spinner: 'crescent',
      cssClass: 'custom-loading',
      message: this.translate.instant('Procesando...')
    });
    
    await this.loading.present();

    const payload = {
      uid: this.uid,
      token: this.token,
      new_email: this.form.value.new_email
    };

    this.authSvc.confirmEmail(payload).subscribe({
      next: async () => {
        this.isSubmitting = false;
        if (this.loading) {
          await this.loading.dismiss();
        }
        
        await this.utilsSvc.presentToast({
          message: this.translate.instant('Enlace nuevo correo'),
          color: 'success',
          duration: 3000,
          position: 'middle',
          icon: 'checkmark-circle-outline'
        });
        this.router.navigateByUrl('/login');
      },
      error: async (err) => {
        this.isSubmitting = false;
        if (this.loading) {
          await this.loading.dismiss();
        }
        
        let errorMessage = this.translate.instant('Error enlace nuevo correo');
        
        // Manejo específico de errores
        if (err.status === 400) {
          if (err.error?.new_email) {
            errorMessage = err.error.new_email[0] || errorMessage;
          } else if (err.error?.detail) {
            errorMessage = err.error.detail;
          } else if (err.error?.token) {
            errorMessage = this.translate.instant('Token inválido o expirado');
          }
        }
        
        await this.utilsSvc.presentToast({
          message: errorMessage,
          color: 'danger',
          duration: 3000,
          position: 'middle',
          icon: 'alert-circle-outline'
        });
      }
    });
  }

  // Método para mostrar errores de validación
  getEmailErrors(): string {
    const emailControl = this.form.get('new_email');
    if (emailControl?.errors && emailControl.touched) {
      if (emailControl.errors['required']) {
        return this.translate.instant('Correo obligatorio');
      }
      if (emailControl.errors['email'] || emailControl.errors['pattern']) {
        return this.translate.instant('Correo inválido');
      }
    }
    return '';
  }
}