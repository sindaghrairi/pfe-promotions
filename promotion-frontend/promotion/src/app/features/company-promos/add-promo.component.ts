import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { PromotionAiEvaluationRequest, PromotionAiEvaluationResponse } from '../../core/models/ai-promotion.model';
import { AdminSubscriptionResponse } from '../../core/models/auth.model';
import { PromoStatus, PromoType, PromotionDto, PromotionPayload } from '../../core/models/promo.model';
import { TranslationService } from '../../core/i18n/translation.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { AiPromotionService } from '../../core/services/ai-promotion.service';
import { AuthService } from '../../core/services/auth.service';
import { PromotionService } from '../../core/services/promotion.service';

@Component({
  selector: 'app-add-promo',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, TranslatePipe],
  templateUrl: './add-promo.component.html',
  styleUrl: './add-promo.component.css'
})
export class AddPromoComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly aiPromotionService = inject(AiPromotionService);
  private readonly authService = inject(AuthService);
  private readonly promotionService = inject(PromotionService);
  private readonly translations = inject(TranslationService);
  private readonly fb = inject(FormBuilder);

  readonly companySlug = (this.route.snapshot.paramMap.get('slug') ?? '').toLowerCase();
  readonly companyName = this.slugToLabel(this.companySlug);
  readonly editPromotionId = Number(this.route.snapshot.queryParamMap.get('fromPromotion')) || null;

  submitting = false;
  loadingPromotion = false;
  evaluatingPromotion = false;
  attemptedSubmit = false;
  successMessage = '';
  errorMessage = '';
  aiErrorMessage = '';
  aiLoginLink: string | null = null;
  aiEvaluation: PromotionAiEvaluationResponse | null = null;
  aiPlanLoading = false;
  aiPlan: AdminSubscriptionResponse['plan'] | null = null;
  private editingPromotion: PromotionDto | null = null;

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

  readonly categories = [
    'Mode',
    'Beaute',
    'Maison',
    'Sport',
    'Alimentaire',
    'Electronique',
    'Restaurant',
    'Services',
    'Quotidien'
  ];

  private readonly priceRangeValidator: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
    const initialPrice = Number(control.get('initialPrice')?.value);
    const promotionalPrice = Number(control.get('promotionalPrice')?.value);

    if (!Number.isFinite(initialPrice) || !Number.isFinite(promotionalPrice)
      || initialPrice <= 0 || promotionalPrice <= 0) {
      return null;
    }

    return promotionalPrice < initialPrice ? null : { incoherentPrices: true };
  };

  readonly form = this.fb.nonNullable.group({
    title: ['', Validators.required],
    type: ['PERCENT' as PromoType],
    category: ['Mode'],
    initialPrice: [0, [Validators.required, Validators.min(0.01)]],
    promotionalPrice: [0, [Validators.required, Validators.min(0.01)]],
    startDate: ['', Validators.required],
    endDate: ['', Validators.required],
    code: [''],
    status: ['DRAFT' as PromoStatus],
    usageLimit: [100, [Validators.min(0)]]
  }, { validators: this.priceRangeValidator });

  constructor() {
    this.loadAiPlan();
    if (this.editPromotionId) {
      this.loadPromotionForEdit(this.editPromotionId);
    }
  }

  get isEditMode(): boolean {
    return Boolean(this.editPromotionId);
  }

  get calculatedDiscount(): number | null {
    const initialPrice = Number(this.form.controls.initialPrice.value);
    const promotionalPrice = Number(this.form.controls.promotionalPrice.value);

    if (!Number.isFinite(initialPrice) || !Number.isFinite(promotionalPrice)
      || initialPrice <= 0 || promotionalPrice <= 0 || promotionalPrice >= initialPrice) {
      return null;
    }

    return Math.round(((initialPrice - promotionalPrice) / initialPrice) * 10000) / 100;
  }

  get calculatedDiscountLabel(): string {
    const discount = this.calculatedDiscount;
    if (discount === null) {
      return '-';
    }

    return `-${new Intl.NumberFormat(this.discountLocale, {
      maximumFractionDigits: 2
    }).format(discount)}%`;
  }

  get adminLoginQueryParams(): { redirectTo: string; company: string } {
    return {
      redirectTo: this.router.url,
      company: this.companyName
    };
  }

  get hasAiAccess(): boolean {
    return this.aiPlan === 'STANDARD' || this.aiPlan === 'PREMIUM';
  }

  get isStandardAi(): boolean {
    return this.aiPlan === 'STANDARD';
  }

  get isPremiumAi(): boolean {
    return this.aiPlan === 'PREMIUM';
  }

  get aiPanelTitle(): string {
    return this.isStandardAi ? 'Conseils IA simples' : this.t('PROMOS.MANAGEMENT.AI_RECOMMENDATIONS');
  }

  get aiPanelDescription(): string {
    return this.isStandardAi
      ? 'Ces recommandations sont generees automatiquement a partir des informations saisies.'
      : 'Analyse avancee disponible avec votre plan Premium.';
  }

  get aiAnalyzeButtonLabel(): string {
    if (this.evaluatingPromotion) {
      return this.t('PROMOS.MANAGEMENT.AI_ANALYZING');
    }

    return this.isStandardAi ? 'Analyser ma promotion' : this.t('PROMOS.MANAGEMENT.AI_ANALYZE');
  }

  submit(): void {
    this.attemptedSubmit = true;
    this.errorMessage = '';
    this.successMessage = '';

    if (!this.ensureCompanyAdminSession()) {
      return;
    }

    if (!this.companySlug) {
      this.errorMessage = this.t('PROMOS.MANAGEMENT.ERROR_INVALID_COMPANY');
      return;
    }

    this.form.markAllAsTouched();
    if (this.form.controls.title.invalid || this.form.controls.startDate.invalid || this.form.controls.endDate.invalid) {
      this.errorMessage = this.t('PROMOS.MANAGEMENT.ERROR_REQUIRED_FIELDS');
      return;
    }

    if (this.form.controls.initialPrice.invalid || this.form.controls.promotionalPrice.invalid) {
      this.errorMessage = this.t('PROMOS.MANAGEMENT.ERROR_POSITIVE_PRICES');
      return;
    }

    if (this.form.hasError('incoherentPrices')) {
      this.errorMessage = this.t('PROMOS.MANAGEMENT.ERROR_PROMOTIONAL_PRICE');
      return;
    }

    const value = this.form.getRawValue();
    if (value.status === 'ACTIVE' && !value.code.trim()) {
      this.errorMessage = this.t('PROMOS.MANAGEMENT.ERROR_ACTIVE_COUPON');
      return;
    }

    const payload: PromotionPayload = {
      title: value.title,
      type: value.type,
      category: value.category,
      initialPrice: Number(value.initialPrice),
      promotionalPrice: Number(value.promotionalPrice),
      couponCode: value.code.trim() || undefined,
      startDate: value.startDate,
      endDate: value.endDate,
      status: value.status,
      usageCount: Math.max(Number(value.usageLimit) || 0, 0),
      views: this.editingPromotion?.views ?? 0,
      claimedCount: this.editingPromotion?.claimedCount ?? 0
    };

    this.submitting = true;
    const request$ = this.editingPromotion
      ? this.promotionService.updatePromotion(this.companySlug, this.editingPromotion.id, payload)
      : this.promotionService.createPromotion(this.companySlug, payload);

    request$.subscribe({
      next: () => {
        this.submitting = false;
        this.successMessage = this.isEditMode
          ? this.t('PROMOS.MANAGEMENT.SUCCESS_UPDATED')
          : this.t('PROMOS.MANAGEMENT.SUCCESS_CREATED');
        setTimeout(() => {
          this.router.navigate([`/entreprises/${this.companySlug}`]);
        }, 500);
      },
      error: (error: HttpErrorResponse) => {
        this.submitting = false;
        if (error.status === 401 || error.status === 403) {
          this.handleInvalidCompanyAdminSession();
          return;
        }

        this.errorMessage = this.backendMessage(error)
          || this.t(this.isEditMode ? 'PROMOS.MANAGEMENT.ERROR_UPDATE' : 'PROMOS.MANAGEMENT.ERROR_CREATE');
      }
    });
  }

  evaluatePromotion(): void {
    this.aiErrorMessage = '';
    this.aiLoginLink = null;
    this.aiEvaluation = null;

    if (!this.hasAiAccess) {
      return;
    }

    const token = this.authService.getToken();
    const role = this.authService.getStoredRole();
    console.info(
      '[aiPromotion] session before evaluation tokenPresent=%s role=%s tokenExpired=%s',
      Boolean(token),
      role,
      token ? this.isJwtExpired(token) : 'no-token'
    );

    if (!token) {
      this.aiErrorMessage = 'Veuillez vous reconnecter.';
      this.aiLoginLink = this.adminLoginLink();
      return;
    }

    if (role !== 'ADMIN') {
      this.aiErrorMessage = 'Acces reserve aux admins societe.';
      return;
    }

    this.evaluatingPromotion = true;

    this.aiPromotionService.evaluatePromotion(this.buildAiPayload()).subscribe({
      next: (evaluation) => {
        this.evaluatingPromotion = false;
        this.aiEvaluation = evaluation;
      },
      error: (error: HttpErrorResponse) => {
        this.evaluatingPromotion = false;
        if (error.status === 401) {
          this.handleExpiredAiSession();
          return;
        }

        this.aiErrorMessage = this.aiAnalysisErrorMessage(error);
      }
    });
  }

  aiLevelClass(level: PromotionAiEvaluationResponse['level']): string {
    switch (level) {
      case 'Excellent':
        return 'ai-level-excellent';
      case 'Bon':
        return 'ai-level-good';
      case 'Moyen':
        return 'ai-level-medium';
      default:
        return 'ai-level-low';
    }
  }

  showPositivePriceError(controlName: 'initialPrice' | 'promotionalPrice'): boolean {
    const control = this.form.controls[controlName];
    return control.invalid && (control.touched || this.attemptedSubmit);
  }

  get showPriceRangeError(): boolean {
    return this.form.hasError('incoherentPrices')
      && (this.form.controls.initialPrice.touched || this.form.controls.promotionalPrice.touched || this.attemptedSubmit);
  }

  categoryLabel(category: string): string {
    const keyByCategory: Record<string, string> = {
      mode: 'PROMOS.CATEGORY_FASHION',
      beaute: 'PROMOS.CATEGORY_BEAUTY',
      maison: 'PROMOS.CATEGORY_HOME',
      sport: 'PROMOS.CATEGORY_SPORT',
      alimentaire: 'PROMOS.CATEGORY_FOOD',
      electronique: 'PROMOS.CATEGORY_ELECTRONICS',
      restaurant: 'PROMOS.CATEGORY_RESTAURANT',
      services: 'PROMOS.CATEGORY_SERVICES',
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

  private get discountLocale(): string {
    return this.translations.currentLanguage() === 'en' ? 'en-US' : 'fr-FR';
  }

  private loadPromotionForEdit(promotionId: number): void {
    if (!this.companySlug) {
      return;
    }

    this.loadingPromotion = true;
    this.promotionService.listCompanyPromotions(this.companySlug).subscribe({
      next: (items) => {
        this.loadingPromotion = false;
        const promotion = items.find((item) => item.id === promotionId);
        if (!promotion) {
          this.errorMessage = this.t('PROMOS.MANAGEMENT.ERROR_PROMOTION_NOT_FOUND');
          return;
        }

        this.editingPromotion = promotion;
        this.form.patchValue({
          title: promotion.title,
          type: promotion.type,
          category: promotion.category,
          initialPrice: Number(promotion.initialPrice) || 0,
          promotionalPrice: Number(promotion.promotionalPrice) || 0,
          startDate: promotion.startDate,
          endDate: promotion.endDate,
          code: promotion.couponCode ?? '',
          status: promotion.status,
          usageLimit: promotion.usageCount ?? 0
        });
      },
      error: (error: HttpErrorResponse) => {
        this.loadingPromotion = false;
        if (error.status === 401 || error.status === 403) {
          this.handleInvalidCompanyAdminSession();
          return;
        }

        this.errorMessage = this.backendMessage(error) || this.t('PROMOS.MANAGEMENT.ERROR_LOAD_EDIT');
      }
    });
  }

  private loadAiPlan(): void {
    if (!this.authService.isAdminAuthenticated()) {
      return;
    }

    this.aiPlanLoading = true;
    this.authService.adminSubscriptionMe().subscribe({
      next: (subscription) => {
        this.aiPlanLoading = false;
        this.aiPlan = subscription.plan;
      },
      error: () => {
        this.aiPlanLoading = false;
        this.aiPlan = null;
      }
    });
  }

  private ensureCompanyAdminSession(aiContext = false): boolean {
    if (this.authService.isAdminAuthenticated()) {
      return true;
    }

    this.handleInvalidCompanyAdminSession(aiContext);
    return false;
  }

  private handleInvalidCompanyAdminSession(aiContext = false): void {
    this.authService.logout();
    const message = aiContext
      ? 'Veuillez vous reconnecter.'
      : this.t('ERRORS.COMPANY_ADMIN_SESSION');

    if (aiContext) {
      this.aiErrorMessage = message;
      return;
    } else {
      this.errorMessage = message;
    }

    this.router.navigate(['/admin/login'], {
      queryParams: {
        redirectTo: this.router.url,
        company: this.companyName
      }
    });
  }

  private handleExpiredAiSession(): void {
    this.authService.logout();
    this.aiErrorMessage = 'Veuillez vous reconnecter.';
    this.aiLoginLink = this.adminLoginLink();
  }

  private backendMessage(error: HttpErrorResponse): string {
    if (typeof error.error?.error === 'string') {
      return error.error.error;
    }

    if (error.error && typeof error.error === 'object') {
      const firstMessage = Object.values(error.error).find((message) => typeof message === 'string');
      return typeof firstMessage === 'string' ? firstMessage : '';
    }

    return '';
  }

  private aiAnalysisErrorMessage(error: HttpErrorResponse): string {
    if (error.status === 0) {
      return this.t('ERRORS.API_UNREACHABLE');
    }

    if (error.status === 401) {
      this.aiLoginLink = this.adminLoginLink();
      return 'Veuillez vous reconnecter.';
    }

    if (error.status === 403) {
      const message = this.backendMessage(error);
      if (this.isSubscriptionForbiddenMessage(message)) {
        return 'Cette fonctionnalit\u00e9 est r\u00e9serv\u00e9e aux entreprises abonn\u00e9es.';
      }
      return message || 'Cette fonctionnalit\u00e9 est r\u00e9serv\u00e9e aux entreprises abonn\u00e9es.';
    }

    if (error.status === 404) {
      return this.t('ERRORS.COMPANY_DASHBOARD_ENDPOINT');
    }

    if (error.status >= 500) {
      return this.t('ERRORS.SERVER_RETRY');
    }

    return this.backendMessage(error) || this.t('PROMOS.MANAGEMENT.AI_ERROR');
  }

  private buildAiPayload(): PromotionAiEvaluationRequest {
    const value = this.form.getRawValue();
    return {
      title: value.title,
      type: value.type,
      status: value.status,
      category: value.category,
      initialPrice: Number(value.initialPrice) || 0,
      promotionalPrice: Number(value.promotionalPrice) || 0,
      startDate: value.startDate,
      endDate: value.endDate,
      couponCode: value.code.trim() || undefined,
      usageLimit: Number(value.usageLimit)
    };
  }

  private adminLoginLink(): string {
    return `/admin/login?redirectTo=${encodeURIComponent(this.router.url)}`;
  }

  private isSubscriptionForbiddenMessage(message: string): boolean {
    const normalized = this.normalizeText(message);
    return normalized.includes('fonctionnalite')
      && normalized.includes('reserve')
      && normalized.includes('abonne');
  }

  private isJwtExpired(token: string): boolean | 'unknown' {
    try {
      const parts = token.split('.');
      if (parts.length < 2) {
        return 'unknown';
      }

      const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
      const payload = JSON.parse(atob(padded)) as { exp?: number };
      if (!payload.exp) {
        return 'unknown';
      }

      return payload.exp <= Math.floor(Date.now() / 1000);
    } catch {
      return 'unknown';
    }
  }

  private normalizeText(value: string): string {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
  }
}
