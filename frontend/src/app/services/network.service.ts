import { Injectable } from '@angular/core';
import { Network } from '@capacitor/network';
import { TranslateService } from '@ngx-translate/core';
import { UtilsService } from './utils.service';

import { BehaviorSubject } from 'rxjs';
@Injectable({
  providedIn: 'root'
})
export class NetworkService {

  private onlineStatus = new BehaviorSubject<boolean>(true);
  onlineStatus$ = this.onlineStatus.asObservable();

  constructor(
    private utilsSvc: UtilsService,
    private translate: TranslateService
  ) {
    this.initNetworkListener();
  }

  private async initNetworkListener() {
    const status = await Network.getStatus();
    this.onlineStatus.next(status.connected);

    Network.addListener('networkStatusChange', (status) => {
      this.onlineStatus.next(status.connected);
    });
  }

  async checkConnection(): Promise<boolean> {
    const status = await Network.getStatus();
    if (!status.connected) {
      this.utilsSvc.presentToast({
        message: this.translate.instant('ERROR_CONEXION_INTERNET'),
        duration: 3000,
        color: 'danger',
        position: 'middle',
        icon: 'cloud-offline-outline'
      });
    }
    this.onlineStatus.next(status.connected);
    return status.connected;
  }
}