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
