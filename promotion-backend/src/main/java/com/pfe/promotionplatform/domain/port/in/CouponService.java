package com.pfe.promotionplatform.domain.port.in;

import java.util.List;
import java.util.Optional;

import com.pfe.promotionplatform.domain.model.Coupon;
import com.pfe.promotionplatform.domain.model.Promotion;

public interface CouponService {
    List<Coupon> listCoupons();

    Optional<Coupon> findByPromotionId(Long promotionId);

    Coupon syncFromPromotion(Promotion promotion);

    Promotion hydrateLegacyFields(Promotion promotion);

    Promotion claimCoupon(Promotion promotion);
}
