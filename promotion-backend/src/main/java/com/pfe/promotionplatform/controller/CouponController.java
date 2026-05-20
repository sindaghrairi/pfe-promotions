package com.pfe.promotionplatform.controller;

import java.util.List;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.pfe.promotionplatform.entity.Coupon;
import com.pfe.promotionplatform.service.CouponService;

import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/coupons")
@RequiredArgsConstructor
public class CouponController {

    private final CouponService couponService;

    @GetMapping
    public ResponseEntity<List<Coupon>> listCoupons() {
        return ResponseEntity.ok(couponService.listCoupons());
    }

    @GetMapping("/promotion/{promotionId}")
    public ResponseEntity<Coupon> getCouponByPromotion(@PathVariable Long promotionId) {
        return couponService.findByPromotionId(promotionId)
                .map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.notFound().build());
    }
}
