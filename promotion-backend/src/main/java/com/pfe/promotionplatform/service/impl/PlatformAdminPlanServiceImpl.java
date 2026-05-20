package com.pfe.promotionplatform.service.impl;

import java.math.BigDecimal;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;

import jakarta.annotation.PostConstruct;
import org.springframework.stereotype.Service;

import com.pfe.promotionplatform.dto.PlatformAdminPlanDto;
import com.pfe.promotionplatform.dto.PlatformAdminPlanStatusRequest;
import com.pfe.promotionplatform.dto.PlatformAdminPlanUpdateRequest;
import com.pfe.promotionplatform.entity.Plan;
import com.pfe.promotionplatform.repository.PlanRepository;
import com.pfe.promotionplatform.service.PlatformAdminPlanService;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class PlatformAdminPlanServiceImpl implements PlatformAdminPlanService {

    private final PlanRepository planRepository;

    @PostConstruct
    void seedDefaultPlans() {
        if (planRepository.count() > 0) {
            return;
        }

        planRepository.saveAll(List.of(
                Plan.builder()
                        .name("BASIC")
                        .price(new BigDecimal("29.00"))
                        .description("Plan de depart pour publier les premieres promotions.")
                        .duration("Mensuel")
                        .active(true)
                        .build(),
                Plan.builder()
                        .name("STANDARD")
                        .price(new BigDecimal("79.00"))
                        .description("Plan equilibre pour les entreprises avec une activite reguliere.")
                        .duration("Mensuel")
                        .active(true)
                        .build(),
                Plan.builder()
                        .name("PREMIUM")
                        .price(new BigDecimal("149.00"))
                        .description("Plan avance avec plus de visibilite et un suivi prioritaire.")
                        .duration("Mensuel")
                        .active(true)
                        .build()
        ));
    }

    @Override
    public List<PlatformAdminPlanDto> getPlans() {
        return planRepository.findAll().stream()
                .sorted(Comparator.comparing(Plan::getId))
                .map(this::toDto)
                .toList();
    }

    @Override
    public PlatformAdminPlanDto updatePlan(Long id, PlatformAdminPlanUpdateRequest request) {
        Plan plan = findPlan(id);
        String normalizedName = normalizeName(request.name());

        planRepository.findByNameIgnoreCase(normalizedName)
                .filter(existing -> !existing.getId().equals(plan.getId()))
                .ifPresent(existing -> {
                    throw new IllegalArgumentException("Un autre plan utilise deja ce nom");
                });

        plan.setName(normalizedName);
        plan.setPrice(request.price());
        plan.setDescription(request.description().trim());
        plan.setDuration(normalizeOptional(request.duration()));
        plan.setActive(request.active());

        return toDto(planRepository.save(plan));
    }

    @Override
    public PlatformAdminPlanDto togglePlanStatus(Long id, PlatformAdminPlanStatusRequest request) {
        Plan plan = findPlan(id);
        plan.setActive(request.active());
        return toDto(planRepository.save(plan));
    }

    private Plan findPlan(Long id) {
        if (id == null || id <= 0) {
            throw new IllegalArgumentException("Id de plan invalide");
        }

        return planRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Plan introuvable"));
    }

    private PlatformAdminPlanDto toDto(Plan plan) {
        return new PlatformAdminPlanDto(
                plan.getId(),
                plan.getName(),
                plan.getPrice(),
                plan.getDescription(),
                plan.getDuration(),
                plan.getActive(),
                plan.getCreatedAt(),
                plan.getUpdatedAt()
        );
    }

    private String normalizeName(String name) {
        String value = name == null ? "" : name.trim().toUpperCase(Locale.ROOT);
        if (value.isBlank()) {
            throw new IllegalArgumentException("Le nom du plan est obligatoire");
        }
        return value;
    }

    private String normalizeOptional(String value) {
        if (value == null || value.trim().isEmpty()) {
            return null;
        }
        return value.trim();
    }
}
