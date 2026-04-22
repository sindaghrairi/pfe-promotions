import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject } from '@angular/core';
import { switchMap } from 'rxjs';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { AuthService } from '../../../core/services/auth.service';

type PlanKey = 'BASIC' | 'STANDARD' | 'PREMIUM';

type BillingCycle = 'MONTHLY' | 'YEARLY';

interface PricingPlan {
  id: number;
  key: PlanKey;
  label: string;
  monthlyPrice: string;
  yearlyPrice: string;
  monthlyAmount: number;
  yearlyAmount: number;
  subtitle: string;
  features: string[];
}

interface SubscriptionSnapshot {
  companyName: string;
  email: string;
  plan: PlanKey;
  billingCycle: BillingCycle;
  amount: number;
  issuedAt: string;
  redirectTo: string;
}

@Component({
  selector: 'app-admin-payment-type',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './admin-payment-type.component.html',
  styleUrl: './admin-payment-type.component.css'
})
export class AdminPaymentTypeComponent {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly plans: PricingPlan[] = [
    {
      id: 1,
      key: 'BASIC',
      label: 'Basic',
      monthlyPrice: '29 DT',
      yearlyPrice: '29 DT',
      monthlyAmount: 29,
      yearlyAmount: 29,
      subtitle:
        'Basique : Acces aux fonctionnalites essentielles (gestion des produits, promotions et coupons) avec des limitations sur le nombre de promotions et l acces aux statistiques.',
      features: [
        'Gestion des produits, promotions et coupons',
        'Nombre de promotions limite',
        'Acces limite aux statistiques'
      ]
    },
    {
      id: 2,
      key: 'STANDARD',
      label: 'Standard',
      monthlyPrice: '79 DT',
      yearlyPrice: '79 DT',
      monthlyAmount: 79,
      yearlyAmount: 79,
      subtitle:
        'Formule intermediaire ideale pour les entreprises en croissance souhaitant une gestion avancee de leurs promotions.',
      features: [
        'Toutes les fonctionnalites du Basic',
        'Nombre de promotions augmente',
        'Acces complet aux statistiques',
        'Recommandations simples via IA'
      ]
    },
    {
      id: 3,
      key: 'PREMIUM',
      label: 'Premium',
      monthlyPrice: '149 DT',
      yearlyPrice: '149 DT',
      monthlyAmount: 149,
      yearlyAmount: 149,
      subtitle:
        'Premium : Acces complet a toutes les fonctionnalites avec promotions et coupons illimites, statistiques avancees et recommandations completes via le module IA.',
      features: [
        'Promotions et coupons illimites',
        'Statistiques avancees',
        'Recommandations completes via le module IA'
      ]
    }
  ];

  companyName = '';
  contactEmail = '';
  redirectTo = '/entreprises/entreprise';
  selectedPlan: PlanKey = 'STANDARD';
  billingCycle: BillingCycle = 'MONTHLY';

  loading = false;
  errorMessage = '';

  constructor() {
    this.route.queryParamMap.subscribe((params) => {
      this.companyName = params.get('companyName') ?? '';
      this.contactEmail = params.get('email') ?? '';
      const redirectTo = params.get('redirectTo');

      if (redirectTo?.startsWith('/')) {
        this.redirectTo = redirectTo;
      } else if (this.companyName) {
        this.redirectTo = this.buildCompanyRedirect(this.companyName);
      }

      if (!this.companyName || !this.contactEmail) {
        this.errorMessage = "Informations manquantes. Veuillez revenir a l'etape precedente.";
      }
    });
  }

  selectPlan(planKey: PlanKey): void {
    this.selectedPlan = planKey;
  }

  setBillingCycle(cycle: BillingCycle): void {
    this.billingCycle = cycle;
  }

  getPlanPrice(monthlyPrice: string, yearlyPrice: string): string {
    return this.billingCycle === 'YEARLY' ? yearlyPrice : monthlyPrice;
  }

  activateSubscription(): void {
    if (!this.companyName || !this.contactEmail) {
      this.errorMessage = "Informations manquantes. Veuillez revenir a l'etape precedente.";
      return;
    }

    this.loading = true;
    this.errorMessage = '';

    const selectedPlanMeta = this.plans.find((plan) => plan.key === this.selectedPlan);
    if (!selectedPlanMeta) {
      this.loading = false;
      this.errorMessage = 'Plan invalide.';
      return;
    }

    this.authService
      .getPlanById(selectedPlanMeta.id)
      .pipe(
        switchMap((verifiedPlan) =>
          this.authService.adminSubscribe({
            companyName: this.companyName,
            contactEmail: this.contactEmail,
            plan: verifiedPlan.code
          })
        )
      )
      .subscribe({
        next: () => {
          this.loading = false;
          const amount = this.billingCycle === 'YEARLY'
            ? selectedPlanMeta.yearlyAmount
            : selectedPlanMeta.monthlyAmount;
          const issuedAt = new Date().toISOString();

          this.persistSubscriptionSnapshot({
            companyName: this.companyName,
            email: this.contactEmail,
            plan: selectedPlanMeta.key,
            billingCycle: this.billingCycle,
            amount,
            issuedAt,
            redirectTo: this.redirectTo
          });

          this.router.navigate(['/admin/subscribe/invoice'], {
            queryParams: {
              email: this.contactEmail,
              companyName: this.companyName,
              redirectTo: this.redirectTo,
              plan: selectedPlanMeta.key,
              billingCycle: this.billingCycle,
              amount,
              issuedAt
            }
          });
        },
        error: (error: HttpErrorResponse) => {
          this.loading = false;
          this.errorMessage = this.extractApiError(error);
        }
      });
  }

  private extractApiError(error: HttpErrorResponse): string {
    if (error.status === 0) {
      return "Backend non joignable. Verifiez que l'API tourne sur http://localhost:8081.";
    }

    const payload = error.error;

    if (typeof payload?.error === 'string') {
      return payload.error;
    }

    if (payload && typeof payload === 'object') {
      const firstKey = Object.keys(payload)[0];
      if (firstKey && typeof payload[firstKey] === 'string') {
        return payload[firstKey];
      }
    }

    if (error.status >= 500) {
      return 'Erreur serveur. Veuillez reessayer dans quelques instants.';
    }

    return "Echec de l'abonnement. Veuillez reessayer.";
  }

  private buildCompanyRedirect(companyName: string): string {
    const slug = companyName
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    return `/entreprises/${slug || 'entreprise'}`;
  }

  private persistSubscriptionSnapshot(snapshot: SubscriptionSnapshot): void {
    if (typeof window === 'undefined' || !window.localStorage) {
      return;
    }

    localStorage.setItem('admin_subscription_snapshot', JSON.stringify(snapshot));
  }
}
