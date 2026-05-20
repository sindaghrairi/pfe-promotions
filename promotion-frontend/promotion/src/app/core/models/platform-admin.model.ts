export interface PlatformAdminStats {
  totalUsers: number;
  totalClients: number;
  totalCompanyAdmins: number;
  totalPlatformAdmins: number;
  activeSubscriptions: number;
  inactiveSubscriptions: number;
  totalPromotions: number;
  activePromotions: number;
  expiredPromotions: number;
  scheduledPromotions: number;
  draftPromotions: number;
}

export type PlatformUserRole = 'CLIENT' | 'ADMIN' | 'PLATFORM_ADMIN';

export interface PlatformAdminUser {
  id: number;
  fullName: string;
  email: string;
  role: PlatformUserRole;
  createdAt: string;
}

export interface PlatformAdminSubscription {
  id: number;
  companyName: string;
  contactEmail: string;
  plan: string;
  active: boolean;
  createdAt: string;
}

export interface PlatformAdminPlan {
  id: number;
  name: string;
  price: number;
  description: string;
  duration?: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PlatformAdminPlanPayload {
  name: string;
  price: number;
  description: string;
  duration?: string | null;
  active: boolean;
}

export interface PlatformAdminPromotion {
  id: number;
  companySlug: string;
  status: string;
  startDate: string;
  endDate: string;
  createdAt: string;
  views: number;
  usageCount: number;
  claimedCount?: number;
}

export interface AcquisitionStats {
  labels: string[];
  users: number[];
  companies: number[];
  promos: number[];
}

export interface PlatformAdminInvoiceResponse {
  message: string;
  total: number;
  items: PlatformAdminInvoice[];
}

export interface PlatformAdminInvoice {
  id: number;
  companyName: string;
  companyEmail: string;
  plan: string;
  amount: number;
  status: 'PENDING' | 'PAID' | 'OVERDUE' | 'CANCELED';
  issuedAt: string;
  dueAt: string;
  paidAt?: string | null;
  createdAt: string;
}

export type PlatformDashboardPeriod = '7d' | '30d' | '12m';

export interface PlatformAdminDashboard {
  period: PlatformDashboardPeriod;
  from: string;
  to: string;
  kpis: PlatformAdminDashboardKpis;
  charts: PlatformAdminDashboardCharts;
}

export interface PlatformAdminDashboardKpis {
  totalCompanies: number;
  activeCompanies: number;
  totalPromotions: number;
  activePromotions: number;
  expiredPromotions: number;
  totalCoupons: number;
  usedCoupons: number;
  couponUsageRate: number;
  totalRevenue: number;
  paidInvoices: number;
  pendingInvoices: number;
  activeSubscriptions: number;
  newUsersThisMonth: number;
}

export interface PlatformAdminDashboardCharts {
  companiesByPeriod: PlatformAdminChart;
  promotionsByPeriod: PlatformAdminChart;
  promotionStatusDistribution: PlatformAdminChart;
  topCompaniesByPromotions: PlatformAdminChart;
  topCompaniesByCouponsUsed: PlatformAdminChart;
  monthlyRevenue: PlatformAdminChart;
  subscriptionsByPlan: PlatformAdminChart;
  platformEvolution: PlatformAdminChart;
}

export interface PlatformAdminChart {
  title: string;
  labels: string[];
  datasets: PlatformAdminChartDataset[];
}

export interface PlatformAdminChartDataset {
  label: string;
  data: number[];
  color: string;
}
