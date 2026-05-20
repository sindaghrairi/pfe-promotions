import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { AuthService } from '../../../core/services/auth.service';
import { TranslationService } from '../../../core/i18n/translation.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';

type BillingCycle = 'MONTHLY' | 'YEARLY';
type PlanKey = 'BASIC' | 'STANDARD' | 'PREMIUM';

@Component({
  selector: 'app-admin-invoice',
  standalone: true,
  imports: [CommonModule, RouterLink, TranslatePipe],
  templateUrl: './admin-invoice.component.html',
  styleUrl: './admin-invoice.component.css'
})
export class AdminInvoiceComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);
  private readonly translations = inject(TranslationService);

  companyName = 'Societe';
  email = '';
  redirectTo = '/entreprises/entreprise';
  plan: PlanKey = 'STANDARD';
  billingCycle: BillingCycle = 'MONTHLY';
  amount = 0;
  issuedAt = new Date();
  invoiceNumber = '';
  showAdminRegisterButton = true;

  constructor() {
    this.route.queryParamMap.subscribe((params) => {
      const companyName = params.get('companyName') ?? '';
      const email = params.get('email') ?? '';
      const redirectTo = params.get('redirectTo') ?? '';
      const plan = params.get('plan') as PlanKey | null;
      const billingCycle = params.get('billingCycle') as BillingCycle | null;
      const amount = Number(params.get('amount'));
      const issuedAt = params.get('issuedAt');

      if (companyName.trim()) {
        this.companyName = companyName;
      }

      if (email.trim()) {
        this.email = email;
      }

      if (redirectTo.startsWith('/')) {
        this.redirectTo = redirectTo;
      }

      if (plan === 'BASIC' || plan === 'STANDARD' || plan === 'PREMIUM') {
        this.plan = plan;
      }

      if (billingCycle === 'MONTHLY' || billingCycle === 'YEARLY') {
        this.billingCycle = billingCycle;
      }

      if (!Number.isNaN(amount) && amount > 0) {
        this.amount = amount;
      }

      if (issuedAt) {
        const parsed = new Date(issuedAt);
        if (!Number.isNaN(parsed.getTime())) {
          this.issuedAt = parsed;
        }
      }

      this.invoiceNumber = this.buildInvoiceNumber(this.companyName, this.issuedAt);
      this.checkAdminAccountExists();
    });
  }

  get planLabel(): string {
    if (this.plan === 'BASIC') {
      return 'Basic';
    }
    if (this.plan === 'PREMIUM') {
      return 'Premium';
    }
    return 'Standard';
  }

  get cycleLabel(): string {
    return this.billingCycle === 'YEARLY'
      ? this.translations.translate('PAYMENT.YEARLY')
      : this.translations.translate('PAYMENT.MONTHLY');
  }

  get issuedDateLabel(): string {
    return new Intl.DateTimeFormat('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    }).format(this.issuedAt);
  }

  get totalLabel(): string {
    return `${this.amount.toFixed(2)} DT`;
  }

  printInvoice(): void {
    if (typeof window === 'undefined') {
      return;
    }

    window.print();
  }

  continueToAdminRegister(): void {
    this.router.navigate(['/admin/register'], {
      queryParams: {
        email: this.email,
        companyName: this.companyName,
        redirectTo: this.redirectTo
      }
    });
  }

  private checkAdminAccountExists(): void {
    this.authService.adminAccountExists(this.email, this.companyName).subscribe({
      next: (response) => {
        this.showAdminRegisterButton = !response.exists;
      },
      error: () => {
        this.showAdminRegisterButton = true;
      }
    });
  }

  private buildInvoiceNumber(companyName: string, issuedAt: Date): string {
    const seed = companyName
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '')
      .slice(0, 4)
      .padEnd(4, 'X');

    const datePart = `${issuedAt.getFullYear()}${String(issuedAt.getMonth() + 1).padStart(2, '0')}${String(issuedAt.getDate()).padStart(2, '0')}`;
    const randomPart = Math.floor(1000 + Math.random() * 9000);

    return `FAC-${datePart}-${seed}-${randomPart}`;
  }
}
