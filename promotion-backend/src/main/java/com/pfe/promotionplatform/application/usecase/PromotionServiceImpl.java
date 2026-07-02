package com.pfe.promotionplatform.application.usecase;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.text.Normalizer;
import java.util.Comparator;
import java.util.List;
import java.util.Objects;
import java.util.Set;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.pfe.promotionplatform.presentation.dto.PromotionRequest;
import com.pfe.promotionplatform.domain.model.AdminSubscription;
import com.pfe.promotionplatform.domain.model.Promotion;
import com.pfe.promotionplatform.domain.model.PromotionStatus;
import com.pfe.promotionplatform.domain.port.out.AdminSubscriptionRepository;
import com.pfe.promotionplatform.domain.port.out.PromotionRepository;
import com.pfe.promotionplatform.domain.port.in.CouponService;
import com.pfe.promotionplatform.domain.port.in.PromotionService;

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
    public Promotion createPromotion(String companySlug, PromotionRequest request, String principalEmail) {
        validateOwner(companySlug, principalEmail);
        String normalizedCouponCode = normalizeCouponCode(request.couponCode());
        validateCouponForActiveStatus(request.status(), normalizedCouponCode);
        validatePrices(request.initialPrice(), request.promotionalPrice());

        Promotion promotion = Promotion.builder()
                .companySlug(normalizeSlug(companySlug))
                .title(request.title())
                .type(request.type())
                .category(request.category())
                .couponCode(normalizedCouponCode)
                .startDate(request.startDate())
                .endDate(request.endDate())
                .status(request.status())
                .usageCount(request.usageCount() == null ? 0 : request.usageCount())
                .views(request.views() == null ? 0 : request.views())
                .claimedCount(request.claimedCount() == null ? 0 : request.claimedCount())
                .initialPrice(request.initialPrice())
                .promotionalPrice(request.promotionalPrice())
                .discount(calculateDiscountLabel(request.initialPrice(), request.promotionalPrice()))
                .build();

        Promotion saved = promotionRepository.save(promotion);
        couponService.syncFromPromotion(saved);
        return couponService.hydrateLegacyFields(saved);
    }

    @Override
    @Transactional
    public Promotion updatePromotion(String companySlug, Long promotionId, PromotionRequest request, String principalEmail) {
        validateOwner(companySlug, principalEmail);
        String normalizedCouponCode = normalizeCouponCode(request.couponCode());
        validateCouponForActiveStatus(request.status(), normalizedCouponCode);
        validatePrices(request.initialPrice(), request.promotionalPrice());

        Promotion existing = promotionRepository.findById(promotionId)
                .orElseThrow(() -> new IllegalArgumentException("Promotion introuvable"));

        if (!existing.getCompanySlug().equals(normalizeSlug(companySlug))) {
            throw new IllegalArgumentException("Promotion invalide pour cette entreprise");
        }

        existing.setTitle(request.title());
        existing.setType(request.type());
        existing.setCategory(request.category());
        existing.setInitialPrice(request.initialPrice());
        existing.setPromotionalPrice(request.promotionalPrice());
        // Discount is derived here so clients cannot persist an inconsistent percentage.
        existing.setDiscount(calculateDiscountLabel(request.initialPrice(), request.promotionalPrice()));
        existing.setCouponCode(normalizedCouponCode);
        existing.setStartDate(request.startDate());
        existing.setEndDate(request.endDate());
        existing.setStatus(request.status());
        existing.setUsageCount(request.usageCount() == null ? existing.getUsageCount() : request.usageCount());
        existing.setViews(request.views() == null ? existing.getViews() : request.views());
        existing.setClaimedCount(request.claimedCount() == null ? existing.getClaimedCount() : request.claimedCount());

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

    private void validatePrices(BigDecimal initialPrice, BigDecimal promotionalPrice) {
        if (initialPrice == null || promotionalPrice == null) {
            throw new IllegalArgumentException("Les prix initial et promotionnel sont obligatoires");
        }

        if (initialPrice.signum() <= 0 || promotionalPrice.signum() <= 0) {
            throw new IllegalArgumentException("Les prix doivent etre superieurs a 0");
        }

        if (promotionalPrice.compareTo(initialPrice) >= 0) {
            throw new IllegalArgumentException("Le prix promotionnel doit etre inferieur au prix initial.");
        }
    }

    private String calculateDiscountLabel(BigDecimal initialPrice, BigDecimal promotionalPrice) {
        BigDecimal reduction = initialPrice.subtract(promotionalPrice)
                .multiply(BigDecimal.valueOf(100))
                .divide(initialPrice, 2, RoundingMode.HALF_UP)
                .stripTrailingZeros();
        return "-" + reduction.toPlainString() + "%";
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
