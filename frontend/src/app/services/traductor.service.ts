import { Injectable } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';

@Injectable({
  providedIn: 'root'
})
export class TraductorService {

  constructor(private translateService: TranslateService) {
    const storedLang = localStorage.getItem('idioma');
    this.setLanguage(storedLang || 'Español'); // Establecer idioma por defecto
  }
  setLanguage(lang: string) {
    this.translateService.use(lang);
    localStorage.setItem('idioma', lang); // Almacena el idioma en localStorage
   // Emitir un evento de cambio de idioma
   window.dispatchEvent(new Event('languageChanged'));
  }
  getCurrentLanguage(): string {
    return localStorage.getItem('idioma') || 'Español';
  }
  getLangs(): string[] {
    return this.translateService.getLangs(); // Devuelve los idiomas disponibles
  }
}
