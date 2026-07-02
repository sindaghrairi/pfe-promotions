package com.pfe.promotionplatform.presentation.dto;

public record CompanyAdminProfileResponse(
        String companyName,
        String email,
        String plan,
        Boolean subscriptionActive,
        String oauthProvider,
        Boolean localPasswordSet,
        String token) {
}
