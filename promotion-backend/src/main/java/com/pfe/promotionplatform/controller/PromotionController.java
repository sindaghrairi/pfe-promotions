package com.pfe.promotionplatform.controller;

import java.security.Principal;
import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.pfe.promotionplatform.dto.PromotionRequest;
import com.pfe.promotionplatform.entity.Promotion;
import com.pfe.promotionplatform.service.PromotionService;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/promotions")
@Validated
@RequiredArgsConstructor
public class PromotionController {

    private final PromotionService promotionService;

    @GetMapping("/company/{slug}")
    public ResponseEntity<List<Promotion>> listCompanyPromotions(@PathVariable String slug, Principal principal) {
        return ResponseEntity.ok(promotionService.listCompanyPromotions(slug, principal.getName()));
    }

    @GetMapping("/company/{slug}/published")
    public ResponseEntity<List<Promotion>> listPublishedPromotions(@PathVariable String slug) {
        return ResponseEntity.ok(promotionService.listPublishedPromotions(slug));
    }

    @PostMapping("/company/{slug}")
    public ResponseEntity<Promotion> createPromotion(
            @PathVariable String slug,
            @Valid @RequestBody PromotionRequest request,
            Principal principal) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(promotionService.createPromotion(slug, request, principal.getName()));
    }

    @PutMapping("/company/{slug}/{promotionId}")
    public ResponseEntity<Promotion> updatePromotion(
            @PathVariable String slug,
            @PathVariable Long promotionId,
            @Valid @RequestBody PromotionRequest request,
            Principal principal) {
        return ResponseEntity.ok(promotionService.updatePromotion(slug, promotionId, request, principal.getName()));
    }

    @PostMapping("/company/{slug}/{promotionId}/claim")
    public ResponseEntity<Promotion> claimCoupon(
            @PathVariable String slug,
            @PathVariable Long promotionId) {
        return ResponseEntity.ok(promotionService.claimCoupon(slug, promotionId));
    }

    @PostMapping("/company/{slug}/{promotionId}/view")
    public ResponseEntity<Promotion> incrementViews(
            @PathVariable String slug,
            @PathVariable Long promotionId) {
        return ResponseEntity.ok(promotionService.incrementViews(slug, promotionId));
    }

    @DeleteMapping("/company/{slug}/{promotionId}")
    public ResponseEntity<Void> deletePromotion(
            @PathVariable String slug,
            @PathVariable Long promotionId,
            Principal principal) {
        promotionService.deletePromotion(slug, promotionId, principal.getName());
        return ResponseEntity.noContent().build();
    }
}
