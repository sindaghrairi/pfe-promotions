import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { AppLanguage, TranslationService } from '../../core/i18n/translation.service';

@Component({
  selector: 'app-language-switcher',
  standalone: true,
  imports: [CommonModule, TranslatePipe],
  templateUrl: './language-switcher.component.html',
  styleUrl: './language-switcher.component.css'
})
export class LanguageSwitcherComponent {
  private readonly translations = inject(TranslationService);

  readonly languages: Array<{ code: AppLanguage; labelKey: string; shortLabel: string }> = [
    { code: 'fr', labelKey: 'LANGUAGE.FRENCH', shortLabel: 'FR' },
    { code: 'en', labelKey: 'LANGUAGE.ENGLISH', shortLabel: 'EN' }
  ];

  get currentLanguage(): AppLanguage {
    return this.translations.currentLanguage();
  }

  setLanguage(language: AppLanguage): void {
    void this.translations.use(language);
  }
}
