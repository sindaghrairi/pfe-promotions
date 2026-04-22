import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { PromoStatus, PromoType, PromotionPayload } from '../../core/models/promo.model';
import { PromotionService } from '../../core/services/promotion.service';

@Component({
  selector: 'app-add-promo',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './add-promo.component.html',
  styleUrl: './add-promo.component.css'
})
export class AddPromoComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly promotionService = inject(PromotionService);

  readonly companySlug = (this.route.snapshot.paramMap.get('slug') ?? '').toLowerCase();
  readonly companyName = this.slugToLabel(this.companySlug);

  submitting = false;
  successMessage = '';
  errorMessage = '';

  readonly statusOptions: Array<{ value: PromoStatus; label: string }> = [
    { value: 'DRAFT', label: 'Brouillon' },
    { value: 'ACTIVE', label: 'Active' },
    { value: 'SCHEDULED', label: 'Planifiee' },
    { value: 'EXPIRED', label: 'Expiree' }
  ];

  readonly typeOptions: Array<{ value: PromoType; label: string }> = [
    { value: 'PERCENT', label: 'Pourcentage' },
    { value: 'FIXED', label: 'Montant fixe' },
    { value: 'BOGO', label: '1 achete = 1 offert' }
  ];

  readonly categories = ['Mode', 'Beaute', 'Maison', 'Sport', 'Alimentaire', 'Quotidien'];

  formModel = {
    title: '',
    type: 'PERCENT' as PromoType,
    category: 'Mode',
    discount: '-10%',
    startDate: '',
    endDate: '',
    code: '',
    status: 'DRAFT' as PromoStatus,
    usageLimit: 100
  };

  submit(): void {
    this.errorMessage = '';
    this.successMessage = '';

    if (!this.companySlug) {
      this.errorMessage = 'Entreprise invalide.';
      return;
    }

    if (!this.formModel.title || !this.formModel.startDate || !this.formModel.endDate) {
      this.errorMessage = 'Veuillez remplir les champs obligatoires.';
      return;
    }

    if (this.formModel.status === 'ACTIVE' && !this.formModel.code.trim()) {
      this.errorMessage = 'Le code coupon est obligatoire pour une promotion active.';
      return;
    }

    const payload: PromotionPayload = {
      title: this.formModel.title,
      type: this.formModel.type,
      category: this.formModel.category,
      discount: this.formModel.discount,
      couponCode: this.formModel.code.trim() || undefined,
      startDate: this.formModel.startDate,
      endDate: this.formModel.endDate,
      status: this.formModel.status,
      usageCount: Math.max(Number(this.formModel.usageLimit) || 0, 0),
      views: 0,
      claimedCount: 0
    };

    this.submitting = true;

    this.promotionService.createPromotion(this.companySlug, payload).subscribe({
      next: () => {
        this.submitting = false;
        this.successMessage = 'Promotion ajoutee avec succes.';
        setTimeout(() => {
          this.router.navigate([`/entreprises/${this.companySlug}`]);
        }, 500);
      },
      error: () => {
        this.submitting = false;
        this.errorMessage = "Impossible d'ajouter la promotion.";
      }
    });
  }

  cancel(): void {
    if (!this.companySlug) {
      this.router.navigate(['/dashboard']);
      return;
    }

    this.router.navigate([`/entreprises/${this.companySlug}`]);
  }

  private slugToLabel(slug: string): string {
    if (!slug) {
      return 'Entreprise';
    }

    return slug
      .split('-')
      .filter(Boolean)
      .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1))
      .join(' ');
  }
}
