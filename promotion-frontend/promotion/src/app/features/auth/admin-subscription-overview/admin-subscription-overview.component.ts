import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { AuthService } from '../../../core/services/auth.service';
import { TranslationService } from '../../../core/i18n/translation.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';

type BillingCycle = 'MONTHLY' | 'YEARLY';
type PlanKey = 'BASIC' | 'STANDARD' | 'PREMIUM';

type SubscriptionSnapshot = {
  companyName: string;
  email: string;
  plan: PlanKey;
  billingCycle: BillingCycle;
  amount: number;
  issuedAt: string;
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
  private readonly translations = inject(TranslationService);

  snapshot: SubscriptionSnapshot | null = null;
  loading = false;
  errorMessage = '';
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
    const issuedAt = this.snapshot?.issuedAt;
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

      return {
        companyName: parsed.companyName,
        email: parsed.email ?? '',
        plan: parsed.plan,
        billingCycle: parsed.billingCycle,
        amount: Number(parsed.amount) || 0,
        issuedAt: parsed.issuedAt ?? '',
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

  private loadSubscriptionFromApi(): void {
    this.loading = true;
    this.errorMessage = '';

    if (this.companyName.trim()) {
      this.loadSubscriptionByCompanyFallback();
      return;
    }

    this.authService.adminSubscriptionMe().subscribe({
      next: (subscription) => {
        this.loading = false;
        const plan = subscription.plan;
        const amount = plan === 'BASIC' ? 29 : plan === 'STANDARD' ? 79 : 149;

        this.snapshot = {
          companyName: subscription.companyName || this.companyName,
          email: subscription.contactEmail || this.contactEmail,
          plan,
          billingCycle: 'MONTHLY',
          amount,
          issuedAt: subscription.createdAt || new Date().toISOString(),
          redirectTo: this.fallbackRedirect
        };

        this.companyName = this.snapshot.companyName;
        this.contactEmail = this.snapshot.email;
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
        const plan = subscription.plan;
        const amount = plan === 'BASIC' ? 29 : plan === 'STANDARD' ? 79 : 149;

        this.snapshot = {
          companyName: subscription.companyName || this.companyName,
          email: subscription.contactEmail || this.contactEmail,
          plan,
          billingCycle: 'MONTHLY',
          amount,
          issuedAt: subscription.createdAt || new Date().toISOString(),
          redirectTo: this.fallbackRedirect
        };

        this.errorMessage = '';
      },
      error: () => {
        this.loadSubscriptionFromMeFallback();
      }
    });
  }

  private loadSubscriptionFromMeFallback(): void {
    this.authService.adminSubscriptionMe().subscribe({
      next: (subscription) => {
        this.loading = false;
        const plan = subscription.plan;
        const amount = plan === 'BASIC' ? 29 : plan === 'STANDARD' ? 79 : 149;

        this.snapshot = {
          companyName: subscription.companyName || this.companyName,
          email: subscription.contactEmail || this.contactEmail,
          plan,
          billingCycle: 'MONTHLY',
          amount,
          issuedAt: subscription.createdAt || new Date().toISOString(),
          redirectTo: this.fallbackRedirect
        };

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
      return 'Session invalide. Veuillez vous reconnecter en tant qu\'admin.';
    }

    const payload = error.error as { error?: string } | null;
    if (payload?.error) {
      return payload.error;
    }

    return 'Impossible de charger l\'abonnement depuis la base de donnees.';
  }
}
