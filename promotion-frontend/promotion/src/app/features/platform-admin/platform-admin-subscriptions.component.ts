import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { PlatformAdminSubscription } from '../../core/models/platform-admin.model';
import { PlatformAdminService } from '../../core/services/platform-admin.service';
import { ThemeService } from '../../core/services/theme.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { TranslationService } from '../../core/i18n/translation.service';
import { LanguageSwitcherComponent } from '../../shared/language-switcher/language-switcher.component';

@Component({
  selector: 'app-platform-admin-subscriptions',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, TranslatePipe, LanguageSwitcherComponent],
  templateUrl: './platform-admin-subscriptions.component.html',
  styleUrl: './platform-admin-subscriptions.component.css'
})
export class PlatformAdminSubscriptionsComponent implements OnInit {
  private readonly platformAdminService = inject(PlatformAdminService);
  private readonly themeService = inject(ThemeService);
  private readonly translations = inject(TranslationService);

  readonly isDark$ = this.themeService.isDark$;

  loading = true;
  errorMessage = '';
  subscriptions: PlatformAdminSubscription[] = [];
  searchTerm = '';
  planFilter = 'ALL';
  activeFilter: 'ALL' | 'ACTIVE' | 'INACTIVE' = 'ALL';
  pageSize = 6;
  currentPage = 1;
  editingId: number | null = null;
  savingStatusId: number | null = null;

  get activeCount(): number {
    return this.subscriptions.filter((item) => item.active).length;
  }

  get inactiveCount(): number {
    return this.subscriptions.filter((item) => !item.active).length;
  }

  get planOptions(): string[] {
    const plans = this.subscriptions.map((item) => item.plan).filter(Boolean);
    return [...new Set(plans)].sort((a, b) => a.localeCompare(b));
  }

  get filteredSubscriptions(): PlatformAdminSubscription[] {
    const term = this.searchTerm.trim().toLowerCase();

    const filtered = this.subscriptions.filter((item) => {
      const planMatch = this.planFilter === 'ALL' || item.plan === this.planFilter;
      if (!planMatch) {
        return false;
      }

      const activeMatch = this.activeFilter === 'ALL'
        || (this.activeFilter === 'ACTIVE' && item.active)
        || (this.activeFilter === 'INACTIVE' && !item.active);

      if (!activeMatch) {
        return false;
      }

      if (!term) {
        return true;
      }

      return `${item.id} ${item.companyName} ${item.contactEmail}`.toLowerCase().includes(term);
    });

    return filtered.sort((a, b) => this.parseDate(b.createdAt) - this.parseDate(a.createdAt));
  }

  get pagedSubscriptions(): PlatformAdminSubscription[] {
    const start = (this.currentPage - 1) * this.pageSize;
    return this.filteredSubscriptions.slice(start, start + this.pageSize);
  }

  get totalPages(): number {
    const total = this.filteredSubscriptions.length;
    return total ? Math.ceil(total / this.pageSize) : 1;
  }

  get paginationItems(): Array<number | string> {
    if (this.totalPages <= 7) {
      return Array.from({ length: this.totalPages }, (_, index) => index + 1);
    }

    const items: Array<number | string> = [];
    const left = Math.max(this.currentPage - 1, 2);
    const right = Math.min(this.currentPage + 1, this.totalPages - 1);

    items.push(1);

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
    if (!this.filteredSubscriptions.length) {
      return 0;
    }
    return (this.currentPage - 1) * this.pageSize + 1;
  }

  get endItem(): number {
    return Math.min(this.currentPage * this.pageSize, this.filteredSubscriptions.length);
  }

  onSearchTermChange(value: string): void {
    this.searchTerm = value;
    this.resetPage();
  }

  setPlanFilter(plan: string): void {
    this.planFilter = plan;
    this.resetPage();
  }

  setActiveFilter(filter: 'ALL' | 'ACTIVE' | 'INACTIVE'): void {
    this.activeFilter = filter;
    this.resetPage();
  }

  goToPage(page: number): void {
    const nextPage = Math.min(Math.max(page, 1), this.totalPages);
    this.currentPage = nextPage;
  }

  goToPageItem(item: number | string): void {
    if (typeof item !== 'number') {
      return;
    }
    this.goToPage(item);
  }

  activateEdit(id: number, select: HTMLSelectElement): void {
    this.editingId = id;
    select.focus();
    select.click();
  }

  onStatusChange(item: PlatformAdminSubscription, active: boolean): void {
    if (item.active === active || this.savingStatusId === item.id) {
      return;
    }

    const previous = item.active;
    item.active = active;
    this.savingStatusId = item.id;
    this.errorMessage = '';

    this.platformAdminService.updateSubscriptionStatus(item.id, active).subscribe({
      next: (updated) => {
        this.savingStatusId = null;
        const index = this.subscriptions.findIndex((subscription) => subscription.id === updated.id);
        if (index >= 0) {
          this.subscriptions[index] = updated;
        }
      },
      error: (error: HttpErrorResponse) => {
        item.active = previous;
        this.savingStatusId = null;
        this.errorMessage = this.extractError(error);
      }
    });
  }

  subscriptionStatusLabel(item: PlatformAdminSubscription): string {
    switch (item.status) {
      case 'ACTIVE':
        return this.translations.translate('PLATFORM_SUBSCRIPTIONS.STATUS_ACTIVE');
      case 'OVERDUE':
        return this.translations.translate('PLATFORM_SUBSCRIPTIONS.STATUS_OVERDUE');
      case 'EXPIRED':
        return this.translations.translate('PLATFORM_SUBSCRIPTIONS.STATUS_EXPIRED');
      case 'CANCELED':
        return this.translations.translate('PLATFORM_SUBSCRIPTIONS.STATUS_CANCELED');
      case 'PENDING':
        return this.translations.translate('PLATFORM_SUBSCRIPTIONS.STATUS_PENDING');
      default:
        return item.active
          ? this.translations.translate('COMMON.ACTIVE')
          : this.translations.translate('COMMON.INACTIVE');
    }
  }

  subscriptionStatusClass(item: PlatformAdminSubscription): string {
    return `ud-status-${(item.status || (item.active ? 'ACTIVE' : 'CANCELED')).toLowerCase()}`;
  }

  ngOnInit(): void {
    this.platformAdminService.listSubscriptions().subscribe({
      next: (response) => {
        this.loading = false;
        this.subscriptions = response;
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

  private extractError(error: HttpErrorResponse): string {
    if (typeof error.error?.error === 'string') {
      return error.error.error;
    }
    return this.translations.translate('PLATFORM_SUBSCRIPTIONS.LOAD_ERROR');
  }

  private parseDate(value: string): number {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? 0 : parsed;
  }

  private resetPage(): void {
    this.currentPage = 1;
  }
}
