package com.pfe.promotionplatform.service.impl;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import java.util.UUID;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.reactive.function.BodyInserters;
import org.springframework.web.reactive.function.client.WebClient;

import com.pfe.promotionplatform.dto.AuthResponse;
import com.pfe.promotionplatform.entity.AdminSubscription;
import com.pfe.promotionplatform.entity.AdminSubscriptionStatus;
import com.pfe.promotionplatform.entity.OAuthProvider;
import com.pfe.promotionplatform.entity.Role;
import com.pfe.promotionplatform.entity.User;
import com.pfe.promotionplatform.repository.AdminSubscriptionRepository;
import com.pfe.promotionplatform.repository.UserRepository;
import com.pfe.promotionplatform.security.CustomUserDetailsService;
import com.pfe.promotionplatform.security.JwtService;
import com.pfe.promotionplatform.service.OAuth2Service;
import com.pfe.promotionplatform.service.SubscriptionInvoiceService;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class OAuth2ServiceImpl implements OAuth2Service {

    private static final Logger log = LoggerFactory.getLogger(OAuth2ServiceImpl.class);

    private final WebClient webClient;
    private final UserRepository userRepository;
    private final AdminSubscriptionRepository adminSubscriptionRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final CustomUserDetailsService customUserDetailsService;
    private final SubscriptionInvoiceService subscriptionInvoiceService;

    @Value("${promolink.oauth2.google.client-id:}")
    private String clientId;

    @Value("${promolink.oauth2.google.client-secret:}")
    private String clientSecret;

    @Value("${promolink.oauth2.google.redirect-uri:http://localhost:8081/login/oauth2/code/google}")
    private String redirectUri;

    @Value("${promolink.oauth2.google.scope:openid,email,profile}")
    private String scope;

    @Value("${promolink.oauth2.google.authorization-uri:https://accounts.google.com/o/oauth2/v2/auth}")
    private String authorizationUri;

    @Value("${promolink.oauth2.google.token-uri:https://oauth2.googleapis.com/token}")
    private String tokenUri;

    @Value("${promolink.oauth2.google.user-info-uri:https://www.googleapis.com/oauth2/v3/userinfo}")
    private String userInfoUri;

    @Override
    public String getGoogleAuthorizationUrl(String state) {
        ensureGoogleConfig();
        String url = authorizationUri
                + "?client_id=" + encode(clientId)
                + "&redirect_uri=" + encode(redirectUri)
                + "&response_type=code"
                + "&scope=" + encode(normalizeScope(scope))
                + "&access_type=offline"
                + "&prompt=consent";

        if (state != null && !state.isBlank()) {
            url += "&state=" + encode(state);
        }

        return url;
    }

    @Override
    public AuthResponse handleGoogleCallback(String code, String state) {
        ensureGoogleConfig();
        GoogleTokenResponse tokenResponse = exchangeCodeForToken(code);
        GoogleUserInfo userInfo = fetchUserInfo(tokenResponse.accessToken());

        if (isBlank(userInfo.sub()) || isBlank(userInfo.email())) {
            throw new IllegalArgumentException("Compte Google invalide");
        }

        boolean isAdminFlow = "admin".equals(state);

        String normalizedEmail = userInfo.email().trim().toLowerCase();
        User user = userRepository
                .findByOauthProviderAndOauthId(OAuthProvider.GOOGLE, userInfo.sub())
                .orElseGet(() -> findOrCreateGoogleUser(normalizedEmail, userInfo, isAdminFlow));

        boolean needsUpdate = false;

        if (user.getOauthProvider() != OAuthProvider.GOOGLE || isBlank(user.getOauthId())) {
            user.setOauthProvider(OAuthProvider.GOOGLE);
            user.setOauthId(userInfo.sub());
            needsUpdate = true;
        }

        if (user.getOauthProvider() == OAuthProvider.GOOGLE && user.getLocalPasswordSet() == null) {
            user.setLocalPasswordSet(false);
            needsUpdate = true;
        }

        if (isAdminFlow && user.getRole() != Role.ADMIN) {
            user.setRole(Role.ADMIN);
            needsUpdate = true;
        }

        if (needsUpdate) {
            userRepository.save(user);
        }

        if (isAdminFlow && user.getRole() == Role.ADMIN) {
            ensureAdminSubscription(user, userInfo);
        }

        ensureUserCanAuthenticate(user);

        var userDetails = customUserDetailsService.loadUserByUsername(user.getEmail());
        String jwt = jwtService.generateToken(
                userDetails,
                Map.of("role", user.getRole().name(), "fullName", user.getFullName()));

        return AuthResponse.builder()
                .token(jwt)
                .email(user.getEmail())
                .role(user.getRole().name())
                .build();
    }

    private GoogleTokenResponse exchangeCodeForToken(String code) {
        if (isBlank(code)) {
            throw new IllegalArgumentException("Code Google manquant");
        }

        MultiValueMap<String, String> form = new LinkedMultiValueMap<>();
        form.add("code", code);
        form.add("client_id", clientId);
        form.add("client_secret", clientSecret);
        form.add("redirect_uri", redirectUri);
        form.add("grant_type", "authorization_code");

        log.info("Exchanging code at tokenUri={}, redirect_uri={}, client_id={}",
                tokenUri, redirectUri, clientId);

        return webClient.post()
                .uri(tokenUri)
                .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                .body(BodyInserters.fromFormData(form))
                .retrieve()
                .bodyToMono(GoogleTokenResponse.class)
                .block();
    }

    private GoogleUserInfo fetchUserInfo(String accessToken) {
        return webClient.get()
                .uri(userInfoUri)
                .headers(headers -> headers.setBearerAuth(accessToken))
                .retrieve()
                .bodyToMono(GoogleUserInfo.class)
                .block();
    }

    private User findOrCreateGoogleUser(String normalizedEmail, GoogleUserInfo userInfo, boolean isAdminFlow) {
        Role role = (isAdminFlow || adminSubscriptionRepository
                .existsByContactEmailIgnoreCaseAndActiveTrue(normalizedEmail)) ? Role.ADMIN : Role.CLIENT;

        return userRepository.findByEmailIgnoreCase(normalizedEmail)
                .map(existing -> {
                    if (existing.getOauthProvider() == OAuthProvider.LOCAL
                            && existing.getLocalPasswordSet() == null) {
                        existing.setLocalPasswordSet(true);
                    }
                    existing.setOauthProvider(OAuthProvider.GOOGLE);
                    existing.setOauthId(userInfo.sub());
                    if (role == Role.ADMIN && existing.getRole() != Role.ADMIN) {
                        existing.setRole(Role.ADMIN);
                    }
                    return userRepository.save(existing);
                })
                .orElseGet(() -> {
                    User created = User.builder()
                            .fullName(resolveFullName(userInfo))
                            .email(normalizedEmail)
                            .password(passwordEncoder.encode("GOOGLE_OAUTH2_" + UUID.randomUUID()))
                            .localPasswordSet(false)
                            .oauthProvider(OAuthProvider.GOOGLE)
                            .oauthId(userInfo.sub())
                            .role(role)
                            .build();
                    return userRepository.save(created);
                });
    }

    private void ensureAdminSubscription(User user, GoogleUserInfo userInfo) {
        var existingSubscription = adminSubscriptionRepository.findByContactEmailIgnoreCase(user.getEmail());
        if (existingSubscription.isPresent()) {
            if (!Boolean.TRUE.equals(existingSubscription.get().getActive())) {
                throw new IllegalArgumentException("Votre abonnement est inactif. Contactez l'admin plateforme.");
            }
            return;
        }

            String companyName = user.getFullName() != null && !user.getFullName().isBlank()
                    ? user.getFullName() + " Company"
                    : user.getEmail().substring(0, user.getEmail().indexOf('@')) + " Company";

            AdminSubscription subscription = AdminSubscription.builder()
                    .companyName(companyName)
                    .contactEmail(user.getEmail())
                    .plan("BASIC")
                    .active(true)
                    .status(AdminSubscriptionStatus.ACTIVE)
                    .build();
            adminSubscriptionRepository.save(subscription);
            subscriptionInvoiceService.createInitialInvoiceIfMissing(subscription);
            log.info("Created AdminSubscription for Google OAuth admin user: {}", user.getEmail());
    }

    private void ensureUserCanAuthenticate(User user) {
        if (Boolean.FALSE.equals(user.getActive())) {
            throw new IllegalArgumentException("Votre compte est inactif. Contactez l'admin plateforme.");
        }

        if (user.getRole() == Role.ADMIN
                && !adminSubscriptionRepository.existsByContactEmailIgnoreCaseAndActiveTrue(user.getEmail())) {
            throw new IllegalArgumentException("Votre abonnement est inactif. Contactez l'admin plateforme.");
        }
    }

    private String resolveFullName(GoogleUserInfo userInfo) {
        if (!isBlank(userInfo.name())) {
            return userInfo.name();
        }
        return userInfo.email();
    }

    private void ensureGoogleConfig() {
        if (isBlank(clientId) || isBlank(clientSecret)) {
            throw new IllegalStateException("Google OAuth n'est pas configure");
        }
    }

    private String encode(String value) {
        return URLEncoder.encode(value, StandardCharsets.UTF_8);
    }

    private String normalizeScope(String rawScope) {
        return rawScope == null ? "" : rawScope.replace(',', ' ').trim().replaceAll("\\s+", " ");
    }

    private boolean isBlank(String value) {
        return value == null || value.trim().isEmpty();
    }

    private record GoogleTokenResponse(
            @com.fasterxml.jackson.annotation.JsonProperty("access_token") String accessToken,
            @com.fasterxml.jackson.annotation.JsonProperty("token_type") String tokenType,
            @com.fasterxml.jackson.annotation.JsonProperty("expires_in") Long expiresIn,
            @com.fasterxml.jackson.annotation.JsonProperty("id_token") String idToken
    ) {
    }

    private record GoogleUserInfo(
            String sub,
            String email,
            String name,
            String picture
    ) {
    }
}
