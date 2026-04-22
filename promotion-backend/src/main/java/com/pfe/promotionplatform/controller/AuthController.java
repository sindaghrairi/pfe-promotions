package com.pfe.promotionplatform.controller;

import java.security.Principal;
import java.util.Map;
import org.springframework.web.bind.annotation.PathVariable;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.pfe.promotionplatform.dto.AdminRegisterRequest;
import com.pfe.promotionplatform.dto.AdminSubscriptionResponse;
import com.pfe.promotionplatform.dto.AdminSubscribeRequest;
import com.pfe.promotionplatform.dto.AuthResponse;
import com.pfe.promotionplatform.dto.LoginRequest;
import com.pfe.promotionplatform.dto.MessageResponse;
import com.pfe.promotionplatform.dto.RegisterRequest;
import com.pfe.promotionplatform.service.AuthService;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/auth")
@Validated
@RequiredArgsConstructor
public class AuthController {

    private static final Logger log = LoggerFactory.getLogger(AuthController.class);

    private final AuthService authService;

    @PostMapping("/admin/subscribe")
    public ResponseEntity<MessageResponse> adminSubscribe(@Valid @RequestBody AdminSubscribeRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(authService.adminSubscribe(request));
    }

    @PostMapping("/admin/register")
    public ResponseEntity<AuthResponse> adminRegister(@Valid @RequestBody AdminRegisterRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(authService.adminRegister(request));
    }

    @PostMapping("/admin/login")
    public ResponseEntity<AuthResponse> adminLogin(@Valid @RequestBody LoginRequest request) {
        log.info("POST /api/auth/admin/login for email={}", request.getEmail());
        return ResponseEntity.ok(authService.adminLogin(request));
    }

    @PostMapping("/platform-admin/login")
    public ResponseEntity<AuthResponse> platformAdminLogin(@Valid @RequestBody LoginRequest request) {
        log.info("POST /api/auth/platform-admin/login for email={}", request.getEmail());
        return ResponseEntity.ok(authService.platformAdminLogin(request));
    }

    @PostMapping("/register")
    public ResponseEntity<AuthResponse> register(@Valid @RequestBody RegisterRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(authService.register(request));
    }

    @PostMapping("/login")
    public ResponseEntity<AuthResponse> login(@Valid @RequestBody LoginRequest request) {
        log.info("POST /api/auth/login for email={}", request.getEmail());
        return ResponseEntity.ok(authService.login(request));
    }

    @GetMapping("/me")
    public ResponseEntity<Map<String, String>> me(Principal principal) {
        return ResponseEntity.ok(authService.me(principal.getName()));
    }

    @GetMapping("/platform-admin/me")
    @PreAuthorize("hasRole('PLATFORM_ADMIN')")
    public ResponseEntity<Map<String, String>> platformAdminMe(Principal principal) {
        return ResponseEntity.ok(authService.platformAdminMe(principal.getName()));
    }

    @GetMapping("/admin/subscription/me")
    public ResponseEntity<AdminSubscriptionResponse> adminSubscriptionMe(Principal principal) {
        return ResponseEntity.ok(authService.adminSubscriptionMe(principal.getName()));
    }

    @GetMapping("/admin/subscription/company")
    public ResponseEntity<AdminSubscriptionResponse> adminSubscriptionByCompanyName(@RequestParam String companyName) {
        return ResponseEntity.ok(authService.adminSubscriptionByCompanyName(companyName));
    }

    @GetMapping("/admin/account-exists")
    public ResponseEntity<Map<String, Boolean>> adminAccountExists(
            @RequestParam(required = false) String email,
            @RequestParam(required = false) String companyName) {
        return ResponseEntity.ok(authService.adminAccountExists(email, companyName));
    }

    @GetMapping("/admin/plan/{id}")
    public ResponseEntity<Map<String, Object>> getPlanById(@PathVariable Long id) {
    return ResponseEntity.ok(authService.getPlanById(id));
    }
}
