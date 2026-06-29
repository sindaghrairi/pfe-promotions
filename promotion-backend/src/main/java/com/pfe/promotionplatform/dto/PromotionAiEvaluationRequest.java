package com.pfe.promotionplatform.dto;

import java.math.BigDecimal;

import com.pfe.promotionplatform.entity.PromotionStatus;
import com.pfe.promotionplatform.entity.PromotionType;

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
