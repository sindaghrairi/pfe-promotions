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

import com.pfe.promotionplatform.dto.AccountProfileResponse;
import com.pfe.promotionplatform.dto.AccountProfileUpdateRequest;
import com.pfe.promotionplatform.dto.ChangePasswordRequest;
import com.pfe.promotionplatform.dto.MessageResponse;
import com.pfe.promotionplatform.dto.SetPasswordRequest;
import com.pfe.promotionplatform.service.AccountService;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/account")
@PreAuthorize("hasRole('CLIENT')")
@RequiredArgsConstructor
public class AccountController {

    private final AccountService accountService;

    @GetMapping("/me")
    public ResponseEntity<AccountProfileResponse> me(Principal principal) {
        return ResponseEntity.ok(accountService.clientProfile(principal.getName()));
    }

    @PutMapping("/me")
    public ResponseEntity<AccountProfileResponse> updateMe(
            Principal principal,
            @Valid @RequestBody AccountProfileUpdateRequest request) {
        return ResponseEntity.ok(accountService.updateClientProfile(principal.getName(), request));
    }

    @PatchMapping("/password")
    public ResponseEntity<MessageResponse> changePassword(
            Principal principal,
            @Valid @RequestBody ChangePasswordRequest request) {
        return ResponseEntity.ok(accountService.changeClientPassword(principal.getName(), request));
    }

    @PatchMapping("/set-password")
    public ResponseEntity<MessageResponse> setPassword(
            Principal principal,
            @Valid @RequestBody SetPasswordRequest request) {
        return ResponseEntity.ok(accountService.setClientPassword(principal.getName(), request));
    }
}
