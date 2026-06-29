package com.pfe.promotionplatform.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record SetPasswordRequest(
        @NotBlank(message = "Le nouveau mot de passe est obligatoire")
        @Size(min = 6, message = "Le nouveau mot de passe doit contenir au moins 6 caracteres") String newPassword,
        @NotBlank(message = "La confirmation du mot de passe est obligatoire") String confirmNewPassword) {
}
