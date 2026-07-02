package com.pfe.promotionplatform.presentation.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;

public record CompanyAdminProfileUpdateRequest(
        @NotBlank(message = "Le nom de la societe est obligatoire") String companyName,
        @Email(message = "Email invalide") @NotBlank(message = "L'email est obligatoire") String email) {
}
