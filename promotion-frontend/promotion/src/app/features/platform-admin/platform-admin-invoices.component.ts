import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { PlatformAdminInvoice, PlatformAdminInvoiceResponse } from '../../core/models/platform-admin.model';
import { PlatformAdminService } from '../../core/services/platform-admin.service';
import { ThemeService } from '../../core/services/theme.service';
import { TranslationService } from '../../core/i18n/translation.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { LanguageSwitcherComponent } from '../../shared/language-switcher/language-switcher.component';

@Component({
  selector: 'app-platform-admin-invoices',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, TranslatePipe, LanguageSwitcherComponent],
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
  successMessage = '';
  savingInvoiceId: number | null = null;
  invoices: PlatformAdminInvoiceResponse | null = null;
  searchTerm = '';
  statusFilter: PlatformAdminInvoice['status'] | 'ALL' = 'ALL';
  pageSize = 6;
  currentPage = 1;

  readonly statusFilters: Array<PlatformAdminInvoice['status'] | 'ALL'> = [
    'ALL',
    'PAID',
    'PENDING',
    'OVERDUE'
  ];

  get filteredInvoices(): PlatformAdminInvoice[] {
    const term = this.searchTerm.trim().toLowerCase();
    const items = this.invoices?.items ?? [];

    const filtered = items.filter((invoice) => {
      const statusMatch = this.statusFilter === 'ALL' || invoice.status === this.statusFilter;
      if (!statusMatch) {
        return false;
      }

      if (!term) {
        return true;
      }

      return `${invoice.id} ${invoice.companyName} ${invoice.companyEmail} ${invoice.plan}`
        .toLowerCase()
        .includes(term);
    });

    return filtered.sort((a, b) => this.parseDate(b.issuedAt) - this.parseDate(a.issuedAt));
  }

  get pagedInvoices(): PlatformAdminInvoice[] {
    const start = (this.currentPage - 1) * this.pageSize;
    return this.filteredInvoices.slice(start, start + this.pageSize);
  }

  get totalPages(): number {
    const total = this.filteredInvoices.length;
    return total ? Math.ceil(total / this.pageSize) : 1;
  }

  get paginationItems(): Array<number | string> {
    const pages = Array.from({ length: this.totalPages }, (_, index) => index + 1);
    if (pages.length <= 7) {
      return pages;
    }

    const items: Array<number | string> = [1];
    const left = Math.max(this.currentPage - 1, 2);
    const right = Math.min(this.currentPage + 1, this.totalPages - 1);

    if (left > 2) {
      items.push('...');
    }

    for (let page = left; page <= right; page += 1) {
      items.push(page);
    }

    if (right < this.totalPages - 1) {
      items.push('...');
    }

    items.push(this.totalPages);
    return items;
  }

  get startItem(): number {
    if (!this.filteredInvoices.length) {
      return 0;
    }
    return (this.currentPage - 1) * this.pageSize + 1;
  }

  get endItem(): number {
    return Math.min(this.currentPage * this.pageSize, this.filteredInvoices.length);
  }

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
        this.resetPage();
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

  onSearchTermChange(value: string): void {
    this.searchTerm = value;
    this.resetPage();
  }

  setStatusFilter(status: PlatformAdminInvoice['status'] | 'ALL'): void {
    this.statusFilter = status;
    this.resetPage();
  }

  goToPage(page: number): void {
    this.currentPage = Math.min(Math.max(page, 1), this.totalPages);
  }

  goToPageItem(item: number | string): void {
    if (typeof item === 'number') {
      this.goToPage(item);
    }
  }

  statusLabel(status: string): string {
    const keyByStatus: Record<string, string> = {
      PAID: 'INVOICES.PAID',
      PENDING: 'INVOICES.PENDING',
      OVERDUE: 'INVOICES.OVERDUE'
    };

    return this.translations.translate(keyByStatus[status] ?? status);
  }

  markAsPaid(invoice: PlatformAdminInvoice): void {
    if (invoice.status !== 'PENDING' && invoice.status !== 'OVERDUE') {
      return;
    }

    const confirmed = typeof window !== 'undefined'
      ? window.confirm(this.translations.translate('INVOICES.CONFIRM_PAYMENT'))
      : true;

    if (!confirmed) {
      return;
    }

    this.savingInvoiceId = invoice.id;
    this.errorMessage = '';
    this.successMessage = '';

    this.platformAdminService.markInvoicePaid(invoice.id).subscribe({
      next: (updated) => {
        this.savingInvoiceId = null;
        this.replaceInvoice(updated);
        this.successMessage = this.translations.translate('INVOICES.PAID_SUCCESS');
      },
      error: (error: HttpErrorResponse) => {
        this.savingInvoiceId = null;
        this.errorMessage = this.extractError(error);
      }
    });
  }

  private extractError(error: HttpErrorResponse): string {
    if (typeof error.error?.error === 'string') {
      return error.error.error;
    }
    return this.translations.translate('PLATFORM_INVOICES.LOAD_ERROR');
  }

  private parseDate(value: string): number {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? 0 : parsed;
  }

  private resetPage(): void {
    this.currentPage = 1;
  }

  private replaceInvoice(updated: PlatformAdminInvoice): void {
    if (!this.invoices) {
      return;
    }

    this.invoices = {
      ...this.invoices,
      items: this.invoices.items.map((invoice) => invoice.id === updated.id ? updated : invoice)
    };
  }
}
