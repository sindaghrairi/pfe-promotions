package com.pfe.promotionplatform.dto;

import jakarta.validation.constraints.NotNull;

public record PlatformAdminPlanStatusRequest(
        @NotNull(message = "Le statut est obligatoire")
        Boolean active
) {
}
