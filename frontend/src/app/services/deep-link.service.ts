// deep-link.service.ts
import { Injectable } from '@angular/core';
import { App, AppLaunchUrl } from '@capacitor/app';
import { Router } from '@angular/router';

@Injectable({
  providedIn: 'root'
})
export class DeepLinkService {
  
  constructor(private router: Router) {}

  initialize() {
    App.addListener('appUrlOpen', (data: AppLaunchUrl) => {
      const url = data.url;
      console.log('Deep link opened:', url);
      
      // Manejar deep link de Google callback
      if (url.includes('fiador://google-callback')) {
        this.handleGoogleCallback(url);
      }
      
      // También manejar URLs HTTPS por si acaso
      if (url.includes('https://fiador.vercel.app/google/callback')) {
        this.handleGoogleCallback(url);
      }
    });
  }

  private handleGoogleCallback(url: string) {
    try {
      const urlObj = new URL(url);
      const accessToken = urlObj.searchParams.get('access');
      const refreshToken = urlObj.searchParams.get('refresh');
      
      if (accessToken) {
        localStorage.setItem('token', accessToken);
        if (refreshToken) {
          //localStorage.setItem('refresh', refreshToken);
        }
        
        // Redirigir al home
        this.router.navigate(['/']);
        
        // Cerrar el browser si está abierto
        this.closeBrowser();
      }
    } catch (error) {
      console.error('Error handling Google callback:', error);
    }
  }

  private async closeBrowser() {
    try {
      const { Browser } = await import('@capacitor/browser');
      await Browser.close();
    } catch (error) {
      console.log('Browser already closed or not available');
    }
  }
}