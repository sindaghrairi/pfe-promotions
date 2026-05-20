import { HttpClient } from '@angular/common/http';
import { Injectable, PLATFORM_ID, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { firstValueFrom } from 'rxjs';

export type AppLanguage = 'fr' | 'en';

type TranslationDictionary = Record<string, unknown>;

@Injectable({ providedIn: 'root' })
export class TranslationService {
  private readonly http = inject(HttpClient);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);
  private readonly storageKey = 'promolink_language';
  private readonly fallbackLanguage: AppLanguage = 'fr';
  private readonly dictionaries = new Map<AppLanguage, TranslationDictionary>();

  readonly currentLanguage = signal<AppLanguage>(this.readStoredLanguage());
  readonly ready = signal(false);

  async init(): Promise<void> {
    await this.use(this.currentLanguage());
  }

  async use(language: AppLanguage): Promise<void> {
    const safeLanguage = this.normalizeLanguage(language);
    await this.loadLanguage(safeLanguage);
    this.currentLanguage.set(safeLanguage);
    this.ready.set(true);

    if (this.isBrowser) {
      localStorage.setItem(this.storageKey, safeLanguage);
      document.documentElement.lang = safeLanguage;
    }
  }

  translate(key: string, params?: Record<string, string | number>): string {
    this.currentLanguage();
    this.ready();

    const value = this.resolveKey(this.currentDictionary(), key)
      ?? this.resolveKey(this.dictionaries.get(this.fallbackLanguage) ?? {}, key)
      ?? key;

    if (typeof value !== 'string') {
      return key;
    }

    if (!params) {
      return value;
    }

    return Object.entries(params).reduce(
      (text, [paramKey, paramValue]) => text.replaceAll(`{{${paramKey}}}`, String(paramValue)),
      value
    );
  }

  private async loadLanguage(language: AppLanguage): Promise<void> {
    if (this.dictionaries.has(language)) {
      return;
    }

    const dictionary = await firstValueFrom(
      this.http.get<TranslationDictionary>(`/i18n/${language}.json`)
    );
    this.dictionaries.set(language, dictionary);

    if (language !== this.fallbackLanguage && !this.dictionaries.has(this.fallbackLanguage)) {
      const fallback = await firstValueFrom(
        this.http.get<TranslationDictionary>(`/i18n/${this.fallbackLanguage}.json`)
      );
      this.dictionaries.set(this.fallbackLanguage, fallback);
    }
  }

  private currentDictionary(): TranslationDictionary {
    return this.dictionaries.get(this.currentLanguage()) ?? {};
  }

  private resolveKey(dictionary: TranslationDictionary, key: string): unknown {
    return key.split('.').reduce<unknown>((source, segment) => {
      if (!source || typeof source !== 'object') {
        return undefined;
      }

      return (source as Record<string, unknown>)[segment];
    }, dictionary);
  }

  private readStoredLanguage(): AppLanguage {
    if (!this.isBrowser) {
      return this.fallbackLanguage;
    }

    return this.normalizeLanguage(localStorage.getItem(this.storageKey));
  }

  private normalizeLanguage(language: string | null): AppLanguage {
    return language === 'en' ? 'en' : 'fr';
  }
}
