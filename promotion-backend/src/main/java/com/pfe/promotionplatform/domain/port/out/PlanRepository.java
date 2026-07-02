package com.pfe.promotionplatform.domain.port.out;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

import com.pfe.promotionplatform.domain.model.Plan;

public interface PlanRepository extends JpaRepository<Plan, Long> {
    boolean existsByNameIgnoreCase(String name);
    Optional<Plan> findByNameIgnoreCase(String name);
}
