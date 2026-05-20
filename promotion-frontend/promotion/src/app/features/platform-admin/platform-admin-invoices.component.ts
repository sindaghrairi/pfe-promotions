import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, inject } from '@angular/core';
import { RouterLink } from '@angular/router';

import { PlatformAdminInvoiceResponse } from '../../core/models/platform-admin.model';
import { PlatformAdminService } from '../../core/services/platform-admin.service';
import { ThemeService } from '../../core/services/theme.service';
import { TranslationService } from '../../core/i18n/translation.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { LanguageSwitcherComponent } from '../../shared/language-switcher/language-switcher.component';

@Component({
  selector: 'app-platform-admin-invoices',
  standalone: true,
  imports: [CommonModule, RouterLink, TranslatePipe, LanguageSwitcherComponent],
  templateUrl: './platform-admin-invoices.component.html',
  styleUrl: './platform-admin-invoices.component.css'
})
export class PlatformAdminInvoicesComponent implements OnInit {
  private readonly platformAdminService = inject(PlatformAdminService);
  private readonly themeService = inject(ThemeService);
  private readonly translations = inject(TranslationService);

  readonly isDark$ = this.themeService.isDark$;

  loading = true;
  errorMessage = '';
  invoices: PlatformAdminInvoiceResponse | null = null;

  get paymentRate(): number {
    const total = this.invoices?.items.length ?? 0;
    if (!total) {
      return 0;
    }

    return Math.round((this.countByStatus('PAID') / total) * 100);
  }

  get invoicesTitle(): string {
    const message = this.invoices?.message?.trim();
    if (!message) {
      return this.translations.translate('PLATFORM_INVOICES.LOADED_SUCCESS');
    }

    const normalized = message.toLowerCase();
    if (
      normalized === 'factures chargees avec succes'
      || normalized === 'factures chargées avec succès'
      || normalized === 'invoices loaded successfully'
    ) {
      return this.translations.translate('PLATFORM_INVOICES.LOADED_SUCCESS');
    }

    return message;
  }

  ngOnInit(): void {
    this.platformAdminService.listInvoices().subscribe({
      next: (response) => {
        this.loading = false;
        this.invoices = response;
      },
      error: (error: HttpErrorResponse) => {
        this.loading = false;
        this.errorMessage = this.extractError(error);
      }
    });
  }

  toggleTheme(): void {
    this.themeService.toggleTheme();
  }

  countByStatus(status: 'PAID' | 'PENDING' | 'OVERDUE'): number {
    return this.invoices?.items.filter((item) => item.status === status).length ?? 0;
  }

  statusLabel(status: string): string {
    const keyByStatus: Record<string, string> = {
      PAID: 'PLATFORM_INVOICES.STATUS_PAID',
      PENDING: 'PLATFORM_INVOICES.STATUS_PENDING',
      OVERDUE: 'PLATFORM_INVOICES.STATUS_OVERDUE'
    };

    return this.translations.translate(keyByStatus[status] ?? status);
  }

  private extractError(error: HttpErrorResponse): string {
    if (typeof error.error?.error === 'string') {
      return error.error.error;
    }
    return 'Impossible de charger les factures.';
  }
}
