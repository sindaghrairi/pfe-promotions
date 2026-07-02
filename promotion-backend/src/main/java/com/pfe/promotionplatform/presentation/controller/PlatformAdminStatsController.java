package com.pfe.promotionplatform.presentation.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.pfe.promotionplatform.presentation.dto.PlatformAdminDashboardDto;
import com.pfe.promotionplatform.application.usecase.PlatformAdminStatsService;

import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/platform-admin/stats")
@RequiredArgsConstructor
@PreAuthorize("hasRole('PLATFORM_ADMIN')")
public class PlatformAdminStatsController {

    private final PlatformAdminStatsService platformAdminStatsService;

    @GetMapping("/dashboard")
    public ResponseEntity<PlatformAdminDashboardDto> dashboard(
            @RequestParam(defaultValue = "12m") String period) {
        return ResponseEntity.ok(platformAdminStatsService.getDashboard(period));
    }
}
