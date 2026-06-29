package com.pfe.promotionplatform.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;

public record AccountProfileUpdateRequest(
        @NotBlank(message = "Le nom complet est obligatoire") String fullName,
        @Email(message = "Email invalide") @NotBlank(message = "L'email est obligatoire") String email) {
}
