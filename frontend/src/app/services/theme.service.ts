import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class ThemeService {
  private currentTheme = new BehaviorSubject<string>(this.getInitialTheme());
  themeChanged$ = this.currentTheme.asObservable();

  constructor() {
    // Escuchar cambios en localStorage desde otras pestañas
    window.addEventListener('storage', (event) => {
      if (event.key === 'theme') {
        this.setTheme(event.newValue || 'light');
      }
    });
  }

  private getInitialTheme(): string {
    const savedTheme = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    return savedTheme || (prefersDark ? 'dark' : 'light');
  }

  setTheme(theme: string) {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    localStorage.setItem('theme', theme);
    this.currentTheme.next(theme);
  }

  toggleTheme() {
    const newTheme = this.currentTheme.value === 'dark' ? 'light' : 'dark';
    this.setTheme(newTheme);
  }

  getCurrentTheme() {
    return this.currentTheme.value;
  }
}