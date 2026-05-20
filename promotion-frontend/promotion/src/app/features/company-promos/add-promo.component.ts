import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { PromoStatus, PromoType, PromotionPayload } from '../../core/models/promo.model';
import { TranslationService } from '../../core/i18n/translation.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { PromotionService } from '../../core/services/promotion.service';

@Component({
  selector: 'app-add-promo',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, TranslatePipe],
  templateUrl: './add-promo.component.html',
  styleUrl: './add-promo.component.css'
})
export class AddPromoComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly promotionService = inject(PromotionService);
  private readonly translations = inject(TranslationService);

  readonly companySlug = (this.route.snapshot.paramMap.get('slug') ?? '').toLowerCase();
  readonly companyName = this.slugToLabel(this.companySlug);

  submitting = false;
  successMessage = '';
  errorMessage = '';

  readonly statusOptions: Array<{ value: PromoStatus; labelKey: string }> = [
    { value: 'DRAFT', labelKey: 'PROMOS.STATUS_DRAFT' },
    { value: 'ACTIVE', labelKey: 'PROMOS.STATUS_ACTIVE' },
    { value: 'SCHEDULED', labelKey: 'PROMOS.STATUS_SCHEDULED' },
    { value: 'EXPIRED', labelKey: 'PROMOS.STATUS_EXPIRED' }
  ];

  readonly typeOptions: Array<{ value: PromoType; labelKey: string }> = [
    { value: 'PERCENT', labelKey: 'PROMOS.MANAGEMENT.TYPE_PERCENT' },
    { value: 'FIXED', labelKey: 'PROMOS.MANAGEMENT.TYPE_FIXED' },
    { value: 'BOGO', labelKey: 'PROMOS.MANAGEMENT.TYPE_BOGO' }
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
      this.errorMessage = this.t('PROMOS.MANAGEMENT.ERROR_INVALID_COMPANY');
      return;
    }

    if (!this.formModel.title || !this.formModel.startDate || !this.formModel.endDate) {
      this.errorMessage = this.t('PROMOS.MANAGEMENT.ERROR_REQUIRED_FIELDS');
      return;
    }

    if (this.formModel.status === 'ACTIVE' && !this.formModel.code.trim()) {
      this.errorMessage = this.t('PROMOS.MANAGEMENT.ERROR_ACTIVE_COUPON');
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
        this.successMessage = this.t('PROMOS.MANAGEMENT.SUCCESS_CREATED');
        setTimeout(() => {
          this.router.navigate([`/entreprises/${this.companySlug}`]);
        }, 500);
      },
      error: () => {
        this.submitting = false;
        this.errorMessage = this.t('PROMOS.MANAGEMENT.ERROR_CREATE');
      }
    });
  }

  categoryLabel(category: string): string {
    const keyByCategory: Record<string, string> = {
      mode: 'PROMOS.CATEGORY_FASHION',
      beaute: 'PROMOS.CATEGORY_BEAUTY',
      maison: 'PROMOS.CATEGORY_HOME',
      sport: 'PROMOS.CATEGORY_SPORT',
      alimentaire: 'PROMOS.CATEGORY_FOOD',
      quotidien: 'PROMOS.CATEGORY_DAILY'
    };
    const key = keyByCategory[this.normalizeText(category)];
    return key ? this.t(key) : category;
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
      return this.t('TABLE.COMPANY');
    }

    return slug
      .split('-')
      .filter(Boolean)
      .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1))
      .join(' ');
  }

  private t(key: string, params?: Record<string, string | number>): string {
    return this.translations.translate(key, params);
  }

  private normalizeText(value: string): string {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
  }
}
