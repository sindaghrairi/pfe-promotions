import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, inject } from '@angular/core';
import { switchMap } from 'rxjs';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { ActiveAdminPlanResponse } from '../../../core/models/auth.model';
import { AuthService } from '../../../core/services/auth.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';

type PlanKey = 'BASIC' | 'STANDARD' | 'PREMIUM';

type BillingCycle = 'MONTHLY' | 'YEARLY';

interface PricingPlan {
  id: number;
  key: PlanKey;
  label: string;
  active: boolean;
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
  imports: [CommonModule, RouterLink, TranslatePipe],
  templateUrl: './admin-payment-type.component.html',
  styleUrl: './admin-payment-type.component.css'
})
export class AdminPaymentTypeComponent implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  plans: PricingPlan[] = [];
  companyName = '';
  contactEmail = '';
  redirectTo = '/entreprises/entreprise';
  selectedPlan: PlanKey = 'STANDARD';
  billingCycle: BillingCycle = 'MONTHLY';

  loading = false;
  plansLoading = true;
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

  ngOnInit(): void {
    this.loadActivePlans();
  }

  selectPlan(planKey: PlanKey): void {
    const plan = this.plans.find((item) => item.key === planKey);
    if (!plan?.active) {
      return;
    }

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
    if (!selectedPlanMeta || !selectedPlanMeta.active) {
      this.loading = false;
      this.errorMessage = 'Ce plan est indisponible pour le moment.';
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

  private loadActivePlans(): void {
    this.plansLoading = true;

    this.authService.listActiveAdminPlans().subscribe({
      next: (plans) => {
        this.plansLoading = false;
        this.plans = plans
          .filter((plan) => this.isPlanKey(plan.name))
          .map((plan) => this.toPricingPlan(plan));

        const activePlans = this.plans.filter((plan) => plan.active);
        if (!activePlans.length) {
          this.errorMessage = 'Aucun plan actif disponible pour le moment.';
          return;
        }

        if (!activePlans.some((plan) => plan.key === this.selectedPlan)) {
          this.selectedPlan = activePlans[0].key;
        }
      },
      error: (error: HttpErrorResponse) => {
        this.plansLoading = false;
        this.errorMessage = this.extractApiError(error);
      }
    });
  }

  private toPricingPlan(plan: ActiveAdminPlanResponse): PricingPlan {
    const monthlyAmount = Number(plan.price || 0);
    const yearlyAmount = monthlyAmount * 12;
    const label = this.planLabel(plan.name);

    return {
      id: plan.id,
      key: plan.name,
      label,
      active: plan.active,
      monthlyPrice: `${this.formatPrice(monthlyAmount)} DT`,
      yearlyPrice: `${this.formatPrice(yearlyAmount)} DT`,
      monthlyAmount,
      yearlyAmount,
      subtitle: plan.description,
      features: this.planFeatures(plan.name)
    };
  }

  private formatPrice(amount: number): string {
    return Number.isInteger(amount) ? `${amount}` : amount.toFixed(2);
  }

  private isPlanKey(value: string): value is PlanKey {
    return value === 'BASIC' || value === 'STANDARD' || value === 'PREMIUM';
  }

  private planLabel(plan: PlanKey): string {
    if (plan === 'BASIC') {
      return 'Basic';
    }
    if (plan === 'PREMIUM') {
      return 'Premium';
    }
    return 'Standard';
  }

  private planFeatures(plan: PlanKey): string[] {
    if (plan === 'BASIC') {
      return [
        'Gestion des produits, promotions et coupons',
        'Nombre de promotions limite',
        'Acces limite aux statistiques'
      ];
    }

    if (plan === 'PREMIUM') {
      return [
        'Promotions et coupons illimites',
        'Statistiques avancees',
        'Recommandations completes via le module IA'
      ];
    }

    return [
      'Toutes les fonctionnalites du Basic',
      'Nombre de promotions augmente',
      'Acces complet aux statistiques',
      'Recommandations simples via IA'
    ];
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
