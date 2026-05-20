import { DOCUMENT } from '@angular/common';
import { Inject, Injectable } from '@angular/core';
import { BehaviorSubject, map } from 'rxjs';

type ThemeMode = 'light' | 'dark';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly storageKey = 'ui_theme';
  private readonly themeSubject = new BehaviorSubject<ThemeMode>('light');
  private readonly prefersDarkQuery = '(prefers-color-scheme: dark)';
  private useSystemPreference = true;

  readonly theme$ = this.themeSubject.asObservable();
  readonly isDark$ = this.theme$.pipe(map((theme) => theme === 'dark'));

  constructor(@Inject(DOCUMENT) private readonly documentRef: Document) {
    this.initTheme();
  }

  toggleTheme(): void {
    const next = this.themeSubject.value === 'dark' ? 'light' : 'dark';
    this.useSystemPreference = false;
    this.applyTheme(next, true);
  }

  private initTheme(): void {
    if (!this.isBrowser()) {
      return;
    }

    const stored = localStorage.getItem(this.storageKey) as ThemeMode | null;
    this.useSystemPreference = !stored;

    const prefersDark = window.matchMedia?.(this.prefersDarkQuery).matches ?? false;
    const initial = stored ?? (prefersDark ? 'dark' : 'light');
    this.applyTheme(initial, false);

    if (this.useSystemPreference && window.matchMedia) {
      const media = window.matchMedia(this.prefersDarkQuery);
      media.addEventListener('change', (event) => {
        if (!this.useSystemPreference) {
          return;
        }
        this.applyTheme(event.matches ? 'dark' : 'light', true);
      });
    }
  }

  private applyTheme(theme: ThemeMode, animate: boolean): void {
    this.themeSubject.next(theme);

    if (!this.isBrowser()) {
      return;
    }

    if (animate) {
      this.enableTransition();
    }

    const root = this.documentRef.documentElement;
    root.classList.toggle('dark', theme === 'dark');

    if (!this.useSystemPreference) {
      localStorage.setItem(this.storageKey, theme);
    }
  }

  private enableTransition(): void {
    const root = this.documentRef.documentElement;
    root.classList.add('theme-transition');
    window.setTimeout(() => root.classList.remove('theme-transition'), 220);
  }

  private isBrowser(): boolean {
    return typeof window !== 'undefined' && typeof document !== 'undefined';
  }
}
