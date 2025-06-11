import { Component, OnInit } from '@angular/core';
import { SplashScreen } from '@capacitor/splash-screen';
import { TranslateService } from '@ngx-translate/core';
import { TraductorService } from 'src/app/services/traductor.service';
import { ThemeService } from 'src/app/services/theme.service';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss'],
  standalone: false,
})
export class AppComponent implements OnInit {

  currentLang: string
  constructor(
    private themeService: ThemeService,
    //Este servicio es creado por mi
    //traduccion de idiomas
    private translateService: TranslateService,
    //Este servicio es creado por mi
    private traductorService: TraductorService
  ) {
    //codigo para el cambio de temas
    this.themeService.setTheme(this.themeService.getCurrentTheme());
    //Este codigo es para la traduccion de idiomas
    this.translateService.setDefaultLang('Español');
    this.translateService.addLangs(['Español', 'English']);
    //Este codigo lo que hace es que si se cambia el idioma en la pagina accounts
    //el cambio se aplique en el servicio, e integran el servicio en la raiz del proyecto
    //y al implementar ese cambio en la raiz del proyecto, todo el proyecto tiene la misma configuracion
    //por lo tanto todas las paginas del proyecto actualizan su idioma
    this.currentLang = this.traductorService.getCurrentLanguage(); // Establece el idioma actual
 
    //Este es codigo es para generar el splash Screen
    this.showSplash();
  }
  
  ngOnInit() {
    // Escuchar el evento de cambio de idioma
    window.addEventListener('languageChanged', () => {
      this.currentLang = this.traductorService.getCurrentLanguage();
      this.translateService.use(this.currentLang);
    });
    // Escuchar el evento de almacenamiento
    //En resumen, este codigo inicializa los cambios en la raiz de mi proyecto
    //con la finalidad de que si actualizo el idioma en una pestaña
    //el resto de pestañas abiertas tambien actualizen el idioma
    window.addEventListener('storage', (event) => {
      if (event.key === 'idioma') {
        this.currentLang = event.newValue || 'Español';
        this.translateService.use(this.currentLang);
      }
    });
  }

  //Este codigo del plugin capacitor lo saco de la documentacion de capacitor splash screen 
  // el cual el enlace es el siguiente https://capacitorjs.com/docs/apis/splash-screen
  //ojo solo me proporcionan hasta autohide, el async lo escribo yo
  async showSplash() {
    await SplashScreen.show({
      autoHide: true,
      showDuration: 3000,
    });
  }
}
