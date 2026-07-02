package com.pfe.promotionplatform.presentation.controller;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;

@Controller
public class OAuth2RedirectController {

    @Value("${promolink.frontend.oauth-callback-url:http://localhost:4200/oauth2/google/callback}")
    private String frontendCallbackUrl;

    @GetMapping("/login/oauth2/code/google")
    public String googleCallback(
            @RequestParam(required = false) String code,
            @RequestParam(required = false) String state,
            @RequestParam(required = false) String error) {
        if (error != null && !error.isBlank()) {
            return "redirect:" + frontendCallbackUrl + "?error=" + encode(error);
        }

        String redirect = frontendCallbackUrl + "?code=" + encode(code == null ? "" : code);
        if (state != null && !state.isBlank()) {
            redirect += "&state=" + encode(state);
        }

        return "redirect:" + redirect;
    }

    private String encode(String value) {
        return URLEncoder.encode(value, StandardCharsets.UTF_8);
    }
}
