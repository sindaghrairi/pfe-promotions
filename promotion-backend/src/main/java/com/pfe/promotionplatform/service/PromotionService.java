package com.pfe.promotionplatform.service;

import java.util.List;

import com.pfe.promotionplatform.entity.Promotion;

public interface PromotionService {
    List<Promotion> listCompanyPromotions(String companySlug, String principalEmail);

    List<Promotion> listPublishedPromotions(String companySlug);

    List<Promotion> listAllPublishedPromotions();

    List<String> listPublishedCompanySlugs();

    Promotion createPromotion(String companySlug, Promotion promotion, String principalEmail);

    Promotion updatePromotion(String companySlug, Long promotionId, Promotion promotion, String principalEmail);

    Promotion claimCoupon(String companySlug, Long promotionId);

    Promotion incrementViews(String companySlug, Long promotionId);

    void deletePromotion(String companySlug, Long promotionId, String principalEmail);
}
