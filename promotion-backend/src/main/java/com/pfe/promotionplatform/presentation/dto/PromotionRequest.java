package com.pfe.promotionplatform.presentation.dto;

import java.math.BigDecimal;

import com.pfe.promotionplatform.domain.model.PromotionStatus;
import com.pfe.promotionplatform.domain.model.PromotionType;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;

public record PromotionRequest(
        String title,
        PromotionType type,
        String category,
        String couponCode,
        String startDate,
        String endDate,
        PromotionStatus status,
        Integer usageCount,
        Integer views,
        Integer claimedCount,
        @NotNull(message = "Le prix initial est obligatoire")
        @DecimalMin(value = "0.0", inclusive = false, message = "Le prix initial doit etre superieur a 0")
        BigDecimal initialPrice,
        @NotNull(message = "Le prix promotionnel est obligatoire")
        @DecimalMin(value = "0.0", inclusive = false, message = "Le prix promotionnel doit etre superieur a 0")
        BigDecimal promotionalPrice
) {
}
