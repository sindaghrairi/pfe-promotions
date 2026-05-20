package com.pfe.promotionplatform.controller;

import java.security.Principal;
import java.util.List;

import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.pfe.promotionplatform.dto.CompanyAdminDashboardResponse;
import com.pfe.promotionplatform.dto.CompanyCouponResponse;
import com.pfe.promotionplatform.service.CompanyAdminDashboardService;

import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/company-admin")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
public class CompanyAdminDashboardController {

    private final CompanyAdminDashboardService companyAdminDashboardService;

    @GetMapping("/dashboard")
    public ResponseEntity<CompanyAdminDashboardResponse> dashboard(
            @RequestParam(defaultValue = "12m") String period,
            Principal principal) {
        return ResponseEntity.ok(companyAdminDashboardService.getDashboard(principal.getName(), period));
    }

    @GetMapping("/coupons")
    public ResponseEntity<List<CompanyCouponResponse>> coupons(Principal principal) {
        return ResponseEntity.ok(companyAdminDashboardService.getCoupons(principal.getName()));
    }
}
