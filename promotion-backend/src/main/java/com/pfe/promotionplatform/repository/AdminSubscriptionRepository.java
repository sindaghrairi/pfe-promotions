package com.pfe.promotionplatform.repository;

import java.time.LocalDateTime;
import java.util.Optional;

import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.transaction.annotation.Transactional;

import com.pfe.promotionplatform.entity.AdminSubscription;

public interface AdminSubscriptionRepository extends JpaRepository<AdminSubscription, Long> {
    boolean existsByContactEmailIgnoreCaseAndActiveTrue(String contactEmail);
    Optional<AdminSubscription> findByContactEmailIgnoreCase(String contactEmail);
    Optional<AdminSubscription> findByContactEmailIgnoreCaseAndActiveTrue(String contactEmail);
    Optional<AdminSubscription> findTopByCompanyNameIgnoreCaseAndActiveTrueOrderByCreatedAtDesc(String companyName);
    long countByCreatedAtBetween(LocalDateTime start, LocalDateTime end);

    @Query("SELECT MAX(s.createdAt) FROM AdminSubscription s")
    Optional<LocalDateTime> findMaxCreatedAt();

    @Modifying
    @Transactional
    @Query("""
        update AdminSubscription s
        set s.plan = case
            when upper(s.plan) = 'PRO' then 'PREMIUM'
            when upper(s.plan) = 'ENTERPRISE' then 'STANDARD'
            else upper(s.plan)
        end
        where upper(s.plan) in ('PRO', 'ENTERPRISE', 'BASIC', 'STANDARD', 'PREMIUM')
    """)
    int normalizePlans();
}