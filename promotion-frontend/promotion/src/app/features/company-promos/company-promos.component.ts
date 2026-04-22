import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { PromoStatus, PromoType, PromotionDto, PromotionPayload } from '../../core/models/promo.model';
import { AuthService } from '../../core/services/auth.service';
import { PromotionService } from '../../core/services/promotion.service';

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
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './company-promos.component.html',
  styleUrl: './company-promos.component.css'
})
export class CompanyPromosComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);
  private readonly promotionService = inject(PromotionService);

  companyName = 'Entreprise';
  companySlug = '';
  allCompaniesMode = false;
  promotions: PromoItem[] = [];
  readOnlyMode = false;
  loading = false;
  errorMessage = '';
  copiedCouponPromoId: number | null = null;
  private readonly claimedCouponIds = new Set<number>();
  subscriptionSnapshot: SubscriptionSnapshot | null = null;
  readonlySearch = '';
  selectedReadCategory = 'Toutes';

  readonly readCategories: Array<{ label: string; key: string; icon: string }> = [
    { label: 'Toutes', key: 'ALL', icon: '' },
    { label: 'Beaute', key: 'Beaute', icon: '💄' },
    { label: 'Alimentaire', key: 'Alimentaire', icon: '🛒' },
    { label: 'Maison', key: 'Maison', icon: '🏠' },
    { label: 'Sport', key: 'Sport', icon: '🏃' },
    { label: 'Mode', key: 'Mode', icon: '👕' }
  ];

  searchTerm = '';
  periodFilter = '30';
  statusFilter: PromoStatus | 'ALL' = 'ALL';
  typeFilter: PromoType | 'ALL' = 'ALL';
  categoryFilter = 'ALL';

  readonly statusOptions: Array<{ value: PromoStatus | 'ALL'; label: string }> = [
    { value: 'ALL', label: 'Tous les statuts' },
    { value: 'ACTIVE', label: 'Active' },
    { value: 'DRAFT', label: 'Brouillon' },
    { value: 'SCHEDULED', label: 'Planifiee' },
    { value: 'EXPIRED', label: 'Expiree' }
  ];

  readonly typeOptions: Array<{ value: PromoType | 'ALL'; label: string }> = [
    { value: 'ALL', label: 'Tous les types' },
    { value: 'PERCENT', label: 'Pourcentage' },
    { value: 'FIXED', label: 'Montant fixe' },
    { value: 'BOGO', label: '1 achete = 1 offert' }
  ];

  readonly categories = ['ALL', 'Mode', 'Beaute', 'Maison', 'Sport', 'Alimentaire', 'Quotidien'];

  constructor() {
    const currentPath = this.route.snapshot.routeConfig?.path ?? '';
    const slug = (this.route.snapshot.paramMap.get('slug') ?? '').toLowerCase();
    this.companySlug = slug;
    this.allCompaniesMode = currentPath === 'promos/consulter-toutes';
    this.companyName = this.allCompaniesMode ? 'Toutes les entreprises' : this.slugToLabel(slug);
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
      return 'Annuel';
    }
    if (cycle === 'MONTHLY') {
      return 'Mensuel';
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

      if (this.selectedReadCategory === 'Toutes') {
        return true;
      }

      return this.normalizeText(promo.category) === this.normalizeText(this.selectedReadCategory);
    });

    return filteredBySearch;
  }

  setReadCategory(label: string): void {
    this.selectedReadCategory = label;
  }

  isReadCategoryActive(label: string): boolean {
    return this.selectedReadCategory === label;
  }

  companyLabelFor(promo: PromoItem): string {
    return this.slugToLabel(promo.companySlug);
  }

  statusLabel(status: PromoStatus): string {
    switch (status) {
      case 'ACTIVE':
        return 'Active';
      case 'DRAFT':
        return 'Brouillon';
      case 'SCHEDULED':
        return 'Planifiee';
      case 'EXPIRED':
        return 'Expiree';
      default:
        return status;
    }
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
        return 'Montant';
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

  useContainImage(promo: PromoItem): boolean {
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
      return 'Coupon disponible';
    }
    return 'Offre exclusive';
  }

  displayDateRange(promo: PromoItem): string {
    return `Valide du ${this.formatDateFr(promo.startDate)} au ${this.formatDateFr(promo.endDate)}`;
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
        redirectTo: `/entreprises/${this.companySlug || 'entreprise'}`
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
        redirectTo: this.subscriptionSnapshot.redirectTo || `/entreprises/${this.companySlug || 'entreprise'}`,
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
    return new Intl.DateTimeFormat('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    }).format(dt);
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
