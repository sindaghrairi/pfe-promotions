package com.pfe.promotionplatform.domain.port.out;

import java.time.LocalDateTime;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import com.pfe.promotionplatform.domain.model.Promotion;
import com.pfe.promotionplatform.domain.model.PromotionStatus;

public interface PromotionRepository extends JpaRepository<Promotion, Long> {
    List<Promotion> findByCompanySlugOrderByIdDesc(String companySlug);
    long countByCreatedAtBetween(LocalDateTime start, LocalDateTime end);

    @Query("SELECT MAX(p.createdAt) FROM Promotion p")
    Optional<LocalDateTime> findMaxCreatedAt();

    List<Promotion> findByCompanySlugAndStatusInOrderByIdDesc(String companySlug, Collection<PromotionStatus> statuses);

    List<Promotion> findByStatusInOrderByIdDesc(Collection<PromotionStatus> statuses);

    List<String> findDistinctCompanySlugByStatusInOrderByCompanySlugAsc(Collection<PromotionStatus> statuses);
}
