import { Component, OnInit } from '@angular/core';
import { SplashScreen } from '@capacitor/splash-screen';
import { TranslateService } from '@ngx-translate/core';
import { TraductorService } from 'src/app/services/traductor.service';
import { ThemeService } from 'src/app/services/theme.service';
import { DeepLinkService } from './services/deep-link.service';
import { Router } from '@angular/router';
import { App } from '@capacitor/app';

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
    private traductorService: TraductorService,
    private deepLinkService: DeepLinkService,
    private router: Router
  ) {
    this.listenDeepLinks();
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
    this.initializeDeepLinks();
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

  // ✅ Método para inicializar Deep Links
  private initializeDeepLinks() {
    // Solo inicializar en dispositivos móviles, no en web
    if (this.isMobileDevice()) {
      this.deepLinkService.initialize();
      //console.log('Deep Link Service inicializado');
    }
  }

  // ✅ Método para detectar si es dispositivo móvil
  private isMobileDevice(): boolean {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  }

  listenDeepLinks() {
    App.addListener('appUrlOpen', (event) => {
      const url = event.url;

      // Confirmar Email registrado por primera vez
      if (url.includes('/activate/')) {
        const parts = url.split('/');
        const uid = parts[parts.length - 2];
        const token = parts[parts.length - 1];
        this.router.navigate([`/activate/${uid}/${token}`]);
      }

      // Confirmar Nuevo Email cuando se hace la solicitud de cambio de email
      if (url.includes('/activate/new-email/')) {
        const parts = url.split('/');
        const uid = parts[parts.length - 2];
        const token = parts[parts.length - 1];
        this.router.navigate([`/activate/new-email/${uid}/${token}`]);
      }
      
      // Inidicar nueva contraseña
      if (url.includes('/password/confirm/')) {
        const parts = url.split('/');
        const uid = parts[parts.length - 2];
        const token = parts[parts.length - 1];
        this.router.navigate([`/password/confirm/${uid}/${token}`]);
      }

      // Inidicar nuevo Email
      if (url.includes('/email/confirm/')) {
        const parts = url.split('/');
        const uid = parts[parts.length - 2];
        const token = parts[parts.length - 1];
        this.router.navigate([`/email/confirm/${uid}/${token}`]);
      }

      // 🔹 Google OAuth
      if (url.includes('/google/callback')) {
        this.router.navigate(['/google/callback'], {
          queryParams: {
            access: this.getParam(url, 'access'),
            //refresh: this.getParam(url, 'refresh'),
          },
        });
      }
    });
  }

  private getParam(url: string, key: string): string | null {
    const regex = new RegExp('[?&]' + key + '=([^&#]*)', 'i');
    const match = regex.exec(url);
    return match ? decodeURIComponent(match[1]) : null;
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
