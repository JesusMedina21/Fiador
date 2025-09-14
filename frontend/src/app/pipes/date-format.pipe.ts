import { Pipe, PipeTransform, inject } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
@Pipe({
  name: 'dateFormat',
  standalone: true
})
export class DateFormatPipe implements PipeTransform {
  private translate = inject(TranslateService);
  transform(value: string | Date): string {
    if (!value) return '';
    const date = new Date(value);
    const lang = this.translate.currentLang;
    // Configuración para español
    if (lang === 'Español') {
      const datePart = date.toLocaleDateString('es-ES', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });
      const timePart = date.toLocaleTimeString('es-ES', {
        hour: 'numeric',
        hour12: true
      }).replace(' a. m.', 'am').replace(' p. m.', 'pm');
      // Obtener la traducción para "a las"
      const timeLabel = this.translate.instant('Hora'); // Clave de traducción
      return `${datePart} ${timeLabel} ${timePart}`;
    }
    // Configuración para inglés
    else if (lang === 'English') {
      const datePart = date.toLocaleDateString('en-US', {
        month: '2-digit',
        day: '2-digit',
        year: 'numeric'
      });
      const timePart = date.toLocaleTimeString('en-US', {
        hour: 'numeric',
        hour12: true
      }).toLowerCase();
      // Obtener la traducción para "at"
      const timeLabel = this.translate.instant('Hora'); // Clave de traducción
      return `${datePart} ${timeLabel} ${timePart}`;
    }
    // Retorno por defecto si el idioma no es reconocido
    return value.toString();
  }
}