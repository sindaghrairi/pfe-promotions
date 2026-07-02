package com.pfe.promotionplatform.presentation.dto;

import java.math.BigDecimal;
import java.time.LocalDateTime;

public record PlatformAdminPlanDto(
        Long id,
        String name,
        BigDecimal price,
        String description,
        String duration,
        Boolean active,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {
}
