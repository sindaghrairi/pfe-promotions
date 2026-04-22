import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { AuthService } from '../../core/services/auth.service';
import { PromotionService } from '../../core/services/promotion.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css'
})
export class DashboardComponent implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly promotionService = inject(PromotionService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  email = this.authService.getStoredEmail() ?? '';
  role = (this.authService.getStoredRole() ?? '').toUpperCase();
  loadingUser = false;
  loadingCompanies = false;
  selectedCompanySlug = '';
  connectedCompanySlug = '';
  connectedCompanyName = '';
  companiesError = '';

  ngOnInit(): void {
    this.selectedCompanySlug = this.route.snapshot.queryParamMap.get('company') ?? '';
    this.loadingUser = true;

    this.authService.me().subscribe({
      next: (response) => {
        this.loadingUser = false;
        this.email = response.email;
        this.role = (response.role ?? this.role).toUpperCase();
        this.connectedCompanySlug = response.companySlug ?? '';
        this.connectedCompanyName = response.companyName ?? '';

        if (!this.isClientSpace && this.connectedCompanySlug) {
          this.router.navigate(['/entreprises', this.connectedCompanySlug]);
          return;
        }

        if (this.isClientSpace) {
          this.loadPublishedCompanies();
        }
      },
      error: () => {
        this.loadingUser = false;
        this.logout();
      }
    });
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/']);
  }

  get hasSelectedCompany(): boolean {
    return Boolean(this.selectedCompanySlug);
  }

  get hasConnectedCompany(): boolean {
    return Boolean(this.connectedCompanySlug);
  }

  get selectedCompanyLabel(): string {
    if (!this.selectedCompanySlug) {
      return 'Aucune entreprise selectionnee';
    }

    return this.slugToLabel(this.selectedCompanySlug);
  }

  get connectedCompanyLabel(): string {
    if (this.connectedCompanyName) {
      return this.connectedCompanyName;
    }

    if (!this.connectedCompanySlug) {
      return 'Aucune entreprise connectee';
    }

    return this.slugToLabel(this.connectedCompanySlug);
  }

  get isClientSpace(): boolean {
    return this.role === 'CLIENT';
  }

  get hasPublishedCompanies(): boolean {
    return !this.companiesError;
  }

  companyLabelFromSlug(slug: string): string {
    return this.slugToLabel(slug);
  }

  get allPromosLink(): string {
    return '/promos/consulter-toutes';
  }

  get managePromosLink(): string {
    return this.connectedCompanySlug ? `/entreprises/${this.connectedCompanySlug}` : '/';
  }

  get companyDetailsLink(): string {
    return this.selectedCompanySlug ? `/entreprises/${this.selectedCompanySlug}/consulter-promos` : '/';
  }

  private loadPublishedCompanies(): void {
    this.loadingCompanies = true;
    this.companiesError = '';

    this.promotionService.listPublishedCompanySlugs().subscribe({
      next: () => {
        this.loadingCompanies = false;
        this.companiesError = '';
      },
      error: () => {
        this.loadingCompanies = false;
        this.companiesError = "Impossible de charger les promotions pour le moment.";
      }
    });
  }

  private slugToLabel(slug: string): string {
    return slug
      .split('-')
      .filter(Boolean)
      .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1))
      .join(' ');
  }
}
