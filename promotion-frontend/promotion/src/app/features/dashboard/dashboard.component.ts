import { CommonModule, DecimalPipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import {
  AfterViewInit,
  ChangeDetectorRef,
  Component,
  ElementRef,
  NgZone,
  OnDestroy,
  OnInit,
  PLATFORM_ID,
  ViewChild,
  effect,
  inject
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  ArcElement,
  BarController,
  BarElement,
  CategoryScale,
  Chart,
  DoughnutController,
  Legend,
  LinearScale,
  LineController,
  LineElement,
  PointElement,
  Tooltip
} from 'chart.js';

import { AuthService } from '../../core/services/auth.service';
import { PromotionService } from '../../core/services/promotion.service';
import { TranslationService } from '../../core/i18n/translation.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { LanguageSwitcherComponent } from '../../shared/language-switcher/language-switcher.component';
import {
  CompanyAdminDashboardResponse,
  CompanyCouponResponse,
  CompanyCouponStatus,
  CompanyChartPointResponse,
  CompanyDashboardPeriod
} from '../../core/models/promo.model';

type KpiCard = {
  label: string;
  value: string;
  hint: string;
  tone: 'blue' | 'green' | 'orange' | 'violet' | 'red' | 'slate';
};

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

Chart.register(
  ArcElement,
  BarController,
  BarElement,
  CategoryScale,
  DoughnutController,
  Legend,
  LinearScale,
  LineController,
  LineElement,
  PointElement,
  Tooltip
);

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink, DecimalPipe, TranslatePipe, LanguageSwitcherComponent],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css'
})
export class DashboardComponent implements OnInit, AfterViewInit, OnDestroy {
  private readonly authService = inject(AuthService);
  private readonly promotionService = inject(PromotionService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly ngZone = inject(NgZone);
  private readonly translations = inject(TranslationService);
  private readonly isBrowser = isPlatformBrowser(this.platformId);

  @ViewChild('viewsChart') viewsChart?: ElementRef<HTMLCanvasElement>;
  @ViewChild('couponsChart') couponsChart?: ElementRef<HTMLCanvasElement>;
  @ViewChild('statusChart') statusChart?: ElementRef<HTMLCanvasElement>;
  @ViewChild('topViewsChart') topViewsChart?: ElementRef<HTMLCanvasElement>;
  @ViewChild('topCouponsChart') topCouponsChart?: ElementRef<HTMLCanvasElement>;
  @ViewChild('viewsVsCouponsChart') viewsVsCouponsChart?: ElementRef<HTMLCanvasElement>;
  @ViewChild('activePerformanceChart') activePerformanceChart?: ElementRef<HTMLCanvasElement>;
  @ViewChild('creationsChart') creationsChart?: ElementRef<HTMLCanvasElement>;
  @ViewChild('couponSplitChart') couponSplitChart?: ElementRef<HTMLCanvasElement>;

  readonly periodOptions: { value: CompanyDashboardPeriod; labelKey: string }[] = [
    { value: '7d', labelKey: 'DASHBOARD.PERIOD_7D' },
    { value: '30d', labelKey: 'DASHBOARD.PERIOD_30D' },
    { value: '12m', labelKey: 'DASHBOARD.PERIOD_12M' }
  ];

  selectedPeriod: CompanyDashboardPeriod = '12m';
  dashboard: CompanyAdminDashboardResponse | null = null;
  email = this.authService.getStoredEmail() ?? '';
  role = (this.authService.getStoredRole() ?? '').toUpperCase();
  loadingUser = false;
  loadingDashboard = false;
  loadingCoupons = false;
  dashboardError = '';
  couponsError = '';
  coupons: CompanyCouponResponse[] = [];
  selectedCompanySlug = '';
  connectedCompanySlug = '';
  connectedCompanyName = '';
  companiesError = '';

  private viewReady = false;
  private charts: Chart[] = [];
  private renderHandle: number | null = null;

  constructor() {
    effect(() => {
      this.translations.currentLanguage();
      this.cdr.markForCheck();
      this.scheduleRenderCharts();
    });
  }

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

        if (this.isClientSpace) {
          this.router.navigate([this.allPromosLink]);
          return;
        }

        this.loadDashboard();
        this.loadCoupons();
      },
      error: () => {
        this.loadingUser = false;
        this.logout();
      }
    });
  }

  ngAfterViewInit(): void {
    this.viewReady = true;
    this.scheduleRenderCharts();
  }

  ngOnDestroy(): void {
    if (this.renderHandle !== null && this.isBrowser) {
      cancelAnimationFrame(this.renderHandle);
    }
    this.destroyCharts();
  }

  get isClientSpace(): boolean {
    return this.role === 'CLIENT';
  }

  get periodLabel(): string {
    const labelKey = this.periodOptions.find((option) => option.value === this.selectedPeriod)?.labelKey
      ?? 'DASHBOARD.PERIOD_12M';
    return this.t(labelKey);
  }

  get allPromosLink(): string {
    return '/promos/consulter-toutes';
  }

  get addPromoLink(): string {
    const slug = this.companySlugForActions;
    return slug ? `/entreprises/${slug}/ajouter-promo` : '/dashboard';
  }

  get managePromosLink(): string {
    const slug = this.companySlugForActions;
    return slug ? `/entreprises/${slug}` : '/';
  }

  get subscriptionQueryParams(): Record<string, string> {
    return {
      companyName: this.dashboard?.companyName || this.connectedCompanyName || 'Societe',
      email: this.email,
      redirectTo: '/dashboard'
    };
  }

  get invoiceLink(): string {
    return this.getSubscriptionSnapshot() ? '/admin/subscribe/invoice' : '/admin/subscribe/overview';
  }

  get invoiceQueryParams(): Record<string, string | number> {
    const snapshot = this.getSubscriptionSnapshot();

    if (!snapshot) {
      return this.subscriptionQueryParams;
    }

    return {
      companyName: snapshot.companyName,
      email: snapshot.email,
      redirectTo: snapshot.redirectTo,
      plan: snapshot.plan,
      billingCycle: snapshot.billingCycle,
      amount: snapshot.amount,
      issuedAt: snapshot.issuedAt
    };
  }

  get hasData(): boolean {
    return Boolean(this.dashboard && this.dashboard.kpis.totalPromotions > 0);
  }

  get kpiCards(): KpiCard[] {
    const kpis = this.dashboard?.kpis;
    if (!kpis) return [];

    return [
      {
        label: this.t('DASHBOARD.KPI_PROMOTIONS'),
        value: this.formatNumber(kpis.totalPromotions),
        hint: this.t('DASHBOARD.KPI_PROMOTIONS_HINT', {
          active: this.formatNumber(kpis.activePromotions),
          expired: this.formatNumber(kpis.expiredPromotions)
        }),
        tone: 'blue'
      },
      {
        label: this.t('DASHBOARD.KPI_DRAFTS'),
        value: this.formatNumber(kpis.draftPromotions + kpis.scheduledPromotions),
        hint: this.t('DASHBOARD.KPI_DRAFTS_HINT', {
          drafts: this.formatNumber(kpis.draftPromotions),
          scheduled: this.formatNumber(kpis.scheduledPromotions)
        }),
        tone: 'slate'
      },
      {
        label: this.t('DASHBOARD.KPI_COUPONS_USED'),
        value: this.formatNumber(kpis.couponsUsed),
        hint: this.t('DASHBOARD.KPI_COUPONS_HINT', {
          remaining: this.formatNumber(kpis.couponsRemaining),
          rate: kpis.couponUsageRate.toFixed(1)
        }),
        tone: 'orange'
      },
      {
        label: this.t('DASHBOARD.KPI_TOTAL_VIEWS'),
        value: this.formatNumber(kpis.totalViews),
        hint: this.t('DASHBOARD.KPI_TOTAL_VIEWS_HINT'),
        tone: 'green'
      },
      {
        label: this.t('DASHBOARD.KPI_ENGAGEMENT'),
        value: `${kpis.engagementRate.toFixed(1)}%`,
        hint: this.t('DASHBOARD.KPI_ENGAGEMENT_HINT'),
        tone: 'violet'
      },
      {
        label: this.t('DASHBOARD.KPI_BEST_PROMOTION'),
        value: kpis.bestPromotion?.title ?? this.t('DASHBOARD.KPI_NONE'),
        hint: kpis.bestPromotion
          ? this.t('DASHBOARD.KPI_BEST_PROMOTION_HINT', { views: this.formatNumber(kpis.bestPromotion.views) })
          : this.t('DASHBOARD.KPI_ADD_PROMO'),
        tone: 'red'
      }
    ];
  }

  setPeriod(period: CompanyDashboardPeriod): void {
    if (this.selectedPeriod === period) return;
    this.selectedPeriod = period;
    this.loadDashboard();
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/']);
  }

  couponStatusLabel(status: CompanyCouponStatus): string {
    if (status === 'USED') return this.t('DASHBOARD.COUPON_STATUS_USED');
    if (status === 'EXPIRED') return this.t('DASHBOARD.COUPON_STATUS_EXPIRED');
    return this.t('DASHBOARD.COUPON_STATUS_UNUSED');
  }

  couponStatusClass(status: CompanyCouponStatus): string {
    return `coupon-status-${status.toLowerCase()}`;
  }

  private loadDashboard(): void {
    this.loadingDashboard = true;
    this.dashboardError = '';

    this.promotionService.getCompanyAdminDashboard(this.selectedPeriod).subscribe({
      next: (dashboard) => {
        this.dashboard = dashboard;
        this.loadingDashboard = false;
        this.cdr.detectChanges();
        this.scheduleRenderCharts();
      },
      error: (error: HttpErrorResponse) => {
        this.loadingDashboard = false;
        this.dashboard = null;
        this.destroyCharts();
        this.dashboardError = this.formatLoadError(error);
      }
    });
  }

  private loadCoupons(): void {
    this.loadingCoupons = true;
    this.couponsError = '';

    this.promotionService.getCompanyCoupons().subscribe({
      next: (coupons) => {
        this.loadingCoupons = false;
        this.coupons = coupons;
      },
      error: (error: HttpErrorResponse) => {
        this.loadingCoupons = false;
        this.coupons = [];
        this.couponsError = this.formatCouponsError(error);
      }
    });
  }

  private renderCharts(): void {
    if (!this.isBrowser || !this.viewReady || !this.dashboard) return;
    if (!this.viewsChart?.nativeElement || !this.statusChart?.nativeElement) {
      this.scheduleRenderCharts();
      return;
    }

    this.destroyCharts();
    const charts = this.dashboard.charts;

    this.createLineChart(this.viewsChart, charts['viewsByPeriod']);
    this.createLineChart(this.couponsChart, charts['couponsUsedByPeriod']);
    this.createDoughnutChart(this.statusChart, charts['promotionStatusDistribution'], [
      '#16a34a',
      '#dc2626',
      '#64748b',
      '#f59e0b'
    ]);
    this.createBarChart(this.topViewsChart, charts['topPromotionsByViews'], true);
    this.createBarChart(this.topCouponsChart, charts['topPromotionsByCouponsUsed'], true);
    this.createBarChart(this.viewsVsCouponsChart, charts['viewsVsCoupons'], false);
    this.createBarChart(this.activePerformanceChart, charts['activePromotionsPerformance'], false);
    this.createLineChart(this.creationsChart, charts['promotionCreations']);
    this.createDoughnutChart(this.couponSplitChart, charts['couponUsedRemaining'], ['#ea580c', '#2563eb']);
  }

  private scheduleRenderCharts(): void {
    if (!this.isBrowser || !this.viewReady) return;

    if (this.renderHandle !== null) {
      cancelAnimationFrame(this.renderHandle);
    }

    this.ngZone.runOutsideAngular(() => {
      this.renderHandle = requestAnimationFrame(() => {
        this.renderHandle = null;
        this.renderCharts();
      });
    });
  }

  private createLineChart(ref: ElementRef<HTMLCanvasElement> | undefined, chart?: CompanyChartPointResponse): void {
    const canvas = ref?.nativeElement;
    if (!canvas || !chart) return;

    this.charts.push(new Chart(canvas, {
      type: 'line',
      data: {
        labels: chart.labels.map((label) => this.translateChartLabel(label)),
        datasets: chart.datasets.map((dataset) => ({
          label: this.translateChartLabel(dataset.label),
          data: this.numericData(dataset.data),
          borderColor: dataset.color,
          backgroundColor: this.alpha(dataset.color, 0.12),
          borderWidth: 2,
          pointRadius: 3,
          tension: 0.35,
          fill: true
        }))
      },
      options: this.chartOptions()
    }));
  }

  private createBarChart(
    ref: ElementRef<HTMLCanvasElement> | undefined,
    chart: CompanyChartPointResponse | undefined,
    horizontal: boolean
  ): void {
    const canvas = ref?.nativeElement;
    if (!canvas || !chart) return;

    this.charts.push(new Chart(canvas, {
      type: 'bar',
      data: {
        labels: chart.labels.map((label) => this.translateChartLabel(label)),
        datasets: chart.datasets.map((dataset) => ({
          label: this.translateChartLabel(dataset.label),
          data: this.numericData(dataset.data),
          backgroundColor: this.alpha(dataset.color, 0.72),
          borderColor: dataset.color,
          borderWidth: 1,
          borderRadius: 6
        }))
      },
      options: {
        ...this.chartOptions(),
        indexAxis: horizontal ? 'y' : 'x'
      }
    }));
  }

  private createDoughnutChart(
    ref: ElementRef<HTMLCanvasElement> | undefined,
    chart: CompanyChartPointResponse | undefined,
    colors: string[]
  ): void {
    const canvas = ref?.nativeElement;
    if (!canvas || !chart) return;

    const dataset = chart.datasets[0];
    this.charts.push(new Chart(canvas, {
      type: 'doughnut',
      data: {
        labels: chart.labels.map((label) => this.translateChartLabel(label)),
        datasets: [{
          label: this.translateChartLabel(dataset?.label ?? chart.title),
          data: this.numericData(dataset?.data ?? []),
          backgroundColor: chart.labels.map((_, index) => colors[index % colors.length]),
          borderColor: '#ffffff',
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '64%',
        plugins: {
          legend: {
            position: 'bottom',
            labels: { boxWidth: 10, usePointStyle: true }
          }
        }
      }
    }));
  }

  private chartOptions(): any {
    return {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: true,
          labels: { boxWidth: 10, usePointStyle: true }
        },
        tooltip: {
          callbacks: {
            label: (context: any) => {
              const label = context.dataset?.label ? `${context.dataset.label}: ` : '';
              const value = this.tooltipMetricValue(context);
              return `${label}${this.formatNumber(value)}`;
            }
          }
        }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { maxRotation: 0, autoSkip: true }
        },
        y: {
          beginAtZero: true,
          grid: { color: 'rgba(148, 163, 184, 0.16)' },
          ticks: { precision: 0 }
        }
      }
    };
  }

  private destroyCharts(): void {
    this.charts.forEach((chart) => chart.destroy());
    this.charts = [];
  }

  private formatLoadError(error: HttpErrorResponse): string {
    if (error.status === 0) return this.t('ERRORS.BACKEND_UNREACHABLE');
    if (error.status === 401 || error.status === 403) return this.t('ERRORS.COMPANY_ADMIN_SESSION');
    if (error.status === 400) return error.error?.error ?? this.t('ERRORS.COMPANY_SUBSCRIPTION_NOT_FOUND');
    if (error.status === 404) return this.t('ERRORS.COMPANY_DASHBOARD_ENDPOINT');
    return this.t('ERRORS.COMPANY_DASHBOARD_LOAD', { status: error.status });
  }

  private formatCouponsError(error: HttpErrorResponse): string {
    if (error.status === 0) return this.t('ERRORS.BACKEND_UNREACHABLE');
    if (error.status === 401 || error.status === 403) return this.t('ERRORS.COMPANY_ADMIN_SESSION');
    if (error.status === 400) return error.error?.error ?? this.t('ERRORS.COMPANY_COUPONS_NOT_FOUND');
    return this.t('ERRORS.COMPANY_COUPONS_LOAD', { status: error.status });
  }

  private numericData(values: number[]): number[] {
    return values.map((value) => Number(value) || 0);
  }

  private formatNumber(value: number): string {
    const locale = this.translations.currentLanguage() === 'en' ? 'en-US' : 'fr-FR';
    return new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(value ?? 0);
  }

  private t(key: string, params?: Record<string, string | number>): string {
    return this.translations.translate(key, params);
  }

  private translateChartLabel(label: string): string {
    const normalized = label.trim().toLowerCase();
    const keyByLabel: Record<string, string> = {
      vues: 'DASHBOARD.VIEWS_LABEL',
      views: 'DASHBOARD.VIEWS_LABEL',
      coupons: 'DASHBOARD.COUPONS_LABEL',
      'coupons utilises': 'DASHBOARD.KPI_COUPONS_USED',
      'used coupons': 'DASHBOARD.KPI_COUPONS_USED',
      promotions: 'DASHBOARD.KPI_PROMOTIONS',
      'promotions creees': 'DASHBOARD.CREATED_PROMOTIONS_LABEL',
      'created promotions': 'DASHBOARD.CREATED_PROMOTIONS_LABEL',
      actives: 'PROMOS.STATUS_ACTIVE',
      active: 'PROMOS.STATUS_ACTIVE',
      expirees: 'PROMOS.STATUS_EXPIRED',
      expired: 'PROMOS.STATUS_EXPIRED',
      planifiees: 'PROMOS.STATUS_SCHEDULED',
      scheduled: 'PROMOS.STATUS_SCHEDULED',
      brouillons: 'PROMOS.STATUS_DRAFT',
      drafts: 'PROMOS.STATUS_DRAFT',
      utilises: 'DASHBOARD.USED_LABEL',
      used: 'DASHBOARD.USED_LABEL',
      restants: 'DASHBOARD.REMAINING_LABEL',
      remaining: 'DASHBOARD.REMAINING_LABEL'
    };

    const key = keyByLabel[normalized];
    return key ? this.t(key) : label;
  }

  private tooltipMetricValue(context: any): number {
    const datasetValue = Number(context.dataset?.data?.[context.dataIndex]);
    if (Number.isFinite(datasetValue)) {
      return datasetValue;
    }

    const rawValue = Number(context.raw);
    if (Number.isFinite(rawValue)) {
      return rawValue;
    }

    const indexAxis = context.chart?.options?.indexAxis;
    const parsedValue = indexAxis === 'y'
      ? Number(context.parsed?.x)
      : Number(context.parsed?.y);

    return Number.isFinite(parsedValue) ? parsedValue : 0;
  }

  private get companySlugForActions(): string {
    return this.dashboard?.companySlug || this.connectedCompanySlug || this.selectedCompanySlug;
  }

  private getSubscriptionSnapshot(): SubscriptionSnapshot | null {
    if (!this.isBrowser || !window.localStorage) {
      return null;
    }

    const raw = localStorage.getItem('admin_subscription_snapshot');
    if (!raw) {
      return null;
    }

    try {
      const parsed = JSON.parse(raw) as Partial<SubscriptionSnapshot>;
      if (!parsed.companyName || !parsed.plan || !parsed.billingCycle) {
        return null;
      }

      return {
        companyName: parsed.companyName,
        email: parsed.email || this.email,
        plan: parsed.plan,
        billingCycle: parsed.billingCycle,
        amount: Number(parsed.amount ?? 0),
        issuedAt: parsed.issuedAt || new Date().toISOString(),
        redirectTo: '/dashboard'
      };
    } catch {
      return null;
    }
  }

  private alpha(hex: string, opacity: number): string {
    const clean = hex.replace('#', '');
    if (clean.length !== 6) return hex;
    const r = parseInt(clean.slice(0, 2), 16);
    const g = parseInt(clean.slice(2, 4), 16);
    const b = parseInt(clean.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
  }
}
