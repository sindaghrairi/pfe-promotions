package com.pfe.promotionplatform.service;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.springframework.stereotype.Service;

import com.pfe.promotionplatform.entity.Promotion;
import com.pfe.promotionplatform.repository.PromotionRepository;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class PlatformAdminPromotionService {

    private final PromotionRepository promotionRepository;

    public List<Map<String, Object>> listPromotions() {
        return promotionRepository.findAll().stream()
                .map(this::toPromotionResponse)
                .toList();
    }

    private Map<String, Object> toPromotionResponse(Promotion promotion) {
        Map<String, Object> dto = new LinkedHashMap<>();
        dto.put("id", promotion.getId());
        dto.put("companySlug", promotion.getCompanySlug());
        dto.put("status", promotion.getStatus());
        dto.put("startDate", promotion.getStartDate());
        dto.put("endDate", promotion.getEndDate());
        dto.put("createdAt", promotion.getCreatedAt());
        dto.put("views", promotion.getViews() != null ? promotion.getViews() : 0);
        dto.put("usageCount", promotion.getUsageCount() != null ? promotion.getUsageCount() : 0);
        dto.put("claimedCount", promotion.getClaimedCount() != null ? promotion.getClaimedCount() : 0);
        return dto;
    }
}
