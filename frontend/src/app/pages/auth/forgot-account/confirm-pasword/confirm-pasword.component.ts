import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { AbstractControl, FormBuilder, FormControl, FormGroup, FormsModule, ReactiveFormsModule, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { IonicModule } from '@ionic/angular';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { AuthService } from 'src/app/services/auth.service';
import { UtilsService } from 'src/app/services/utils.service';

@Component({
  selector: 'app-confirm-pasword',
  templateUrl: './confirm-pasword.component.html',
  styleUrls: ['./confirm-pasword.component.scss'],
  imports: [IonicModule, TranslateModule, ReactiveFormsModule, CommonModule, FormsModule]
})
export class ConfirmPaswordComponent implements OnInit {

  form!: FormGroup;
  uid!: string;
  token!: string;
  isSubmitting = false;

  constructor(
    private route: ActivatedRoute,
    private fb: FormBuilder,
    private authService: AuthService,
    private utilsSvc: UtilsService,
    private router: Router,
    private translateService: TranslateService
  ) {}

  ngOnInit() {
    // uid y token desde la URL
    this.uid = this.route.snapshot.paramMap.get('uid')!;
    this.token = this.route.snapshot.paramMap.get('token')!;

    this.form = this.fb.group({
      new_password: new FormControl('', [Validators.required, Validators.minLength(8)]),
      confirm_password: new FormControl('', [Validators.required, Validators.minLength(8)])
    }, {
      validators: this.passwordsMatch()
    });
  }

  private passwordsMatch(): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      const pass = control.get('new_password')?.value;
      const confirm = control.get('confirm_password')?.value;
      return pass === confirm ? null : { passwordsMismatch: true };
    };
  }

  async confirmarPassword() {
    if (this.form.invalid || this.isSubmitting) return;
    this.isSubmitting = true;

    const loading = await this.utilsSvc.loading({
      spinner: 'crescent',
      cssClass: 'custom-loading'
    });
    await loading.present();

    const payload = {
      uid: this.uid,
      token: this.token,
      new_password: this.form.value.new_password
    };

    this.authService.confirmResetPassword(payload).subscribe({
      next: async () => {
        await loading.dismiss();
        this.isSubmitting = false;

        await this.utilsSvc.presentToast({
          message: this.translateService.instant('Contraseña actualizada'),
          duration: 3000,
          color: 'success',
          position: 'middle',
          icon: 'checkmark-circle-outline'
        });

        this.router.navigate(['/login']);
      },
      error: async () => {
        await loading.dismiss();
        this.isSubmitting = false;

        await this.utilsSvc.presentToast({
          message: this.translateService.instant('Error contraseña actualizada'),
          duration: 3000,
          color: 'danger',
          position: 'middle',
          icon: 'alert-circle-outline'
        });
      }
    });
  }
}
