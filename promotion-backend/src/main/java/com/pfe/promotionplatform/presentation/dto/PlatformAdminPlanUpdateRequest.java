package com.pfe.promotionplatform.presentation.dto;

import java.math.BigDecimal;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record PlatformAdminPlanUpdateRequest(
        @NotBlank(message = "Le nom du plan est obligatoire")
        @Size(max = 80, message = "Le nom du plan ne doit pas depasser 80 caracteres")
        String name,

        @NotNull(message = "Le prix est obligatoire")
        @DecimalMin(value = "0.0", inclusive = true, message = "Le prix doit etre positif")
        BigDecimal price,

        @NotBlank(message = "La description est obligatoire")
        @Size(max = 800, message = "La description ne doit pas depasser 800 caracteres")
        String description,

        @Size(max = 80, message = "La duree ne doit pas depasser 80 caracteres")
        String duration,

        @NotNull(message = "Le statut est obligatoire")
        Boolean active
) {
}
