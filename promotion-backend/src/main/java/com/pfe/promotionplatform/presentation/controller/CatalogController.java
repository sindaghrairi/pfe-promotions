package com.pfe.promotionplatform.presentation.controller;

import java.util.List;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.pfe.promotionplatform.domain.model.Promotion;
import com.pfe.promotionplatform.domain.port.in.PromotionService;

import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/catalog")
@RequiredArgsConstructor
public class CatalogController {

    private final PromotionService promotionService;

    @GetMapping("/companies/published")
    public ResponseEntity<List<String>> listPublishedCompanies() {
        return ResponseEntity.ok(promotionService.listPublishedCompanySlugs());
    }

    @GetMapping("/promotions/published")
    public ResponseEntity<List<Promotion>> listAllPublishedPromotions() {
        return ResponseEntity.ok(promotionService.listAllPublishedPromotions());
    }
}
