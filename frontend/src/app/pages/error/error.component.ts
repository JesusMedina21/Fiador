import { Component, OnInit } from '@angular/core';
import { IonicModule, NavController } from '@ionic/angular';

@Component({
  selector: 'app-error',
  templateUrl: './error.component.html',
  styleUrls: ['./error.component.scss'],
  imports: [IonicModule]
})
export class ErrorComponent  implements OnInit {

  constructor(
      private navCtrl: NavController,) { }

  ngOnInit() {}

  goBack() {
    this.navCtrl.back(); // Va a la página anterior
  }

}
