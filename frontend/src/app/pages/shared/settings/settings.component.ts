import { Component, ElementRef, Input, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { TraductorService } from 'src/app/services/traductor.service';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { IonicModule, PopoverController } from '@ionic/angular';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { ThemeService } from 'src/app/services/theme.service';

@Component({
  selector: 'app-settings',
  templateUrl: './settings.component.html',
  styleUrls: ['./settings.component.scss'],
  imports: [IonicModule, TranslateModule, CommonModule, FormsModule],
})
export class SettingsComponent implements OnInit, OnDestroy {

  @ViewChild('miBoton') miBotonRef!: ElementRef<HTMLButtonElement>;


  langs: string[] = [];
  currentLang: string = '';

  constructor(
    private traductorService: TraductorService, 
    private translateService: TranslateService, 
    public themeService: ThemeService,
    private popoverCtrl: PopoverController
  ) {
    this.langs = this.traductorService.getLangs();
    this.currentLang = this.traductorService.getCurrentLanguage();
  }


  async toggleTheme() {
    this.themeService.toggleTheme();
    await this.popoverCtrl.dismiss(); // Cierra el popover después de cambiar el tema
  }


  async cambiarIdioma(event: CustomEvent) {
    this.traductorService.setLanguage(event.detail.value);
    this.currentLang = event.detail.value;
    await this.popoverCtrl.dismiss(); // Cierra el popover después de cambiar el idioma
  }

  ngOnInit() { }

  ngOnDestroy(): void {
    if (this.miBotonRef && this.miBotonRef.nativeElement === document.activeElement) {
      document.body.focus(); // O enfocar otro elemento apropiado
    }
  }
}
