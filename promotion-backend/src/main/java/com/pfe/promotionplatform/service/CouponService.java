package com.pfe.promotionplatform.service;

import java.util.List;
import java.util.Optional;

import com.pfe.promotionplatform.entity.Coupon;
import com.pfe.promotionplatform.entity.Promotion;

public interface CouponService {
    List<Coupon> listCoupons();

    Optional<Coupon> findByPromotionId(Long promotionId);

    Coupon syncFromPromotion(Promotion promotion);

    Promotion hydrateLegacyFields(Promotion promotion);

    Promotion claimCoupon(Promotion promotion);
}
