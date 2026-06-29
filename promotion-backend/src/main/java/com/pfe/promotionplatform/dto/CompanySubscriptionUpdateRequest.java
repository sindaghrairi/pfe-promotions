package com.pfe.promotionplatform.dto;

import jakarta.validation.constraints.NotBlank;

public record CompanySubscriptionUpdateRequest(
        @NotBlank(message = "Le plan est obligatoire") String plan) {
}
