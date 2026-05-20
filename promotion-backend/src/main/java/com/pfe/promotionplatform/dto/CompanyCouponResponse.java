package com.pfe.promotionplatform.dto;

import java.time.LocalDateTime;

public record CompanyCouponResponse(
        Long id,
        String code,
        Long promotionId,
        String promotionTitle,
        String discount,
        LocalDateTime createdAt,
        String expirationDate,
        String status,
        Integer usedCount,
        Integer allowedCount,
        String usedByEmail,
        String usedByUser
) {
}
