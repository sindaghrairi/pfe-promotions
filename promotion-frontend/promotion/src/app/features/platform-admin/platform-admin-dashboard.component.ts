import { CommonModule, DecimalPipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
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
import { Router, RouterLink } from '@angular/router';
import {
  BarController,
  BarElement,
  CategoryScale,
  Chart,
  DoughnutController,
  Filler,
  Legend,
  LinearScale,
  LineController,
  LineElement,
  PointElement,
  Tooltip,
  ArcElement
} from 'chart.js';

import { AuthService } from '../../core/services/auth.service';
import { PlatformAdminService } from '../../core/services/platform-admin.service';
import { ThemeService } from '../../core/services/theme.service';
import { TranslationService } from '../../core/i18n/translation.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { LanguageSwitcherComponent } from '../../shared/language-switcher/language-switcher.component';
import {
  PlatformAdminChart,
  PlatformAdminDashboard,
  PlatformCopilotResponse,
  PlatformDashboardPeriod
} from '../../core/models/platform-admin.model';

type KpiCard = {
  label: string;
  value: string;
  hint: string;
  tone: 'blue' | 'green' | 'orange' | 'violet' | 'red' | 'slate';
};

Chart.register(
  ArcElement,
  BarController,
  BarElement,
  CategoryScale,
  DoughnutController,
  Filler,
  Legend,
  LinearScale,
  LineController,
  LineElement,
  PointElement,
  Tooltip
);

@Component({
  selector: 'app-platform-admin-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, DecimalPipe, TranslatePipe, LanguageSwitcherComponent],
  templateUrl: './platform-admin-dashboard.component.html',
  styleUrl: './platform-admin-dashboard.component.css'
})
export class PlatformAdminDashboardComponent implements OnInit, AfterViewInit, OnDestroy {
  private readonly authService = inject(AuthService);
  private readonly platformAdminService = inject(PlatformAdminService);
  private readonly router = inject(Router);
  private readonly themeService = inject(ThemeService);
  private readonly translations = inject(TranslationService);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly ngZone = inject(NgZone);
  private readonly isBrowser = isPlatformBrowser(this.platformId);

  @ViewChild('platformEvolutionChart') platformEvolutionChart?: ElementRef<HTMLCanvasElement>;
  @ViewChild('companiesChart') companiesChart?: ElementRef<HTMLCanvasElement>;
  @ViewChild('promotionsChart') promotionsChart?: ElementRef<HTMLCanvasElement>;
  @ViewChild('statusChart') statusChart?: ElementRef<HTMLCanvasElement>;
  @ViewChild('topPromotionsChart') topPromotionsChart?: ElementRef<HTMLCanvasElement>;
  @ViewChild('topCouponsChart') topCouponsChart?: ElementRef<HTMLCanvasElement>;
  @ViewChild('revenueChart') revenueChart?: ElementRef<HTMLCanvasElement>;
  @ViewChild('plansChart') plansChart?: ElementRef<HTMLCanvasElement>;

  readonly isDark$ = this.themeService.isDark$;
  readonly periodOptions: { value: PlatformDashboardPeriod; labelKey: string }[] = [
    { value: '7d', labelKey: 'DASHBOARD.PERIOD_7D' },
    { value: '30d', labelKey: 'DASHBOARD.PERIOD_30D' },
    { value: '12m', labelKey: 'DASHBOARD.PERIOD_12M' }
  ];

  selectedPeriod: PlatformDashboardPeriod = '12m';
  dashboard: PlatformAdminDashboard | null = null;
  loading = true;
  errorMessage = '';
  email = '';
  copilotQuestion = 'Analyse la sante de la plateforme et donne-moi les priorites du jour.';
  copilotResponse: PlatformCopilotResponse | null = null;
  copilotLoading = false;
  copilotError = '';
  readonly copilotSuggestions = [
    'Quelles entreprises sont a risque ?',
    'Pourquoi les revenus peuvent baisser ?',
    'Que dois-je faire aujourd hui ?'
  ];

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
    this.email = this.authService.getStoredEmail() ?? '';
    this.loadDashboard();
  }

  ngAfterViewInit(): void {
    this.viewReady = true;
    this.renderCharts();
  }

  ngOnDestroy(): void {
    if (this.renderHandle !== null && this.isBrowser) {
      cancelAnimationFrame(this.renderHandle);
    }
    this.destroyCharts();
  }

  get kpiCards(): KpiCard[] {
    const kpis = this.dashboard?.kpis;
    if (!kpis) return [];

    return [
      {
        label: this.t('PLATFORM_DASHBOARD.KPI_COMPANIES'),
        value: this.formatNumber(kpis.totalCompanies),
        hint: this.t('PLATFORM_DASHBOARD.KPI_COMPANIES_HINT', {
          active: this.formatNumber(kpis.activeCompanies)
        }),
        tone: 'blue'
      },
      {
        label: this.t('PLATFORM_DASHBOARD.KPI_PROMOTIONS'),
        value: this.formatNumber(kpis.totalPromotions),
        hint: this.t('PLATFORM_DASHBOARD.KPI_PROMOTIONS_HINT', {
          active: this.formatNumber(kpis.activePromotions),
          expired: this.formatNumber(kpis.expiredPromotions)
        }),
        tone: 'green'
      },
      {
        label: this.t('PLATFORM_DASHBOARD.KPI_COUPONS_USED'),
        value: this.formatNumber(kpis.usedCoupons),
        hint: this.t('PLATFORM_DASHBOARD.KPI_COUPONS_HINT', {
          total: this.formatNumber(kpis.totalCoupons),
          rate: kpis.couponUsageRate.toFixed(1)
        }),
        tone: 'orange'
      },
      {
        label: this.t('PLATFORM_DASHBOARD.KPI_REVENUE'),
        value: `${this.formatNumber(kpis.totalRevenue)} TND`,
        hint: this.t('PLATFORM_DASHBOARD.KPI_REVENUE_HINT', {
          paid: this.formatNumber(kpis.paidInvoices)
        }),
        tone: 'violet'
      },
      {
        label: this.t('PLATFORM_DASHBOARD.KPI_PENDING_INVOICES'),
        value: this.formatNumber(kpis.pendingInvoices),
        hint: this.t('PLATFORM_DASHBOARD.KPI_PENDING_INVOICES_HINT'),
        tone: 'red'
      },
      {
        label: this.t('PLATFORM_DASHBOARD.KPI_ACTIVE_SUBSCRIPTIONS'),
        value: this.formatNumber(kpis.activeSubscriptions),
        hint: this.t('PLATFORM_DASHBOARD.KPI_ACTIVE_SUBSCRIPTIONS_HINT', {
          users: this.formatNumber(kpis.newUsersThisMonth)
        }),
        tone: 'slate'
      }
    ];
  }

  get periodLabel(): string {
    const labelKey = this.periodOptions.find((option) => option.value === this.selectedPeriod)?.labelKey
      ?? 'DASHBOARD.PERIOD_12M';
    return this.t(labelKey);
  }

  get topPromotionsRows(): { label: string; value: number }[] {
    return this.toRows(this.dashboard?.charts.topCompaniesByPromotions);
  }

  get topCouponsRows(): { label: string; value: number }[] {
    return this.toRows(this.dashboard?.charts.topCompaniesByCouponsUsed);
  }

  setPeriod(period: PlatformDashboardPeriod): void {
    if (this.selectedPeriod === period) return;
    this.selectedPeriod = period;
    this.loadDashboard();
  }

  askCopilot(question?: string): void {
    const value = (question ?? this.copilotQuestion).trim();
    if (!value || this.copilotLoading) return;

    this.copilotQuestion = value;
    this.copilotLoading = true;
    this.copilotError = '';

    this.platformAdminService.askPlatformCopilot({
      question: value,
      period: this.selectedPeriod
    }).subscribe({
      next: (response) => {
        this.copilotResponse = response;
        this.copilotLoading = false;
        this.cdr.markForCheck();
      },
      error: (error: HttpErrorResponse) => {
        this.copilotLoading = false;
        this.copilotError = this.formatCopilotError(error);
      }
    });
  }

  toggleTheme(): void {
    this.themeService.toggleTheme();
    this.scheduleRenderCharts();
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/platform-admin/login']);
  }

  private loadDashboard(): void {
    this.loading = true;
    this.errorMessage = '';

    this.platformAdminService.getDashboardAnalytics(this.selectedPeriod).subscribe({
      next: (dashboard) => {
        this.dashboard = dashboard;
        this.loading = false;
        this.cdr.detectChanges();
        this.scheduleRenderCharts();
      },
      error: (error: HttpErrorResponse) => {
        this.loading = false;
        this.dashboard = null;
        this.destroyCharts();
        this.errorMessage = this.formatLoadError(error);
      }
    });
  }

  private renderCharts(): void {
    if (!this.isBrowser || !this.viewReady || !this.dashboard) return;
    if (!this.platformEvolutionChart?.nativeElement || !this.statusChart?.nativeElement) {
      this.scheduleRenderCharts();
      return;
    }

    this.destroyCharts();
    const charts = this.dashboard.charts;

    this.createLineChart(this.platformEvolutionChart, charts.platformEvolution, true);
    this.createBarChart(this.companiesChart, charts.companiesByPeriod, false);
    this.createBarChart(this.promotionsChart, charts.promotionsByPeriod, false);
    this.createDoughnutChart(this.statusChart, charts.promotionStatusDistribution, [
      '#16a34a',
      '#dc2626',
      '#f59e0b',
      '#64748b'
    ]);
    this.createBarChart(this.topPromotionsChart, charts.topCompaniesByPromotions, true);
    this.createBarChart(this.topCouponsChart, charts.topCompaniesByCouponsUsed, true);
    this.createLineChart(this.revenueChart, charts.monthlyRevenue, false, true);
    this.createDoughnutChart(this.plansChart, charts.subscriptionsByPlan, [
      '#2563eb',
      '#7c3aed',
      '#0f766e',
      '#ea580c',
      '#64748b'
    ]);
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

  private createLineChart(
    ref: ElementRef<HTMLCanvasElement> | undefined,
    chart: PlatformAdminChart,
    multi = false,
    currency = false
  ): void {
    const canvas = ref?.nativeElement;
    if (!canvas) return;

    const datasets = chart.datasets.map((dataset) => ({
          label: this.translateChartLabel(dataset.label),
      data: this.numericData(dataset.data),
      borderColor: dataset.color,
      backgroundColor: this.alpha(dataset.color, 0.12),
      borderWidth: 2,
      pointRadius: 3,
      pointHoverRadius: 5,
      tension: 0.35,
      fill: !multi
    }));

    this.charts.push(new Chart(canvas, {
      type: 'line',
      data: { labels: chart.labels.map((label) => this.translateChartLabel(label)), datasets },
      options: this.chartOptions(currency)
    }));
  }

  private createBarChart(
    ref: ElementRef<HTMLCanvasElement> | undefined,
    chart: PlatformAdminChart,
    horizontal: boolean
  ): void {
    const canvas = ref?.nativeElement;
    if (!canvas) return;

    const dataset = chart.datasets[0];
    this.charts.push(new Chart(canvas, {
      type: 'bar',
      data: {
        labels: chart.labels.map((label) => this.translateChartLabel(label)),
        datasets: [{
          label: this.translateChartLabel(dataset?.label ?? chart.title),
          data: this.numericData(dataset?.data ?? []),
          backgroundColor: this.alpha(dataset?.color ?? '#2563eb', 0.78),
          borderColor: dataset?.color ?? '#2563eb',
          borderWidth: 1,
          borderRadius: 6
        }]
      },
      options: {
        ...this.chartOptions(false),
        indexAxis: horizontal ? 'y' : 'x'
      }
    }));
  }

  private createDoughnutChart(
    ref: ElementRef<HTMLCanvasElement> | undefined,
    chart: PlatformAdminChart,
    colors: string[]
  ): void {
    const canvas = ref?.nativeElement;
    if (!canvas) return;

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

  private chartOptions(currency: boolean): any {
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
              const value = Number(context.parsed?.y ?? context.parsed?.x ?? context.raw ?? 0);
              return currency
                ? `${label}${this.formatNumber(value)} TND`
                : `${label}${this.formatNumber(value)}`;
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
          ticks: {
            precision: 0,
            callback: (value: string | number) => currency ? `${value} TND` : value
          }
        }
      }
    };
  }

  private destroyCharts(): void {
    this.charts.forEach((chart) => chart.destroy());
    this.charts = [];
  }

  private formatLoadError(error: HttpErrorResponse): string {
    if (error.status === 0) {
      return this.t('ERRORS.BACKEND_UNREACHABLE');
    }
    if (error.status === 401 || error.status === 403) {
      return this.t('ERRORS.PLATFORM_ADMIN_SESSION');
    }
    if (error.status === 404) {
      return this.t('ERRORS.PLATFORM_ANALYTICS_ENDPOINT');
    }
    return this.t('ERRORS.PLATFORM_ANALYTICS_LOAD', { status: error.status });
  }

  private formatCopilotError(error: HttpErrorResponse): string {
    if (error.status === 0) {
      return 'Backend indisponible. Verifiez que Spring Boot est demarre.';
    }
    if (error.status === 401 || error.status === 403) {
      return 'Session admin plateforme expiree ou acces refuse.';
    }
    return `Copilot indisponible pour le moment (${error.status}).`;
  }

  private toRows(chart: PlatformAdminChart | undefined): { label: string; value: number }[] {
    if (!chart) return [];
    const values = this.numericData(chart.datasets[0]?.data ?? []);
    return chart.labels.map((label, index) => ({ label, value: values[index] ?? 0 }));
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
      utilisateurs: 'PLATFORM_DASHBOARD.CHART_LABEL_USERS',
      users: 'PLATFORM_DASHBOARD.CHART_LABEL_USERS',
      entreprises: 'PLATFORM_DASHBOARD.CHART_LABEL_COMPANIES',
      companies: 'PLATFORM_DASHBOARD.CHART_LABEL_COMPANIES',
      promotions: 'PLATFORM_DASHBOARD.CHART_LABEL_PROMOTIONS',
      actives: 'PLATFORM_DASHBOARD.CHART_LABEL_ACTIVE',
      active: 'PLATFORM_DASHBOARD.CHART_LABEL_ACTIVE',
      expirees: 'PLATFORM_DASHBOARD.CHART_LABEL_EXPIRED',
      expired: 'PLATFORM_DASHBOARD.CHART_LABEL_EXPIRED',
      planifiees: 'PLATFORM_DASHBOARD.CHART_LABEL_SCHEDULED',
      scheduled: 'PLATFORM_DASHBOARD.CHART_LABEL_SCHEDULED',
      brouillons: 'PLATFORM_DASHBOARD.CHART_LABEL_DRAFTS',
      drafts: 'PLATFORM_DASHBOARD.CHART_LABEL_DRAFTS',
      coupons: 'PLATFORM_DASHBOARD.CHART_LABEL_COUPONS',
      revenus: 'PLATFORM_DASHBOARD.CHART_LABEL_REVENUE',
      revenue: 'PLATFORM_DASHBOARD.CHART_LABEL_REVENUE'
    };

    const key = keyByLabel[normalized];
    return key ? this.t(key) : label;
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
