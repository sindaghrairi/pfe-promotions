package com.pfe.promotionplatform.presentation.dto;

import java.math.BigDecimal;

import com.pfe.promotionplatform.domain.model.PromotionStatus;
import com.pfe.promotionplatform.domain.model.PromotionType;

public record PromotionAiEvaluationRequest(
        String title,
        PromotionType type,
        PromotionStatus status,
        String category,
        BigDecimal initialPrice,
        BigDecimal promotionalPrice,
        String startDate,
        String endDate,
        String couponCode,
        Integer usageLimit
) {
}
