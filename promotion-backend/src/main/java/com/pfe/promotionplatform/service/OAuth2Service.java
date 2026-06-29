package com.pfe.promotionplatform.service;

import com.pfe.promotionplatform.dto.AuthResponse;

public interface OAuth2Service {
    String getGoogleAuthorizationUrl(String state);
    AuthResponse handleGoogleCallback(String code, String state);
}
