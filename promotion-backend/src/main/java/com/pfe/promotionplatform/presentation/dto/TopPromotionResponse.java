package com.pfe.promotionplatform.presentation.dto;

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
