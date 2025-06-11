import { Component, OnInit } from '@angular/core';
import { IonicModule } from '@ionic/angular';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'app-footer',
  templateUrl: './footer.component.html',
  styleUrls: ['./footer.component.scss'],
  imports: [
    TranslateModule, 
    IonicModule
  ]
})
export class FooterComponent implements OnInit {

  constructor() { }

  ngOnInit() { }

  reiniciar(event: any) {
    window.location.reload();
    // No necesitas event.target.complete() aquí porque la página se recarga completamente
  }
}
