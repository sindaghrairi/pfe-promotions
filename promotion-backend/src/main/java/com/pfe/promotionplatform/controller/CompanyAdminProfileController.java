package com.pfe.promotionplatform.controller;

import java.security.Principal;

import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.pfe.promotionplatform.dto.ChangePasswordRequest;
import com.pfe.promotionplatform.dto.AdminSubscriptionResponse;
import com.pfe.promotionplatform.dto.CompanyAdminProfileResponse;
import com.pfe.promotionplatform.dto.CompanyAdminProfileUpdateRequest;
import com.pfe.promotionplatform.dto.CompanySubscriptionUpdateRequest;
import com.pfe.promotionplatform.dto.MessageResponse;
import com.pfe.promotionplatform.dto.SetPasswordRequest;
import com.pfe.promotionplatform.service.AccountService;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/company-admin")
@PreAuthorize("hasRole('ADMIN')")
@RequiredArgsConstructor
public class CompanyAdminProfileController {

    private final AccountService accountService;

    @GetMapping("/profile")
    public ResponseEntity<CompanyAdminProfileResponse> profile(Principal principal) {
        return ResponseEntity.ok(accountService.companyAdminProfile(principal.getName()));
    }

    @PutMapping("/profile")
    public ResponseEntity<CompanyAdminProfileResponse> updateProfile(
            Principal principal,
            @Valid @RequestBody CompanyAdminProfileUpdateRequest request) {
        return ResponseEntity.ok(accountService.updateCompanyAdminProfile(principal.getName(), request));
    }

    @PatchMapping("/password")
    public ResponseEntity<MessageResponse> changePassword(
            Principal principal,
            @Valid @RequestBody ChangePasswordRequest request) {
        return ResponseEntity.ok(accountService.changeCompanyAdminPassword(principal.getName(), request));
    }

    @PatchMapping("/set-password")
    public ResponseEntity<MessageResponse> setPassword(
            Principal principal,
            @Valid @RequestBody SetPasswordRequest request) {
        return ResponseEntity.ok(accountService.setCompanyAdminPassword(principal.getName(), request));
    }

    @PatchMapping("/subscription")
    public ResponseEntity<CompanyAdminProfileResponse> updateSubscription(
            Principal principal,
            @Valid @RequestBody CompanySubscriptionUpdateRequest request) {
        return ResponseEntity.ok(accountService.updateCompanySubscription(principal.getName(), request));
    }

    @GetMapping("/subscription")
    public ResponseEntity<AdminSubscriptionResponse> subscription(Principal principal) {
        return ResponseEntity.ok(accountService.companyAdminSubscription(principal.getName()));
    }

    @PatchMapping("/subscription/reactivate")
    public ResponseEntity<AdminSubscriptionResponse> reactivateSubscription(Principal principal) {
        return ResponseEntity.ok(accountService.reactivateCompanySubscription(principal.getName()));
    }
}
