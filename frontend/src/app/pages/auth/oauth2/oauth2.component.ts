import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Browser } from '@capacitor/browser';
import { Capacitor } from '@capacitor/core';

@Component({
  selector: 'app-oauth2',
  templateUrl: './oauth2.component.html',
  styleUrls: ['./oauth2.component.scss'],
})
export class Oauth2Component implements OnInit {
  
  constructor(private route: ActivatedRoute, private router: Router) {}

  async ngOnInit(): Promise<void> {
    this.route.queryParams.subscribe(async params => {
      const access = params['access'];
      const refresh = params['refresh'];

      if (access) {
        localStorage.setItem('token', access);
        if (refresh) {
          //localStorage.setItem('refresh', refresh);
        }
        
        // ✅ Cerrar el browser automáticamente en móvil
        if (Capacitor.getPlatform() !== 'web') {
          try {
            await Browser.close();
          } catch (error) {
            //console.log('Browser already closed');
          }
        }
        
        // Redirige a la página principal
        this.router.navigate(['/']);
      } else {
        //console.error('No se recibieron tokens desde Google');
        this.router.navigate(['/']);
      }
    });
  }
}