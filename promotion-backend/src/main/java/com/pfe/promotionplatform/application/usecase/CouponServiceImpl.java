package com.pfe.promotionplatform.application.usecase;

import java.util.List;
import java.util.Optional;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.pfe.promotionplatform.domain.model.Coupon;
import com.pfe.promotionplatform.domain.model.Promotion;
import com.pfe.promotionplatform.domain.model.PromotionStatus;
import com.pfe.promotionplatform.domain.port.out.CouponRepository;
import com.pfe.promotionplatform.domain.port.in.CouponService;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class CouponServiceImpl implements CouponService {

    private final CouponRepository couponRepository;

    @Override
    public List<Coupon> listCoupons() {
        return couponRepository.findAll();
    }

    @Override
    public Optional<Coupon> findByPromotionId(Long promotionId) {
        return couponRepository.findByPromotion_Id(promotionId);
    }

    @Override
    @Transactional
    public Coupon syncFromPromotion(Promotion promotion) {
        Coupon coupon = findExistingOrNewCoupon(promotion);
        coupon.setCode(normalizeCouponCode(promotion.getCouponCode()));
        coupon.setExpirationDate(promotion.getEndDate());
        coupon.setStatus(promotion.getStatus());
        coupon.setUsedCount(defaultNumber(promotion.getClaimedCount()));
        coupon.setAllowedCount(defaultNumber(promotion.getUsageCount()));
        coupon.setPromotion(promotion);
        promotion.setCoupon(coupon);
        return couponRepository.save(coupon);
    }

    @Override
    @Transactional(readOnly = true)
    public Promotion hydrateLegacyFields(Promotion promotion) {
        if (promotion == null || promotion.getId() == null) {
            return promotion;
        }

        couponRepository.findByPromotion_Id(promotion.getId()).ifPresent(coupon -> {
            promotion.setCouponCode(coupon.getCode());
            promotion.setUsageCount(defaultNumber(coupon.getAllowedCount()));
            promotion.setClaimedCount(defaultNumber(coupon.getUsedCount()));
        });
        return promotion;
    }

    @Override
    @Transactional
    public Promotion claimCoupon(Promotion promotion) {
        Coupon coupon = findExistingOrNewCoupon(promotion);
        String code = normalizeCouponCode(coupon.getCode());
        if (code == null) {
            throw new IllegalArgumentException("Aucun coupon disponible pour cette promotion");
        }

        int remaining = defaultNumber(coupon.getAllowedCount());
        if (remaining <= 0) {
            coupon.setAllowedCount(0);
            coupon.setStatus(PromotionStatus.EXPIRED);
            promotion.setStatus(PromotionStatus.EXPIRED);
            syncLegacyFields(promotion, coupon);
            couponRepository.save(coupon);
            return promotion;
        }

        int nextRemaining = remaining - 1;
        coupon.setAllowedCount(nextRemaining);
        coupon.setUsedCount(defaultNumber(coupon.getUsedCount()) + 1);
        if (nextRemaining == 0) {
            coupon.setStatus(PromotionStatus.EXPIRED);
            promotion.setStatus(PromotionStatus.EXPIRED);
        }

        syncLegacyFields(promotion, coupon);
        couponRepository.save(coupon);
        return promotion;
    }

    private Coupon findExistingOrNewCoupon(Promotion promotion) {
        if (promotion == null || promotion.getId() == null) {
            throw new IllegalArgumentException("Promotion obligatoire pour creer un coupon");
        }

        return couponRepository.findByPromotion_Id(promotion.getId())
                .orElseGet(() -> Coupon.builder()
                        .promotion(promotion)
                        .code(normalizeCouponCode(promotion.getCouponCode()))
                        .expirationDate(promotion.getEndDate())
                        .status(promotion.getStatus())
                        .usedCount(defaultNumber(promotion.getClaimedCount()))
                        .allowedCount(defaultNumber(promotion.getUsageCount()))
                        .build());
    }

    private void syncLegacyFields(Promotion promotion, Coupon coupon) {
        promotion.setCouponCode(normalizeCouponCode(coupon.getCode()));
        promotion.setUsageCount(defaultNumber(coupon.getAllowedCount()));
        promotion.setClaimedCount(defaultNumber(coupon.getUsedCount()));
    }

    private int defaultNumber(Integer value) {
        return value == null ? 0 : value;
    }

    private String normalizeCouponCode(String code) {
        if (code == null) {
            return null;
        }

        String normalized = code.trim().toUpperCase();
        return normalized.isEmpty() ? null : normalized;
    }
}
