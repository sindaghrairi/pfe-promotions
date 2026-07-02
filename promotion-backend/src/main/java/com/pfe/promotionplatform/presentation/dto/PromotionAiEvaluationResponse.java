package com.pfe.promotionplatform.presentation.dto;

import java.math.BigDecimal;
import java.util.List;

public record PromotionAiEvaluationResponse(
        int score,
        String level,
        BigDecimal discountPercent,
        List<String> alerts,
        List<String> anomalies,
        List<String> recommendations,
        String marketingTitle,
        String marketingDescription,
        String enhancedRecommendation,
        String marketingFallbackMessage
) {
}
