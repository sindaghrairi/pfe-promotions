import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { AuthService } from '../../../core/services/auth.service';
import { AccountService } from '../../../core/services/account.service';
import { AdminSubscriptionResponse } from '../../../core/models/auth.model';
import { TranslationService } from '../../../core/i18n/translation.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';

type BillingCycle = 'MONTHLY' | 'YEARLY';
type PlanKey = 'BASIC' | 'STANDARD' | 'PREMIUM';
type SubscriptionStatus = 'ACTIVE' | 'EXPIRED' | 'CANCELED' | 'PENDING' | 'OVERDUE';

type SubscriptionSnapshot = {
  companyName: string;
  email: string;
  plan: PlanKey;
  billingCycle: BillingCycle;
  amount: number;
  issuedAt: string;
  nextInvoice: string;
  status: SubscriptionStatus;
  latestInvoiceStatus?: string | null;
  redirectTo: string;
};

@Component({
  selector: 'app-admin-subscription-overview',
  standalone: true,
  imports: [CommonModule, RouterLink, TranslatePipe],
  templateUrl: './admin-subscription-overview.component.html',
  styleUrl: './admin-subscription-overview.component.css'
})
export class AdminSubscriptionOverviewComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);
  private readonly accountService = inject(AccountService);
  private readonly translations = inject(TranslationService);

  snapshot: SubscriptionSnapshot | null = null;
  loading = false;
  errorMessage = '';
  successMessage = '';
  reactivating = false;
  companyName ="";
  contactEmail = '';
  fallbackRedirect = '/dashboard';

  constructor() {
    const query = this.route.snapshot.queryParamMap;

    this.companyName = query.get('companyName') || this.companyName;
    this.contactEmail = query.get('email') || '';

    const redirectTo = query.get('redirectTo') || '';
    if (redirectTo.startsWith('/')) {
      this.fallbackRedirect = redirectTo;
    }

    this.snapshot = this.readSnapshot();

    if (this.snapshot) {
      this.companyName = this.snapshot.companyName || this.companyName;
      this.contactEmail = this.snapshot.email || this.contactEmail;
      this.fallbackRedirect = this.snapshot.redirectTo || this.fallbackRedirect;
    }

    this.loadSubscriptionFromApi();
  }

  get hasSnapshot(): boolean {
    return Boolean(this.snapshot);
  }

  get planLabel(): string {
    const plan = this.snapshot?.plan;
    if (plan === 'BASIC') {
      return 'Basic';
    }
    if (plan === 'PREMIUM') {
      return 'Premium';
    }
    if (plan === 'STANDARD') {
      return 'Standard';
    }
    return '-';
  }

  get cycleLabel(): string {
    const cycle = this.snapshot?.billingCycle;
    if (cycle === 'YEARLY') {
      return this.translations.translate('PAYMENT.YEARLY');
    }
    if (cycle === 'MONTHLY') {
      return this.translations.translate('PAYMENT.MONTHLY');
    }
    return '-';
  }

  get cycleSuffixLabel(): string {
    return this.snapshot?.billingCycle === 'YEARLY'
      ? this.translations.translate('PAYMENT.YEAR_SUFFIX')
      : this.translations.translate('PAYMENT.MONTH_SUFFIX');
  }

  get amountLabel(): string {
    const amount = this.snapshot?.amount;
    if (typeof amount !== 'number' || Number.isNaN(amount)) {
      return '-';
    }

    return `${amount.toFixed(2)} DT`;
  }

  get dateLabel(): string {
    const issuedAt = this.snapshot?.nextInvoice || this.snapshot?.issuedAt;
    if (!issuedAt) {
      return '-';
    }

    const parsed = new Date(issuedAt);
    if (Number.isNaN(parsed.getTime())) {
      return '-';
    }

    return new Intl.DateTimeFormat('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    }).format(parsed);
  }

  get statusLabel(): string {
    return this.snapshot?.status ?? 'PENDING';
  }

  get canReactivate(): boolean {
    return this.snapshot?.status === 'EXPIRED' || this.snapshot?.status === 'CANCELED';
  }

  get statusBadgeClass(): string {
    const status = this.snapshot?.status;
    if (status === 'ACTIVE' && !this.isSoonDue()) {
      return 'sub-status-green';
    }
    if (status === 'PENDING' || (status === 'ACTIVE' && this.isSoonDue())) {
      return 'sub-status-orange';
    }
    return 'sub-status-red';
  }

  openInvoice(): void {
    if (!this.snapshot) {
      return;
    }

    this.router.navigate(['/admin/subscribe/invoice'], {
      queryParams: {
        companyName: this.snapshot.companyName,
        email: this.snapshot.email,
        redirectTo: this.snapshot.redirectTo,
        plan: this.snapshot.plan,
        billingCycle: this.snapshot.billingCycle,
        amount: this.snapshot.amount,
        issuedAt: this.snapshot.issuedAt
      }
    });
  }

  reactivateSubscription(): void {
    if (!this.canReactivate || this.reactivating) {
      return;
    }

    this.reactivating = true;
    this.errorMessage = '';
    this.successMessage = '';

    this.accountService.reactivateCompanySubscription().subscribe({
      next: (subscription) => {
        this.reactivating = false;
        this.successMessage = subscription.message
          || 'Votre abonnement a ete reactive. Une nouvelle facture est en attente de validation.';
        this.applySubscription(subscription);
        this.loadSubscriptionFromApi(false);
      },
      error: (error: HttpErrorResponse) => {
        this.reactivating = false;
        this.errorMessage = this.extractApiError(error);
      }
    });
  }

  goToPayment(): void {
    this.router.navigate(['/admin/subscribe/payment'], {
      queryParams: {
        companyName: this.companyName,
        email: this.contactEmail,
        redirectTo: this.fallbackRedirect
      }
    });
  }

  private readSnapshot(): SubscriptionSnapshot | null {
    if (typeof window === 'undefined' || !window.localStorage) {
      return null;
    }

    const raw = localStorage.getItem('admin_subscription_snapshot');
    if (!raw) {
      return null;
    }

    try {
      const parsed = JSON.parse(raw) as Partial<SubscriptionSnapshot>;
      if (!parsed || typeof parsed !== 'object') {
        return null;
      }

      if (!parsed.companyName || !parsed.plan || !parsed.billingCycle) {
        return null;
      }

      if (this.isPlaceholderCompanyName(parsed.companyName)) {
        return null;
      }

      if (this.companyName.trim() && !this.isSameCompany(parsed.companyName, this.companyName)) {
        return null;
      }

      return {
        companyName: parsed.companyName,
        email: parsed.email ?? '',
        plan: parsed.plan,
        billingCycle: parsed.billingCycle,
        amount: Number(parsed.amount) || 0,
        issuedAt: parsed.issuedAt ?? '',
        nextInvoice: parsed.nextInvoice ?? parsed.issuedAt ?? '',
        status: parsed.status ?? 'PENDING',
        latestInvoiceStatus: parsed.latestInvoiceStatus ?? null,
        redirectTo: parsed.redirectTo ?? this.fallbackRedirect
      };
    } catch {
      return null;
    }
  }

  private isPlaceholderCompanyName(name: string): boolean {
    const normalized = name.trim().toLowerCase();
    return normalized === 'societe' || normalized === 'entreprise' || normalized === 'societey';
  }

  private loadSubscriptionFromApi(showLoader = true): void {
    this.loading = showLoader;
    this.errorMessage = '';

    this.accountService.getCompanySubscription().subscribe({
      next: (subscription) => {
        this.loading = false;
        this.applySubscription(subscription);
      },
      error: () => {
        this.loadSubscriptionByCompanyFallback();
      }
    });
  }

  private loadSubscriptionByCompanyFallback(): void {
    if (!this.companyName.trim()) {
      this.loadSubscriptionFromMeFallback();
      return;
    }

    this.authService.adminSubscriptionByCompanyName(this.companyName).subscribe({
      next: (subscription) => {
        this.loading = false;
        this.applySubscription(subscription);
        this.errorMessage = '';
      },
      error: (error: HttpErrorResponse) => {
        this.loading = false;
        this.snapshot = null;
        this.errorMessage = this.extractApiError(error);
      }
    });
  }

  private isSameCompany(left: string | null | undefined, right: string | null | undefined): boolean {
    return this.normalizeCompanyName(left) === this.normalizeCompanyName(right);
  }

  private normalizeCompanyName(value: string | null | undefined): string {
    return (value ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '');
  }

  private loadSubscriptionFromMeFallback(): void {
    this.authService.adminSubscriptionMe().subscribe({
      next: (subscription) => {
        this.loading = false;
        this.applySubscription(subscription);
        this.errorMessage = '';
      },
      error: (error: HttpErrorResponse) => {
        this.loading = false;
        this.snapshot = null;
        this.errorMessage = this.extractApiError(error);
      }
    });
  }

  private extractApiError(error: HttpErrorResponse): string {
    if (error.status === 401 || error.status === 403) {
      return this.translations.translate('SUB_OVERVIEW.INVALID_SESSION');
    }

    const payload = error.error as { error?: string } | null;
    if (payload?.error) {
      return payload.error;
    }

    return this.translations.translate('SUB_OVERVIEW.LOAD_ERROR');
  }

  private applySubscription(subscription: AdminSubscriptionResponse): void {
    const plan = subscription.plan;
    const amount = plan === 'BASIC' ? 29 : plan === 'STANDARD' ? 79 : 149;

    this.snapshot = {
      companyName: subscription.companyName || this.companyName,
      email: subscription.contactEmail || this.contactEmail,
      plan,
      billingCycle: 'MONTHLY',
      amount,
      issuedAt: subscription.createdAt || new Date().toISOString(),
      nextInvoice: subscription.nextInvoice || subscription.latestInvoiceDueAt || subscription.createdAt || new Date().toISOString(),
      status: subscription.status || (subscription.active === false ? 'CANCELED' : 'ACTIVE'),
      latestInvoiceStatus: subscription.latestInvoiceStatus,
      redirectTo: this.fallbackRedirect
    };

    this.companyName = this.snapshot.companyName;
    this.contactEmail = this.snapshot.email;
  }

  private isSoonDue(): boolean {
    const nextInvoice = this.snapshot?.nextInvoice;
    if (!nextInvoice) {
      return false;
    }

    const parsed = new Date(nextInvoice);
    if (Number.isNaN(parsed.getTime())) {
      return false;
    }

    const today = new Date();
    const diffMs = parsed.getTime() - today.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    return diffDays >= 0 && diffDays <= 7;
  }
}
