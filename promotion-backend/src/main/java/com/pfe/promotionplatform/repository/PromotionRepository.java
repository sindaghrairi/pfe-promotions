package com.pfe.promotionplatform.repository;

import java.util.Collection;
import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

import com.pfe.promotionplatform.entity.Promotion;
import com.pfe.promotionplatform.entity.PromotionStatus;

public interface PromotionRepository extends JpaRepository<Promotion, Long> {
    List<Promotion> findByCompanySlugOrderByIdDesc(String companySlug);

    List<Promotion> findByCompanySlugAndStatusInOrderByIdDesc(String companySlug, Collection<PromotionStatus> statuses);

    List<Promotion> findByStatusInOrderByIdDesc(Collection<PromotionStatus> statuses);

    List<String> findDistinctCompanySlugByStatusInOrderByCompanySlugAsc(Collection<PromotionStatus> statuses);
}
