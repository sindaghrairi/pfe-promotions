export type PromoStatus = 'ACTIVE' | 'DRAFT' | 'SCHEDULED' | 'EXPIRED';
export type PromoType = 'PERCENT' | 'FIXED' | 'BOGO';

export interface PromotionDto {
  id: number;
  companySlug: string;
  title: string;
  type: PromoType;
  category: string;
  discount: string;
  couponCode?: string | null;
  startDate: string;
  endDate: string;
  status: PromoStatus;
  usageCount: number;
  views: number;
  claimedCount?: number;
}

export interface PromotionPayload {
  title: string;
  type: PromoType;
  category: string;
  discount: string;
  couponCode?: string;
  startDate: string;
  endDate: string;
  status: PromoStatus;
  usageCount?: number;
  views?: number;
  claimedCount?: number;
}

export type CompanyDashboardPeriod = '7d' | '30d' | '12m';

export interface CompanyAdminDashboardResponse {
  period: CompanyDashboardPeriod;
  from: string;
  to: string;
  companyName: string;
  companySlug: string;
  kpis: CompanyAdminKpiResponse;
  charts: Record<string, CompanyChartPointResponse>;
  topPromotions: TopPromotionResponse[];
  notes: string[];
}

export interface CompanyAdminKpiResponse {
  totalPromotions: number;
  activePromotions: number;
  expiredPromotions: number;
  draftPromotions: number;
  scheduledPromotions: number;
  totalCoupons: number;
  couponsUsed: number;
  couponsRemaining: number;
  couponUsageRate: number;
  totalViews: number;
  bestPromotion?: TopPromotionResponse | null;
  mostUsedCoupon?: TopPromotionResponse | null;
  engagementRate: number;
}

export interface CompanyChartPointResponse {
  title: string;
  labels: string[];
  datasets: CompanyChartDatasetResponse[];
}

export interface CompanyChartDatasetResponse {
  label: string;
  data: number[];
  color: string;
}

export interface TopPromotionResponse {
  id: number;
  title: string;
  status: PromoStatus | 'UNKNOWN';
  views: number;
  couponsUsed: number;
  couponsRemaining: number;
  engagementRate: number;
}

export type CompanyCouponStatus = 'USED' | 'UNUSED' | 'EXPIRED';

export interface CompanyCouponResponse {
  id: number;
  code: string;
  promotionId: number;
  promotionTitle: string;
  discount: string;
  createdAt?: string | null;
  expirationDate?: string | null;
  status: CompanyCouponStatus;
  usedCount: number;
  allowedCount: number;
  usedByEmail?: string | null;
  usedByUser?: string | null;
}
