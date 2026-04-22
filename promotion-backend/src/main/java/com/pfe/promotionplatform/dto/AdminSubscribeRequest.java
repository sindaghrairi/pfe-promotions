package com.pfe.promotionplatform.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class AdminSubscribeRequest {

    @NotBlank(message = "Le nom de la societe est obligatoire")
    private String companyName;

    @Email(message = "Email invalide")
    @NotBlank(message = "L'email de contact est obligatoire")
    private String contactEmail;

    @NotBlank(message = "Le plan d'abonnement est obligatoire")
    @Pattern(
            regexp = "(?i)BASIC|STANDARD|PREMIUM|PRO|ENTERPRISE",
            message = "Plan invalide. Valeurs acceptees: BASIC, STANDARD, PREMIUM")
    private String plan;
}