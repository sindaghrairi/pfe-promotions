package com.pfe.promotionplatform.dto;

public record AccountProfileResponse(
        String fullName,
        String email,
        String role,
        String oauthProvider,
        Boolean localPasswordSet,
        String token) {
}
