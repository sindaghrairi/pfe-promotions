package com.pfe.promotionplatform.presentation.dto;

import jakarta.validation.constraints.NotBlank;

public record CompanySubscriptionUpdateRequest(
        @NotBlank(message = "Le plan est obligatoire") String plan) {
}
