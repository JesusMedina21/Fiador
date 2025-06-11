import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AlertController, AlertOptions, LoadingController, ModalController, ModalOptions, ToastController, ToastOptions } from '@ionic/angular';

@Injectable({
  providedIn: 'root'
})
export class UtilsService {

  loadingCtrl = inject(LoadingController);
  toastCtrl = inject(ToastController);
  modalCtrl = inject(ModalController); // sirve para los modales como los componentes
  router = inject(Router);
  alertCtrl = inject(AlertController);
  
  constructor(private loadingController: LoadingController) {}

  // Alerta o aviso de eliminar para que no borre de coñazo 
  async presentAlert(opts?: AlertOptions) {
    const alert = await this.alertCtrl.create(opts);
    await alert.present();
  }

  // Cargando
  async loading(options: any) {
    const loading = await this.loadingController.create({
     // message: options.message || 'Cargando...',
      spinner: options.spinner || 'crescent', // Cambia esto si deseas un spinner diferente
      cssClass: options.cssClass || '',
      backdropDismiss: true // Permitir que se cierre al tocar el fondo
    });
    return loading;
  }


  async presentToast(opts?: ToastOptions) {
    const toast = await this.toastCtrl.create({
      message: opts?.message || 'Mensaje por defecto',
      duration: opts?.duration || 2000,
      color: opts?.color || 'dark',
      position: opts?.position || 'bottom',
      buttons: opts?.buttons || []
    });
    await toast.present();
  }

  // Modal para componentes
  async presentModal(opts: ModalOptions) {
    const modal = await this.modalCtrl.create(opts);
    await modal.present();
    const { data } = await modal.onWillDismiss();
    if (data) return data;
  }


  //funcion para cerrar modal
  dismissModal(data?: any) {
    return this.modalCtrl.dismiss(data);
  }
}
