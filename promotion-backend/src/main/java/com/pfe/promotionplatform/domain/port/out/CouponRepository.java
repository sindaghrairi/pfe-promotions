package com.pfe.promotionplatform.domain.port.out;

import java.util.Optional;
import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.repository.query.Param;
import org.springframework.data.jpa.repository.Query;

import com.pfe.promotionplatform.domain.model.Coupon;

public interface CouponRepository extends JpaRepository<Coupon, Long> {
    Optional<Coupon> findByPromotion_Id(Long promotionId);

    @Query("""
        select c
        from Coupon c
        join fetch c.promotion p
        where p.companySlug = :companySlug
        order by p.createdAt desc, c.id desc
    """)
    List<Coupon> findCompanyCoupons(@Param("companySlug") String companySlug);
}
