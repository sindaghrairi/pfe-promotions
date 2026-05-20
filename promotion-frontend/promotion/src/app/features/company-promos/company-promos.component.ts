import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  ApexAxisChartSeries,
  ApexChart,
  ApexFill,
  ApexLegend,
  ApexMarkers,
  ApexStroke,
  ApexXAxis,
  ApexYAxis,
  NgApexchartsModule
} from 'ng-apexcharts';

import { PromoStatus, PromoType, PromotionDto, PromotionPayload } from '../../core/models/promo.model';
import { AuthService } from '../../core/services/auth.service';
import { PromotionService } from '../../core/services/promotion.service';
import { TranslationService } from '../../core/i18n/translation.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { LanguageSwitcherComponent } from '../../shared/language-switcher/language-switcher.component';

type PromoItem = PromotionDto;
type StatChartItem = { label: string; value: number; color: string };
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
  selector: 'app-company-promos',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, NgApexchartsModule, TranslatePipe, LanguageSwitcherComponent],
  templateUrl: './company-promos.component.html',
  styleUrl: './company-promos.component.css'
})
export class CompanyPromosComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);
  private readonly promotionService = inject(PromotionService);
  private readonly translations = inject(TranslationService);

  companyName = 'Entreprise';
  companySlug = '';
  allCompaniesMode = false;
  promotions: PromoItem[] = [];
  readOnlyMode = false;
  loading = false;
  showFilters = false;
  errorMessage = '';
  copiedCouponPromoId: number | null = null;
  private readonly claimedCouponIds = new Set<number>();
  subscriptionSnapshot: SubscriptionSnapshot | null = null;
  readonlySearch = '';
  selectedReadCategory = 'ALL';

  readonly readCategories: Array<{ labelKey: string; key: string; icon: string }> = [
    { labelKey: 'PROMOS.CATEGORY_ALL', key: 'ALL', icon: '' },
    { labelKey: 'PROMOS.CATEGORY_BEAUTY', key: 'Beaute', icon: '💄' },
    { labelKey: 'PROMOS.CATEGORY_FOOD', key: 'Alimentaire', icon: '🛒' },
    { labelKey: 'PROMOS.CATEGORY_HOME', key: 'Maison', icon: '🏠' },
    { labelKey: 'PROMOS.CATEGORY_SPORT', key: 'Sport', icon: '🏃' },
    { labelKey: 'PROMOS.CATEGORY_FASHION', key: 'Mode', icon: '👕' }
  ];

  searchTerm = '';
  periodFilter = '30';
  statusFilter: PromoStatus | 'ALL' = 'ALL';
  typeFilter: PromoType | 'ALL' = 'ALL';
  categoryFilter = 'ALL';

  readonly statusOptions: Array<{ value: PromoStatus | 'ALL'; labelKey: string }> = [
    { value: 'ALL', labelKey: 'PROMOS.MANAGEMENT.FILTER_ALL_STATUSES' },
    { value: 'ACTIVE', labelKey: 'PROMOS.STATUS_ACTIVE' },
    { value: 'DRAFT', labelKey: 'PROMOS.STATUS_DRAFT' },
    { value: 'SCHEDULED', labelKey: 'PROMOS.STATUS_SCHEDULED' },
    { value: 'EXPIRED', labelKey: 'PROMOS.STATUS_EXPIRED' }
  ];

  readonly typeOptions: Array<{ value: PromoType | 'ALL'; labelKey: string }> = [
    { value: 'ALL', labelKey: 'PROMOS.MANAGEMENT.FILTER_ALL_TYPES' },
    { value: 'PERCENT', labelKey: 'PROMOS.MANAGEMENT.TYPE_PERCENT' },
    { value: 'FIXED', labelKey: 'PROMOS.MANAGEMENT.TYPE_FIXED' },
    { value: 'BOGO', labelKey: 'PROMOS.MANAGEMENT.TYPE_BOGO' }
  ];

  readonly categories = ['ALL', 'Mode', 'Beaute', 'Maison', 'Sport', 'Alimentaire', 'Quotidien'];

  get offerTypeSplit(): Array<{ label: string; value: number; color: string }> {
    const source = this.promotions;
    const total = source.length;
    const meta: Array<{ key: PromoType; label: string; color: string }> = [
      { key: 'PERCENT', label: 'Pourcentage', color: '#6366f1' },
      { key: 'FIXED', label: 'Montant fixe', color: '#22c55e' },
      { key: 'BOGO', label: '1 achete = 1 offert', color: '#f59e0b' }
    ];

    if (!total) {
      return meta.map((item) => ({ label: item.label, value: 0, color: item.color }));
    }

    const counts = meta.map((item) => source.filter((promo) => this.resolveOfferType(promo) === item.key).length);
    const percents = counts.map((count) => Math.round((count / total) * 100));
    const sum = percents.reduce((acc, val) => acc + val, 0);

    if (sum !== 100 && percents.length) {
      percents[percents.length - 1] = Math.max(0, 100 - (sum - percents[percents.length - 1]));
    }

    return meta.map((item, index) => ({
      label: item.label,
      value: percents[index],
      color: item.color
    }));
  }

  get offerTypeTotal(): number {
    return this.promotions.length;
  }

  private resolveOfferType(promo: PromoItem): PromoType {
    const raw = String(promo.type ?? '').toUpperCase();
    if (raw === 'PERCENT' || raw === 'FIXED' || raw === 'BOGO') {
      return raw as PromoType;
    }
    if (raw.includes('PERCENT')) {
      return 'PERCENT';
    }
    if (raw.includes('FIXED')) {
      return 'FIXED';
    }
    if (raw.includes('BOGO')) {
      return 'BOGO';
    }

    const discount = String(promo.discount ?? '').toLowerCase();
    if (discount.includes('%')) {
      return 'PERCENT';
    }
    if (discount.includes('1+1') || discount.includes('1 + 1') || discount.includes('1 achete')) {
      return 'BOGO';
    }

    return 'FIXED';
  }

  constructor() {
    const currentPath = this.route.snapshot.routeConfig?.path ?? '';
    const slug = (this.route.snapshot.paramMap.get('slug') ?? '').toLowerCase();
    this.companySlug = slug;
    this.allCompaniesMode = currentPath === 'promos/consulter-toutes';
    this.companyName = this.allCompaniesMode ? this.t('PROMOS.ALL_COMPANIES') : this.slugToLabel(slug);
    this.readOnlyMode = currentPath === 'entreprises/:slug/consulter-promos' || this.allCompaniesMode;
    this.subscriptionSnapshot = this.readSubscriptionSnapshot();

    this.loadPromotions();
  }

  get hasSubscriptionInfo(): boolean {
    return Boolean(this.subscriptionSnapshot);
  }

  get subscriptionPlanLabel(): string {
    const plan = this.subscriptionSnapshot?.plan;
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

  get subscriptionCycleLabel(): string {
    const cycle = this.subscriptionSnapshot?.billingCycle;
    if (cycle === 'YEARLY') {
      return this.t('PAYMENT.YEARLY');
    }
    if (cycle === 'MONTHLY') {
      return this.t('PAYMENT.MONTHLY');
    }
    return '-';
  }

  get subscriptionAmountLabel(): string {
    const amount = this.subscriptionSnapshot?.amount;
    if (typeof amount !== 'number' || Number.isNaN(amount)) {
      return '-';
    }

    return `${amount.toFixed(2)} DT`;
  }

  get subscriptionDateLabel(): string {
    const issuedAt = this.subscriptionSnapshot?.issuedAt;
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

  get activeCount(): number {
    return this.promotions.filter((promo) => promo.status === 'ACTIVE').length;
  }

  get activeCountInScope(): number {
    return this.scopedPromotions.filter((promo) => promo.status === 'ACTIVE').length;
  }

  get expiredCount(): number {
    return this.promotions.filter((promo) => promo.status === 'EXPIRED').length;
  }

  get totalUsage(): number {
    return this.promotions.reduce((sum, promo) => sum + promo.usageCount, 0);
  }

  get averageViewsPerPromotion(): number {
    if (!this.promotions.length) {
      return 0;
    }

    const totalViews = this.promotions.reduce((sum, promo) => sum + promo.views, 0);
    return Math.round(totalViews / this.promotions.length);
  }

  get statusChartItems(): StatChartItem[] {
    const source = this.scopedPromotions;
    const statusMeta: Array<{ key: PromoStatus; label: string; color: string }> = [
      { key: 'ACTIVE', label: 'Actives', color: '#1c8b5a' },
      { key: 'DRAFT', label: 'Brouillons', color: '#697783' },
      { key: 'SCHEDULED', label: 'Planifiees', color: '#1d76d2' },
      { key: 'EXPIRED', label: 'Expirees', color: '#b54a4a' }
    ];

    return statusMeta.map((item) => ({
      label: item.label,
      value: source.filter((promo) => promo.status === item.key).length,
      color: item.color
    }));
  }

  get categoryChartItems(): StatChartItem[] {
    const source = this.scopedPromotions;
    const categoryCounts = source.reduce((acc, promo) => {
      const key = promo.category?.trim() || 'Autres';
      acc.set(key, (acc.get(key) ?? 0) + 1);
      return acc;
    }, new Map<string, number>());

    const palette = ['#1f9aa2', '#1d76d2', '#6f63df', '#eb973b', '#4c8f5e'];

    return Array.from(categoryCounts.entries())
      .sort((left, right) => right[1] - left[1])
      .slice(0, 5)
      .map(([label, value], index) => ({
        label,
        value,
        color: palette[index % palette.length]
      }));
  }

  get maxStatusValue(): number {
    const max = Math.max(...this.statusChartItems.map((item) => item.value), 0);
    return max || 1;
  }

  get maxCategoryValue(): number {
    const max = Math.max(...this.categoryChartItems.map((item) => item.value), 0);
    return max || 1;
  }

  get activeSharePercent(): number {
    const total = this.scopedPromotions.length;
    if (!total) {
      return 0;
    }

    return Math.round((this.activeCountInScope / total) * 100);
  }

  get expiredSharePercent(): number {
    const total = this.scopedPromotions.length;
    if (!total) {
      return 0;
    }

    const expired = this.scopedPromotions.filter((promo) => promo.status === 'EXPIRED').length;
    return Math.round((expired / total) * 100);
  }

  get usageViewRatioPercent(): number {
    const totalViews = this.scopedPromotions.reduce((sum, promo) => sum + promo.views, 0);
    if (!totalViews) {
      return 0;
    }

    const totalUsage = this.scopedPromotions.reduce((sum, promo) => sum + promo.usageCount, 0);
    return Math.min(100, Math.round((totalUsage / totalViews) * 100));
  }

  get promotionHealthScore(): number {
    if (!this.scopedPromotions.length) {
      return 0;
    }

    const active = this.activeSharePercent * 0.5;
    const freshness = (100 - this.expiredSharePercent) * 0.3;
    const engagement = this.usageViewRatioPercent * 0.2;
    return Math.round(active + freshness + engagement);
  }

  get topCategoryLabel(): string {
    return this.categoryChartItems[0]?.label ?? '';
  }

  statusItemPercent(value: number): number {
    const total = this.scopedPromotions.length;
    if (!total) {
      return 0;
    }

    return Math.round((value / total) * 100);
  }

  get statusDonutStyle(): string {
    const source = this.scopedPromotions;
    const total = source.length || 1;
    const active = (source.filter((item) => item.status === 'ACTIVE').length / total) * 100;
    const draft = (source.filter((item) => item.status === 'DRAFT').length / total) * 100;
    const scheduled = (source.filter((item) => item.status === 'SCHEDULED').length / total) * 100;

    const p1 = active;
    const p2 = p1 + draft;
    const p3 = p2 + scheduled;

    return `conic-gradient(#1f9aa2 0 ${p1}%, #0f3e63 ${p1}% ${p2}%, #eb8b67 ${p2}% ${p3}%, #c7c9cf ${p3}% 100%)`;
  }

  get offerTypeDonutStyle(): string {
    const total = this.offerTypeSplit.reduce((sum, item) => sum + item.value, 0);
    if (!total) {
      return 'conic-gradient(#e2e8f0 0 100%)';
    }

    let current = 0;
    const slices = this.offerTypeSplit.map((item) => {
      const start = current;
      const end = current + (item.value / total) * 100;
      current = end;
      return `${item.color} ${start}% ${end}%`;
    });

    return `conic-gradient(${slices.join(', ')})`;
  }

  get scopedPromotions(): PromoItem[] {
    return this.filteredPromotions;
  }

  get filteredPromotions(): PromoItem[] {
    const now = new Date();
    const periodDays = Number(this.periodFilter);

    return this.promotions.filter((promo) => {
      const textMatch =
        !this.searchTerm ||
        promo.title.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        promo.discount.toLowerCase().includes(this.searchTerm.toLowerCase());

      const statusMatch = this.statusFilter === 'ALL' || promo.status === this.statusFilter;
      const typeMatch = this.typeFilter === 'ALL' || promo.type === this.typeFilter;
      const categoryMatch = this.categoryFilter === 'ALL' || promo.category === this.categoryFilter;

      const start = new Date(promo.startDate);
      const withinPeriod = !periodDays || (now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24) <= periodDays;

      return textMatch && statusMatch && typeMatch && categoryMatch && withinPeriod;
    });
  }

  get publishedPromotions(): PromoItem[] {
    return this.promotions.filter((promo) => promo.status === 'ACTIVE' || promo.status === 'EXPIRED');
  }

  get curatedPromotions(): PromoItem[] {
    const query = this.readonlySearch.trim().toLowerCase();
    const filteredBySearch = this.publishedPromotions.filter((promo) => {
      const company = this.companyLabelFor(promo).toLowerCase();
      const searchMatches = !query
        || company.includes(query)
        || promo.title.toLowerCase().includes(query)
        || promo.category.toLowerCase().includes(query);

      if (!searchMatches) {
        return false;
      }

      if (this.selectedReadCategory === 'ALL') {
        return true;
      }

      return this.normalizeText(promo.category) === this.normalizeText(this.selectedReadCategory);
    });

    return filteredBySearch;
  }

  setReadCategory(key: string): void {
    this.selectedReadCategory = key;
  }

  isReadCategoryActive(key: string): boolean {
    return this.selectedReadCategory === key;
  }

  companyLabelFor(promo: PromoItem): string {
    return this.slugToLabel(promo.companySlug);
  }

  statusLabel(status: PromoStatus): string {
    switch (status) {
      case 'ACTIVE':
        return this.t('PROMOS.STATUS_ACTIVE');
      case 'DRAFT':
        return this.t('PROMOS.STATUS_DRAFT');
      case 'SCHEDULED':
        return this.t('PROMOS.STATUS_SCHEDULED');
      case 'EXPIRED':
        return this.t('PROMOS.STATUS_EXPIRED');
      default:
        return status;
    }
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

  couponActionLabel(promo: PromoItem): string {
    return this.copiedCouponPromoId === promo.id
      ? this.t('PROMOS.COUPON_COPIED')
      : this.t('PROMOS.GET_COUPON');
  }

  statusClass(status: PromoStatus): string {
    switch (status) {
      case 'ACTIVE':
        return 'st-active';
      case 'DRAFT':
        return 'st-draft';
      case 'SCHEDULED':
        return 'st-scheduled';
      case 'EXPIRED':
        return 'st-expired';
      default:
        return '';
    }
  }

  typeLabel(type: PromoType): string {
    switch (type) {
      case 'PERCENT':
        return '%';
      case 'FIXED':
        return this.t('PROMOS.MANAGEMENT.TYPE_AMOUNT_SHORT');
      case 'BOGO':
        return '1+1';
      default:
        return type;
    }
  }

  promoDetailsLink(promo: PromoItem): string {
    return `/entreprises/${promo.companySlug}/consulter-promos`;
  }

  onPromoDetailsClick(promo: PromoItem): void {
    const companySlug = (promo.companySlug ?? '').trim();
    if (!companySlug || !promo.id) {
      return;
    }

    this.promotionService.incrementPromotionViews(companySlug, promo.id).subscribe({
      next: () => {
        promo.views = (promo.views ?? 0) + 1;
      },
      error: () => {
        // Tracking failure should not block navigation.
      }
    });
  }

  promoImage(promo: PromoItem): string | null {
    const slug = promo.companySlug.toLowerCase();
    if (slug.includes('aziza')) {
      return 'partners/azizapromos.jpg';
    }
    if (slug.includes('fatales')) {
      return 'partners/fatales.jpg';
    }
    if (slug.includes('monoprix')) {
      return 'partners/monoprix-food.jpg';
    }
    if (slug.includes('zara')) {
      return 'partners/zara.jpg';
    }
    if (slug.includes('decathlon')) {
      return 'partners/decathlon.png';
    }

    return null;
  }

  useContainImage(_promo: PromoItem): boolean {
    return false;
  }

  isAzizaPromo(promo: PromoItem): boolean {
    return promo.companySlug.toLowerCase().includes('aziza');
  }

  isMonoprixPromo(promo: PromoItem): boolean {
    return promo.companySlug.toLowerCase().includes('monoprix');
  }

  promoBadge(promo: PromoItem): string {
    if (promo.discount?.trim()) {
      return promo.discount;
    }
    if (promo.couponCode?.trim()) {
      return this.t('PROMOS.COUPON_AVAILABLE');
    }
    return this.t('PROMOS.EXCLUSIVE_OFFER');
  }

  displayDateRange(promo: PromoItem): string {
    return this.t('PROMOS.VALID_RANGE', {
      start: this.formatDateFr(promo.startDate),
      end: this.formatDateFr(promo.endDate)
    });
  }

  openCreateForm(): void {
    if (!this.companySlug) {
      this.router.navigate(['/dashboard']);
      return;
    }

    this.router.navigate([`/entreprises/${this.companySlug}/ajouter-promo`]);
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/']);
  }

  openSubscriptionPage(): void {
    this.router.navigate(['/admin/subscribe/overview'], {
      queryParams: {
        companyName: this.companyName,
        email: this.subscriptionSnapshot?.email || this.authService.getStoredEmail() || '',
        redirectTo: '/dashboard'
      }
    });
  }

  openInvoicePage(): void {
    if (!this.subscriptionSnapshot) {
      this.openSubscriptionPage();
      return;
    }

    this.router.navigate(['/admin/subscribe/invoice'], {
      queryParams: {
        companyName: this.subscriptionSnapshot.companyName || this.companyName,
        email: this.subscriptionSnapshot.email || this.authService.getStoredEmail() || '',
        redirectTo: '/dashboard',
        plan: this.subscriptionSnapshot.plan,
        billingCycle: this.subscriptionSnapshot.billingCycle,
        amount: this.subscriptionSnapshot.amount,
        issuedAt: this.subscriptionSnapshot.issuedAt
      }
    });
  }

  applyFilters(): void {
    // Keep the filter button actionable and normalize manual input.
    this.searchTerm = this.searchTerm.trim();
  }

  editFirstPromotion(): void {
    const promo = this.filteredPromotions[0];
    if (!promo) {
      return;
    }

    this.editPromotion(promo);
  }

  duplicateFirstPromotion(): void {
    const promo = this.filteredPromotions[0];
    if (!promo) {
      return;
    }

    this.duplicatePromotion(promo);
  }

  toggleFirstPromotion(): void {
    const promo = this.filteredPromotions[0];
    if (!promo) {
      return;
    }

    this.togglePromotion(promo);
  }

  editPromotion(promo: PromoItem): void {
    this.router.navigate([`/entreprises/${this.companySlug}/ajouter-promo`], {
      queryParams: { fromPromotion: promo.id }
    });
  }

  duplicatePromotion(promo: PromoItem): void {
    const payload: PromotionPayload = {
      title: `${promo.title} (Copie)`,
      type: promo.type,
      category: promo.category,
      discount: promo.discount,
      couponCode: promo.couponCode ?? undefined,
      startDate: promo.startDate,
      endDate: promo.endDate,
      status: 'DRAFT',
      usageCount: 0,
      views: 0,
      claimedCount: 0
    };

    this.promotionService.createPromotion(this.companySlug, payload).subscribe({
      next: () => this.loadPromotions(),
      error: () => (this.errorMessage = "Impossible de dupliquer la promotion.")
    });
  }

  togglePromotion(promo: PromoItem): void {
    if (this.readOnlyMode) {
      return;
    }

    const payload: PromotionPayload = {
      title: promo.title,
      type: promo.type,
      category: promo.category,
      discount: promo.discount,
      couponCode: promo.couponCode ?? undefined,
      startDate: promo.startDate,
      endDate: promo.endDate,
      status: promo.status === 'ACTIVE' ? 'EXPIRED' : 'ACTIVE',
      usageCount: promo.usageCount,
      views: promo.views,
      claimedCount: promo.claimedCount ?? 0
    };

    this.promotionService.updatePromotion(this.companySlug, promo.id, payload).subscribe({
      next: () => this.loadPromotions(),
      error: () => (this.errorMessage = 'Impossible de changer le statut de la promotion.')
    });
  }

  deletePromotion(promo: PromoItem): void {
    if (this.readOnlyMode) {
      return;
    }

    this.promotionService.deletePromotion(this.companySlug, promo.id).subscribe({
      next: () => this.loadPromotions(),
      error: () => (this.errorMessage = 'Impossible de supprimer la promotion.')
    });
  }

  get choiceLink(): string {
    return '/';
  }

  get choiceQueryParams(): { company: string } | undefined {
    return undefined;
  }

  get isAuthenticated(): boolean {
    return this.authService.isAuthenticated();
  }

  get isUserAuthenticated(): boolean {
    return this.isAuthenticated && !this.authService.isAdminAuthenticated();
  }

  handleCouponAction(promo: PromoItem): void {
    const code = (promo.couponCode ?? '').trim();
    if (!code) {
      return;
    }

    if (this.isUserAuthenticated) {
      this.copyCoupon(promo);
      this.consumeCouponUsage(promo);
      return;
    }

    const companyLabel = this.resolveCompanyLabelForAuth(promo);
    this.router.navigate(['/espace'], {
      queryParams: {
        redirectTo: this.router.url,
        company: companyLabel || undefined
      }
    });
  }

  copyCoupon(promo: PromoItem): void {
    const code = (promo.couponCode ?? '').trim();
    if (!code) {
      return;
    }

    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(code).then(() => this.markCouponAsCopied(promo.id));
      return;
    }

    this.markCouponAsCopied(promo.id);
  }

  get smartAlerts(): { type: 'warning' | 'danger'; message: string }[] {
    const alerts: { type: 'warning' | 'danger'; message: string }[] = [];
    const now = new Date();

    for (const promo of this.promotions) {
      if (promo.status !== 'ACTIVE') continue;

      const end = new Date(promo.endDate);
      const daysLeft = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      if (daysLeft >= 0 && daysLeft <= 3) {
        alerts.push({
          type: 'warning',
          message: `"${promo.title}" expire dans ${daysLeft} jour${daysLeft !== 1 ? 's' : ''}`
        });
      }

      const conversionRate = promo.views > 5 ? (promo.usageCount / promo.views) * 100 : -1;
      if (conversionRate >= 0 && conversionRate < 10) {
        alerts.push({
          type: 'danger',
          message: `Faible conversion sur "${promo.title}" (${Math.round(conversionRate)}%)`
        });
      }
    }

    return alerts.slice(0, 4);
  }

  get promoBarItems(): { label: string; value: number; percent: number; color: string }[] {
    const palette = ['#6366f1', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444'];
    const sorted = [...this.promotions]
      .sort((a, b) => b.usageCount - a.usageCount)
      .slice(0, 5);
    const maxVal = Math.max(...sorted.map((p) => p.usageCount), 1);
    return sorted.map((p, i) => ({
      label: p.title.length > 22 ? p.title.slice(0, 20) + '…' : p.title,
      value: p.usageCount,
      percent: Math.round((p.usageCount / maxVal) * 100),
      color: palette[i % palette.length]
    }));
  }

  get conversionFunnel(): { label: string; value: number; percent: number; color: string }[] {
    const totalViews = this.promotions.reduce((s, p) => s + p.views, 0);
    const estimatedClics = Math.round(totalViews * 0.35);
    const totalUsage = this.totalUsage;
    const maxVal = totalViews || 1;
    return [
      { label: 'Vues', value: totalViews, percent: 100, color: '#6366f1' },
      { label: 'Clics estimés', value: estimatedClics, percent: Math.round((estimatedClics / maxVal) * 100), color: '#0ea5e9' },
      { label: 'Coupons utilisés', value: totalUsage, percent: Math.round((totalUsage / maxVal) * 100), color: '#10b981' }
    ];
  }

  get lineChartData(): { label: string; coupons: number }[] {
    const days = 7;
    const avgCoupons = this.totalUsage / Math.max(days, 1);
    const today = new Date();
    return Array.from({ length: days }, (_, i) => {
      const d = new Date(today);
      d.setDate(d.getDate() - (days - 1 - i));
      const label = d.toLocaleDateString('fr-FR', { weekday: 'short' });
      const factor = 0.55 + 0.5 * Math.sin(i * 0.95 + 1.2);
      return { label, coupons: Math.max(0, Math.round(avgCoupons * factor)) };
    });
  }

  get lineChartSvgPath(): string {
    const data = this.lineChartData;
    if (!data.length) return '';
    const W = 540, H = 90, padX = 6, padY = 8;
    const maxY = Math.max(...data.map((d) => d.coupons), 1);
    const pts = data.map((d, i) => ({
      x: padX + (i / (data.length - 1)) * (W - padX * 2),
      y: padY + (1 - d.coupons / maxY) * (H - padY * 2)
    }));
    return pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  }

  get lineChartAreaPath(): string {
    const data = this.lineChartData;
    if (!data.length) return '';
    const W = 540, H = 90, padX = 6, padY = 8;
    const maxY = Math.max(...data.map((d) => d.coupons), 1);
    const pts = data.map((d, i) => ({
      x: padX + (i / (data.length - 1)) * (W - padX * 2),
      y: padY + (1 - d.coupons / maxY) * (H - padY * 2)
    }));
    const line = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
    const last = pts[pts.length - 1];
    const first = pts[0];
    return `${line} L${last.x.toFixed(1)},${(H - padY).toFixed(1)} L${first.x.toFixed(1)},${(H - padY).toFixed(1)} Z`;
  }

  get lineChartDots(): { x: number; y: number; value: number }[] {
    const data = this.lineChartData;
    if (!data.length) return [];
    const W = 540, H = 90, padX = 6, padY = 8;
    const maxY = Math.max(...data.map((d) => d.coupons), 1);
    return data.map((d, i) => ({
      x: padX + (i / (data.length - 1)) * (W - padX * 2),
      y: padY + (1 - d.coupons / maxY) * (H - padY * 2),
      value: d.coupons
    }));
  }

  promoHealthScore(promo: PromoItem): number {
    const views = promo.views || 1;
    const convRate = (promo.usageCount / views) * 100;
    const usageScore = Math.min(100, Math.round((promo.usageCount / Math.max(this.totalUsage * 0.4, 1)) * 100));
    const convScore = Math.min(100, Math.round(convRate * 2.5));
    return Math.round(usageScore * 0.6 + convScore * 0.4);
  }

  promoScoreBadge(promo: PromoItem): { badge: string; score: number; cls: string } {
    const score = this.promoHealthScore(promo);
    if (score >= 70) return { badge: this.t('PROMOS.MANAGEMENT.SCORE_EXCELLENT'), score, cls: 'score-excellent' };
    if (score >= 40) return { badge: this.t('PROMOS.MANAGEMENT.SCORE_MEDIUM'), score, cls: 'score-moyen' };
    return { badge: this.t('PROMOS.MANAGEMENT.SCORE_LOW'), score, cls: 'score-faible' };
  }

  promoConversionRate(promo: PromoItem): number {
    if (!promo.views) return 0;
    return Math.round((promo.usageCount / promo.views) * 1000) / 10;
  }

  promoPriority(promo: PromoItem): { label: string; cls: string } {
    const score = this.promoHealthScore(promo);
    if (score >= 70) return { label: this.t('PROMOS.MANAGEMENT.PRIORITY_HIGH'), cls: 'pri-high' };
    if (score >= 40) return { label: this.t('PROMOS.MANAGEMENT.PRIORITY_MEDIUM'), cls: 'pri-medium' };
    return { label: this.t('PROMOS.MANAGEMENT.PRIORITY_LOW'), cls: 'pri-low' };
  }

  get totalViews(): number {
    return this.promotions.reduce((s, p) => s + p.views, 0);
  }

  get globalConversionRate(): number {
    const views = this.totalViews;
    if (!views) return 0;
    return Math.round((this.totalUsage / views) * 1000) / 10;
  }

  get riskyPromoCount(): number {
    const now = Date.now();
    return this.promotions.filter((p) => {
      if (p.status !== 'ACTIVE') return false;
      const daysLeft = Math.ceil((new Date(p.endDate).getTime() - now) / 864e5);
      const rate = p.views > 5 ? (p.usageCount / p.views) * 100 : 100;
      return (daysLeft >= 0 && daysLeft <= 3) || rate < 15;
    }).length;
  }

  get bestPromo(): PromoItem | null {
    const active = this.promotions.filter((p) => p.status === 'ACTIVE');
    if (!active.length) return null;
    return active.reduce((best, p) => p.usageCount > best.usageCount ? p : best);
  }

  get worstActivePromo(): PromoItem | null {
    const active = this.promotions.filter((p) => p.status === 'ACTIVE' && p.views > 0);
    if (active.length < 2) return null;
    return active.reduce((worst, p) => {
      const rp = p.usageCount / p.views;
      const rw = worst.usageCount / worst.views;
      return rp < rw ? p : worst;
    });
  }

  get insights(): { icon: string; iconCls: string; title: string; desc: string; action: string; actionCls: string }[] {
    const result: { icon: string; iconCls: string; title: string; desc: string; action: string; actionCls: string }[] = [];
    const now = Date.now();
    for (const promo of this.promotions) {
      if (promo.status !== 'ACTIVE') continue;
      const rate = promo.views > 0 ? Math.round((promo.usageCount / promo.views) * 100) : 0;
      const daysLeft = Math.ceil((new Date(promo.endDate).getTime() - now) / 864e5);
      if (rate >= 50) {
        result.push({ icon: '🏆', iconCls: 'ins-green', title: promo.title, desc: `Excellente performance ! Taux de conversion eleve (${rate}%)`, action: 'Booster', actionCls: 'ins-btn-green' });
      } else if (daysLeft >= 0 && daysLeft <= 3) {
        result.push({ icon: '⏰', iconCls: 'ins-orange', title: promo.title, desc: `Expire dans ${daysLeft} jour${daysLeft !== 1 ? 's' : ''}. Prolongez pour maintenir les performances`, action: 'Prolonger', actionCls: 'ins-btn-orange' });
      } else if (promo.views > 5 && rate < 20) {
        result.push({ icon: '📉', iconCls: 'ins-red', title: promo.title, desc: `Performance en baisse. Taux de conversion faible (${rate}%)`, action: 'Optimiser', actionCls: 'ins-btn-red' });
      }
    }
    return result.slice(0, 3);
  }

  get currentDateRangeDisplay(): string {
    const now = new Date();
    const days = Number(this.periodFilter) || 30;
    const start = new Date(now);
    start.setDate(start.getDate() - days);
    const locale = this.translations.currentLanguage() === 'en' ? 'en-US' : 'fr-FR';
    const fmt = (d: Date) => d.toLocaleDateString(locale, { day: '2-digit', month: 'short', year: 'numeric' });
    return `${fmt(start)} – ${fmt(now)}`;
  }

  get lineChartFullData(): { label: string; coupons: number; views: number }[] {
    const days = 30;
    const today = new Date();
    const tc = Math.max(this.totalUsage, 1);
    const tv = Math.max(this.totalViews, tc * 4);
    return Array.from({ length: days }, (_, i) => {
      const d = new Date(today);
      d.setDate(d.getDate() - (days - 1 - i));
      const showLabel = [0, 4, 9, 14, 19, 24, 29].includes(i);
      const label = showLabel ? d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }).replace('.', '') : '';
      const fc = Math.abs(Math.sin(i * 0.32 + 1.1)) * 0.7 + 0.3;
      const fv = Math.abs(Math.sin(i * 0.27 + 0.6)) * 0.6 + 0.4;
      return {
        label,
        coupons: Math.round(tc / days * fc * 4),
        views: Math.round(tv / days * fv * 5)
      };
    });
  }

  get svgChartPaths(): { couponLine: string; couponArea: string; viewsLine: string; viewsArea: string } {
    const data = this.lineChartFullData;
    const W = 640, H = 160, padX = 4, padY = 12;
    const allVals = [...data.map((d) => d.coupons), ...data.map((d) => d.views)];
    const maxY = Math.max(...allVals, 1);
    const xOf = (i: number) => padX + (i / (data.length - 1)) * (W - padX * 2);
    const yOf = (v: number) => padY + (1 - v / maxY) * (H - padY * 2);
    const toLine = (vals: number[]) => vals.map((v, i) => `${i === 0 ? 'M' : 'L'}${xOf(i).toFixed(1)},${yOf(v).toFixed(1)}`).join(' ');
    const toArea = (vals: number[]) => `${toLine(vals)} L${xOf(vals.length - 1).toFixed(1)},${H} L${padX},${H} Z`;
    return {
      couponLine: toLine(data.map((d) => d.coupons)),
      couponArea: toArea(data.map((d) => d.coupons)),
      viewsLine: toLine(data.map((d) => d.views)),
      viewsArea: toArea(data.map((d) => d.views))
    };
  }

  get chartXLabels(): { x: number; label: string }[] {
    const data = this.lineChartFullData;
    const W = 640, padX = 4;
    return data
      .map((d, i) => ({ x: padX + (i / (data.length - 1)) * (W - padX * 2), label: d.label }))
      .filter((item) => item.label);
  }

  get radarChartOptions(): {
    series: ApexAxisChartSeries;
    chart: ApexChart;
    stroke: ApexStroke;
    fill: ApexFill;
    markers: ApexMarkers;
    yaxis: ApexYAxis;
    xaxis: ApexXAxis;
    colors: string[];
    legend: ApexLegend;
  } {
    const cats = ['Mode', 'Beaute', 'Maison', 'Sport', 'Alimentaire', 'Quotidien'];

    const statsPerCat = cats.map((cat) => {
      const promos = this.promotions.filter((p) => (p.category ?? '').trim() === cat);
      const views = promos.reduce((s, p) => s + (p.views ?? 0), 0);
      const usage = promos.reduce((s, p) => s + (p.usageCount ?? 0), 0);
      const conversion = views > 0 ? Math.round((usage / views) * 100) : 0;
      return { views, usage, conversion };
    });

    const maxViews = Math.max(...statsPerCat.map((s) => s.views), 1);
    const maxUsage = Math.max(...statsPerCat.map((s) => s.usage), 1);

    return {
      series: [
        { name: 'Conversion %', data: statsPerCat.map((s) => s.conversion) },
        { name: 'Vues', data: statsPerCat.map((s) => Math.round((s.views / maxViews) * 100)) },
        { name: 'Coupons utilises', data: statsPerCat.map((s) => Math.round((s.usage / maxUsage) * 100)) }
      ],
      chart: {
        height: 340,
        type: 'radar',
        dropShadow: { enabled: true, blur: 1, left: 1, top: 1 },
        toolbar: { show: false }
      },
      stroke: { width: 2 },
      fill: { opacity: 0.1 },
      markers: { size: 0 },
      yaxis: { stepSize: 20 },
      xaxis: { categories: cats },
      colors: ['#6366f1', '#0ea5e9', '#10b981'],
      legend: { show: true, position: 'bottom' }
    };
  }

  get chartYLabels(): { pct: number; label: string }[] {
    const data = this.lineChartFullData;
    const maxY = Math.max(...data.map((d) => d.views), ...data.map((d) => d.coupons), 1);
    return [1, 0.75, 0.5, 0.25, 0].map((pct) => {
      const val = Math.round(maxY * pct);
      const label = val >= 1000 ? `${(val / 1000).toFixed(val % 500 === 0 ? 0 : 1)}K` : `${val}`;
      return { pct: (1 - pct) * 100, label };
    });
  }

  private loadPromotions(): void {
    if (!this.companySlug) {
      if (!this.allCompaniesMode) {
        this.promotions = [];
        return;
      }
    }

    this.loading = true;
    this.errorMessage = '';

    if (this.allCompaniesMode) {
      this.promotionService.listAllPublishedPromotions().subscribe({
        next: (items) => {
          this.loading = false;
          this.promotions = items;
          this.copiedCouponPromoId = null;
        },
        error: () => {
          this.loading = false;
          this.promotions = [];
          this.errorMessage = 'Impossible de charger les promotions publiees.';
        }
      });
      return;
    }

    const request$ = this.readOnlyMode
      ? this.promotionService.listPublishedPromotions(this.companySlug)
      : this.promotionService.listCompanyPromotions(this.companySlug);

    request$.subscribe({
      next: (items) => {
        this.loading = false;
        this.promotions = items;
        this.copiedCouponPromoId = null;
      },
      error: () => {
        this.loading = false;
        this.promotions = [];
        this.errorMessage = this.readOnlyMode
          ? 'Impossible de charger les promotions publiees.'
          : 'Impossible de charger les promotions de gestion.';
      }
    });
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

  private markCouponAsCopied(promoId: number): void {
    this.copiedCouponPromoId = promoId;
    setTimeout(() => {
      if (this.copiedCouponPromoId === promoId) {
        this.copiedCouponPromoId = null;
      }
    }, 1800);
  }

  private resolveCompanyLabelForAuth(promo: PromoItem): string {
    if (this.allCompaniesMode) {
      return this.slugToLabel(promo.companySlug);
    }

    return this.companyName;
  }

  private formatDateFr(rawDate: string): string {
    const [y, m, d] = rawDate.split('-').map(Number);
    if (!y || !m || !d) {
      return rawDate;
    }

    const dt = new Date(y, m - 1, d);
    const locale = this.translations.currentLanguage() === 'en' ? 'en-US' : 'fr-FR';
    return new Intl.DateTimeFormat(locale, {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    }).format(dt);
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

  private consumeCouponUsage(promo: PromoItem): void {
    if (this.claimedCouponIds.has(promo.id)) {
      return;
    }

    this.claimedCouponIds.add(promo.id);

    const companySlug = promo.companySlug || this.companySlug;
    if (!companySlug) {
      this.claimedCouponIds.delete(promo.id);
      return;
    }

    this.promotionService.claimCoupon(companySlug, promo.id).subscribe({
      next: () => this.loadPromotions(),
      error: (error: HttpErrorResponse) => {
        this.claimedCouponIds.delete(promo.id);
        if (error.status === 401 || error.status === 403) {
          this.authService.logout();
          this.errorMessage = 'Session expiree. Reconnectez-vous pour recuperer le coupon.';
          this.router.navigate(['/espace'], {
            queryParams: { redirectTo: this.router.url }
          });
          return;
        }

        const backendMessage = typeof error.error?.error === 'string'
          ? error.error.error
          : '';

        this.errorMessage = backendMessage || 'Impossible de mettre a jour le stock du coupon.';
      }
    });
  }

  private readSubscriptionSnapshot(): SubscriptionSnapshot | null {
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

      return {
        companyName: parsed.companyName,
        email: parsed.email ?? '',
        plan: parsed.plan,
        billingCycle: parsed.billingCycle,
        amount: Number(parsed.amount) || 0,
        issuedAt: parsed.issuedAt ?? '',
        redirectTo: parsed.redirectTo ?? `/entreprises/${this.companySlug || 'entreprise'}`
      };
    } catch {
      return null;
    }
  }
}

