package com.pfe.promotionplatform.service;

import java.security.Principal;

import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import com.pfe.promotionplatform.dto.PromotionAiEvaluationRequest;
import com.pfe.promotionplatform.dto.PromotionAiEvaluationResponse;
import com.pfe.promotionplatform.entity.AdminSubscription;
import com.pfe.promotionplatform.entity.Role;
import com.pfe.promotionplatform.repository.AdminSubscriptionRepository;
import com.pfe.promotionplatform.repository.UserRepository;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Service
@RequiredArgsConstructor
@Slf4j
public class AiPromotionEvaluationFacadeService {

    private final PromotionAiEvaluationService promotionAiEvaluationService;
    private final SimplePromotionRecommendationService simplePromotionRecommendationService;
    private final AdminSubscriptionRepository adminSubscriptionRepository;
    private final UserRepository userRepository;

    public PromotionAiEvaluationResponse evaluatePromotion(
            PromotionAiEvaluationRequest request,
            Principal principal,
            Authentication authentication) {
        if (principal == null || authentication == null || !authentication.isAuthenticated()) {
            log.warn("AI promotion evaluation rejected: authenticated=false");
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Votre session a expire. Veuillez vous reconnecter.");
        }

        String email = normalizeEmail(principal.getName());
        String authorities = authentication.getAuthorities().toString();
        log.info("AI promotion evaluation request: email={} authorities={}", email, authorities);

        boolean companyAdmin = authentication.getAuthorities().stream()
                .anyMatch(authority -> "ROLE_ADMIN".equals(authority.getAuthority()));
        if (!companyAdmin) {
            log.warn("AI promotion evaluation rejected: email={} roleOk=false authorities={}", email, authorities);
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Acces reserve aux admins societe.");
        }

        boolean adminFound = userRepository.findByEmailIgnoreCase(email)
                .filter(user -> user.getRole() == Role.ADMIN)
                .isPresent();
        log.info("AI promotion evaluation admin lookup: email={} adminFound={}", email, adminFound);
        if (!adminFound) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Acces reserve aux admins societe.");
        }

        AdminSubscription subscription = adminSubscriptionRepository.findByContactEmailIgnoreCaseAndActiveTrue(email)
                .orElse(null);
        boolean activeSubscription = subscription != null;
        log.info("AI promotion evaluation subscription lookup: email={} activeSubscriptionFound={}",
                email,
                activeSubscription);
        if (!activeSubscription) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                    "Cette fonctionnalite est reservee aux entreprises abonnees.");
        }

        String plan = normalizePlan(subscription.getPlan());
        if ("BASIC".equals(plan)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                    "Les fonctionnalites IA ne sont pas disponibles avec le plan BASIC.");
        }

        if ("STANDARD".equals(plan)) {
            return simplePromotionRecommendationService.evaluate(request);
        }

        return promotionAiEvaluationService.evaluate(request);
    }

    private String normalizeEmail(String email) {
        return email == null ? "" : email.trim().toLowerCase();
    }

    private String normalizePlan(String plan) {
        if (plan == null) {
            return "BASIC";
        }

        return switch (plan.trim().toUpperCase()) {
            case "PREMIUM", "PRO" -> "PREMIUM";
            case "STANDARD", "ENTERPRISE" -> "STANDARD";
            default -> "BASIC";
        };
    }
}
