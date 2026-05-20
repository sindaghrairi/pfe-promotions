package com.pfe.promotionplatform.dto;

public record TopPromotionResponse(
        Long id,
        String title,
        String status,
        long views,
        long couponsUsed,
        long couponsRemaining,
        double engagementRate
) {
}
