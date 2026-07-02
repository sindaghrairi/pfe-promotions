package com.pfe.promotionplatform.presentation.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record ChangePasswordRequest(
        @NotBlank(message = "L'ancien mot de passe est obligatoire") String oldPassword,
        @NotBlank(message = "Le nouveau mot de passe est obligatoire")
        @Size(min = 6, message = "Le nouveau mot de passe doit contenir au moins 6 caracteres") String newPassword,
        @NotBlank(message = "La confirmation du mot de passe est obligatoire") String confirmNewPassword) {
}
