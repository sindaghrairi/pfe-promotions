package com.pfe.promotionplatform.dto;

public record CompanyAdminKpiResponse(
        long totalPromotions,
        long activePromotions,
        long expiredPromotions,
        long draftPromotions,
        long scheduledPromotions,
        long totalCoupons,
        long couponsUsed,
        long couponsRemaining,
        double couponUsageRate,
        long totalViews,
        TopPromotionResponse bestPromotion,
        TopPromotionResponse mostUsedCoupon,
        double engagementRate
) {
}
