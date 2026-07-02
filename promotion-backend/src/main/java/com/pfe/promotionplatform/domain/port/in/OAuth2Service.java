package com.pfe.promotionplatform.domain.port.in;

import com.pfe.promotionplatform.presentation.dto.AuthResponse;

public interface OAuth2Service {
    String getGoogleAuthorizationUrl(String state);
    AuthResponse handleGoogleCallback(String code, String state);
}
