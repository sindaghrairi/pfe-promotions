import { PromoStatus, PromoType } from './promo.model';

export interface PromotionAiEvaluationRequest {
  title: string;
  type: PromoType;
  status: PromoStatus;
  category: string;
  initialPrice: number;
  promotionalPrice: number;
  startDate: string;
  endDate: string;
  couponCode?: string;
  usageLimit?: number;
}

export interface PromotionAiEvaluationResponse {
  score: number;
  level: 'Faible' | 'Moyen' | 'Bon' | 'Excellent';
  discountPercent?: number | null;
  alerts: string[];
  anomalies: string[];
  recommendations: string[];
  marketingTitle?: string;
  marketingDescription?: string;
  enhancedRecommendation?: string;
  marketingFallbackMessage?: string;
}
