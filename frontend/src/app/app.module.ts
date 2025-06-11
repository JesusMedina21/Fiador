import { NgModule, isDevMode } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { RouteReuseStrategy } from '@angular/router';

import { IonicModule, IonicRouteStrategy } from '@ionic/angular';

import { AppComponent } from './app.component';
import { AppRoutingModule } from './app-routing.module';

///////////////Librerias para traducir

import { HttpClientModule, HttpClient } from '@angular/common/http';
import { TranslateModule, TranslateLoader} from '@ngx-translate/core';
import { TranslateHttpLoader } from '@ngx-translate/http-loader';


import { FooterComponent } from './pages/shared/footer/footer.component';
import { ServiceWorkerModule } from '@angular/service-worker';

import { HTTP_INTERCEPTORS } from '@angular/common/http';
import { AppInterceptor } from './app.interceptor';

//Codigo para que funcione correctamente la traducion
export function HttpLoaderFactory(httpClient: HttpClient) {
  return new TranslateHttpLoader(httpClient, "../assets/traductor/", ".json");
}

@NgModule({
  declarations: [AppComponent],
  imports: [
    BrowserModule, 
    IonicModule.forRoot({ mode: 'md'}), 
    AppRoutingModule, 
    FooterComponent,
    //////////////////Librerias para traducir
    HttpClientModule,
    TranslateModule.forRoot({
      loader: {
        provide: TranslateLoader,
        useFactory: HttpLoaderFactory,
        deps: [HttpClient]
      }
    }),
    ServiceWorkerModule.register('ngsw-worker.js', {
      enabled: !isDevMode(),
      //El registrationStrategy lo que hace es que activa el ServiceWorker despues
      //de los 5 segundos y si la aplicacion esta estable, activa el ServiceWorker antes
     // registrationStrategy: 'registerWhenStable:5000'
    })
  ],
  providers: [
    { provide: RouteReuseStrategy, useClass: IonicRouteStrategy },
    //El interceptor AppInterceptor es creado manualmente por mi para que solamente
    //La api sea consumida por el Frontend y no por ninguna herramienta parecida a Postman
    { provide: HTTP_INTERCEPTORS, useClass: AppInterceptor, multi: true }
  ],
  bootstrap: [AppComponent],
})
export class AppModule {}