package com.pfe.promotionplatform.presentation.controller;

import java.security.Principal;

import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.pfe.promotionplatform.presentation.dto.PromotionAiEvaluationRequest;
import com.pfe.promotionplatform.presentation.dto.PromotionAiEvaluationResponse;
import com.pfe.promotionplatform.application.usecase.AiPromotionEvaluationFacadeService;

import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/ai")
@RequiredArgsConstructor
public class AiPromotionController {

    private final AiPromotionEvaluationFacadeService aiPromotionEvaluationFacadeService;

    @PostMapping("/evaluate-promotion")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<PromotionAiEvaluationResponse> evaluatePromotion(
            @RequestBody PromotionAiEvaluationRequest request,
            Principal principal,
            Authentication authentication) {
        return ResponseEntity.ok(aiPromotionEvaluationFacadeService.evaluatePromotion(request, principal, authentication));
    }
}
