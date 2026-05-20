package com.pfe.promotionplatform.service.impl;

import java.text.Normalizer;
import java.util.Comparator;
import java.util.List;
import java.util.Objects;
import java.util.Set;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.pfe.promotionplatform.entity.AdminSubscription;
import com.pfe.promotionplatform.entity.Promotion;
import com.pfe.promotionplatform.entity.PromotionStatus;
import com.pfe.promotionplatform.repository.AdminSubscriptionRepository;
import com.pfe.promotionplatform.repository.PromotionRepository;
import com.pfe.promotionplatform.service.CouponService;
import com.pfe.promotionplatform.service.PromotionService;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class PromotionServiceImpl implements PromotionService {

    private final PromotionRepository promotionRepository;
    private final AdminSubscriptionRepository adminSubscriptionRepository;
    private final CouponService couponService;

    @Override
    @Transactional(readOnly = true)
    public List<Promotion> listCompanyPromotions(String companySlug, String principalEmail) {
        validateOwner(companySlug, principalEmail);
        return promotionRepository.findByCompanySlugOrderByIdDesc(normalizeSlug(companySlug)).stream()
                .map(couponService::hydrateLegacyFields)
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public List<Promotion> listPublishedPromotions(String companySlug) {
        return promotionRepository.findByCompanySlugAndStatusInOrderByIdDesc(
                normalizeSlug(companySlug),
                Set.of(PromotionStatus.ACTIVE, PromotionStatus.EXPIRED)).stream()
                .map(couponService::hydrateLegacyFields)
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public List<Promotion> listAllPublishedPromotions() {
        return promotionRepository.findByStatusInOrderByIdDesc(
                Set.of(PromotionStatus.ACTIVE, PromotionStatus.EXPIRED)).stream()
                .map(couponService::hydrateLegacyFields)
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public List<String> listPublishedCompanySlugs() {
        Set<PromotionStatus> visibleStatuses = Set.of(PromotionStatus.ACTIVE, PromotionStatus.EXPIRED);

        return promotionRepository.findAll().stream()
                .filter(promotion -> visibleStatuses.contains(promotion.getStatus()))
                .map(Promotion::getCompanySlug)
                .filter(Objects::nonNull)
                .map(String::trim)
                .filter(slug -> !slug.isEmpty())
                .distinct()
                .sorted(Comparator.naturalOrder())
                .toList();
    }

    @Override
    @Transactional
    public Promotion createPromotion(String companySlug, Promotion promotion, String principalEmail) {
        validateOwner(companySlug, principalEmail);
        String normalizedCouponCode = normalizeCouponCode(promotion.getCouponCode());
        validateCouponForActiveStatus(promotion.getStatus(), normalizedCouponCode);

        promotion.setId(null);
        promotion.setCompanySlug(normalizeSlug(companySlug));
        promotion.setCouponCode(normalizedCouponCode);
        if (promotion.getUsageCount() == null) {
            promotion.setUsageCount(0);
        }
        if (promotion.getViews() == null) {
            promotion.setViews(0);
        }
        if (promotion.getClaimedCount() == null) {
            promotion.setClaimedCount(0);
        }

        Promotion saved = promotionRepository.save(promotion);
        couponService.syncFromPromotion(saved);
        return couponService.hydrateLegacyFields(saved);
    }

    @Override
    @Transactional
    public Promotion updatePromotion(String companySlug, Long promotionId, Promotion promotion, String principalEmail) {
        validateOwner(companySlug, principalEmail);
        String normalizedCouponCode = normalizeCouponCode(promotion.getCouponCode());
        validateCouponForActiveStatus(promotion.getStatus(), normalizedCouponCode);

        Promotion existing = promotionRepository.findById(promotionId)
                .orElseThrow(() -> new IllegalArgumentException("Promotion introuvable"));

        if (!existing.getCompanySlug().equals(normalizeSlug(companySlug))) {
            throw new IllegalArgumentException("Promotion invalide pour cette entreprise");
        }

        existing.setTitle(promotion.getTitle());
        existing.setType(promotion.getType());
        existing.setCategory(promotion.getCategory());
        existing.setDiscount(promotion.getDiscount());
        existing.setCouponCode(normalizedCouponCode);
        existing.setStartDate(promotion.getStartDate());
        existing.setEndDate(promotion.getEndDate());
        existing.setStatus(promotion.getStatus());
        existing.setUsageCount(promotion.getUsageCount() == null ? existing.getUsageCount() : promotion.getUsageCount());
        existing.setViews(promotion.getViews() == null ? existing.getViews() : promotion.getViews());
        existing.setClaimedCount(promotion.getClaimedCount() == null ? existing.getClaimedCount() : promotion.getClaimedCount());

        Promotion saved = promotionRepository.save(existing);
        couponService.syncFromPromotion(saved);
        return couponService.hydrateLegacyFields(saved);
    }

    @Override
    @Transactional
    public Promotion claimCoupon(String companySlug, Long promotionId) {
        Promotion existing = promotionRepository.findById(promotionId)
                .orElseThrow(() -> new IllegalArgumentException("Promotion introuvable"));

        if (!existing.getCompanySlug().equals(normalizeSlug(companySlug))) {
            throw new IllegalArgumentException("Promotion invalide pour cette entreprise");
        }

        if (existing.getStatus() != PromotionStatus.ACTIVE) {
            throw new IllegalArgumentException("Cette promotion n'est plus active");
        }

        couponService.hydrateLegacyFields(existing);
        couponService.claimCoupon(existing);
        return couponService.hydrateLegacyFields(promotionRepository.save(existing));
    }

    @Override
    @Transactional
    public Promotion incrementViews(String companySlug, Long promotionId) {
        Promotion existing = promotionRepository.findById(promotionId)
                .orElseThrow(() -> new IllegalArgumentException("Promotion introuvable"));

        if (!existing.getCompanySlug().equals(normalizeSlug(companySlug))) {
            throw new IllegalArgumentException("Promotion invalide pour cette entreprise");
        }

        int currentViews = existing.getViews() == null ? 0 : existing.getViews();
        existing.setViews(currentViews + 1);
        return couponService.hydrateLegacyFields(promotionRepository.save(existing));
    }

    @Override
    public void deletePromotion(String companySlug, Long promotionId, String principalEmail) {
        validateOwner(companySlug, principalEmail);

        Promotion existing = promotionRepository.findById(promotionId)
                .orElseThrow(() -> new IllegalArgumentException("Promotion introuvable"));

        if (!existing.getCompanySlug().equals(normalizeSlug(companySlug))) {
            throw new IllegalArgumentException("Promotion invalide pour cette entreprise");
        }

        promotionRepository.delete(existing);
    }

    private void validateOwner(String companySlug, String principalEmail) {
        String normalizedEmail = normalizeEmail(principalEmail);
        AdminSubscription subscription = adminSubscriptionRepository
                .findByContactEmailIgnoreCaseAndActiveTrue(normalizedEmail)
                .orElseThrow(() -> new IllegalArgumentException("Abonnement admin introuvable"));

        String ownerSlug = normalizeSlug(subscription.getCompanyName());
        if (!ownerSlug.equals(normalizeSlug(companySlug))) {
            throw new IllegalArgumentException("Acces refuse a cette entreprise");
        }
    }

    private String normalizeEmail(String email) {
        return email == null ? "" : email.trim().toLowerCase();
    }

    private String normalizeCouponCode(String code) {
        if (code == null) {
            return null;
        }

        String normalized = code.trim().toUpperCase();
        return normalized.isEmpty() ? null : normalized;
    }

    private void validateCouponForActiveStatus(PromotionStatus status, String couponCode) {
        if (status == PromotionStatus.ACTIVE && (couponCode == null || couponCode.isBlank())) {
            throw new IllegalArgumentException("Un coupon est obligatoire pour une promotion active");
        }
    }

    private String normalizeSlug(String value) {
        if (value == null) {
            return "";
        }

        return Normalizer.normalize(value, Normalizer.Form.NFD)
                .replaceAll("\\p{M}+", "")
                .toLowerCase()
                .replaceAll("[^a-z0-9]+", "-")
                .replaceAll("^-+|-+$", "");
    }
}
