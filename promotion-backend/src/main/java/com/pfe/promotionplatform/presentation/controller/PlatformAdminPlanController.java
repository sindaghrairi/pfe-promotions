package com.pfe.promotionplatform.presentation.controller;

import java.util.List;

import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.pfe.promotionplatform.presentation.dto.PlatformAdminPlanDto;
import com.pfe.promotionplatform.presentation.dto.PlatformAdminPlanStatusRequest;
import com.pfe.promotionplatform.presentation.dto.PlatformAdminPlanUpdateRequest;
import com.pfe.promotionplatform.domain.port.in.PlatformAdminPlanService;

import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/platform-admin/plans")
@RequiredArgsConstructor
@PreAuthorize("hasRole('PLATFORM_ADMIN')")
public class PlatformAdminPlanController {

    private final PlatformAdminPlanService platformAdminPlanService;

    @GetMapping
    public ResponseEntity<List<PlatformAdminPlanDto>> getPlans() {
        return ResponseEntity.ok(platformAdminPlanService.getPlans());
    }

    @PutMapping("/{id}")
    public ResponseEntity<PlatformAdminPlanDto> updatePlan(
            @PathVariable Long id,
            @Valid @RequestBody PlatformAdminPlanUpdateRequest request) {
        return ResponseEntity.ok(platformAdminPlanService.updatePlan(id, request));
    }

    @PatchMapping("/{id}/status")
    public ResponseEntity<PlatformAdminPlanDto> togglePlanStatus(
            @PathVariable Long id,
            @Valid @RequestBody PlatformAdminPlanStatusRequest request) {
        return ResponseEntity.ok(platformAdminPlanService.togglePlanStatus(id, request));
    }
}
