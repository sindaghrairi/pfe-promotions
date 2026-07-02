package com.pfe.promotionplatform.presentation.controller;

import java.security.Principal;
import java.util.List;
import java.util.Map;

import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.pfe.promotionplatform.application.usecase.PlatformAdminDashboardService;
import com.pfe.promotionplatform.application.usecase.PlatformAdminInvoiceService;
import com.pfe.promotionplatform.application.usecase.PlatformAdminPromotionService;
import com.pfe.promotionplatform.application.usecase.PlatformAdminSubscriptionService;
import com.pfe.promotionplatform.application.usecase.PlatformAdminUserService;

import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/platform-admin")
@RequiredArgsConstructor
@PreAuthorize("hasRole('PLATFORM_ADMIN')")
public class AdminplatformController {

	private final PlatformAdminDashboardService platformAdminDashboardService;
	private final PlatformAdminUserService platformAdminUserService;
	private final PlatformAdminSubscriptionService platformAdminSubscriptionService;
	private final PlatformAdminPromotionService platformAdminPromotionService;
	private final PlatformAdminInvoiceService platformAdminInvoiceService;

	@GetMapping("/dashboard/stats")
	public ResponseEntity<Map<String, Object>> dashboardStats() {
		return ResponseEntity.ok(platformAdminDashboardService.dashboardStats());
	}

	@GetMapping("/dashboard/acquisition-stats")
	public ResponseEntity<Map<String, Object>> acquisitionStats() {
		return ResponseEntity.ok(platformAdminDashboardService.acquisitionStats());
	}

	@GetMapping("/users")
	public ResponseEntity<List<Map<String, Object>>> listUsers() {
		return ResponseEntity.ok(platformAdminUserService.listUsers());
	}

	@PutMapping("/users/{userId}/role")
	public ResponseEntity<Map<String, Object>> updateUserRole(
			@PathVariable Long userId,
			@RequestBody UpdateUserRoleRequest request,
			Principal principal) {
		return ResponseEntity.ok(platformAdminUserService.updateUserRole(
				userId,
				request == null ? null : request.getRole(),
				principal));
	}

	@PatchMapping("/users/{userId}/status")
	public ResponseEntity<Map<String, Object>> updateUserStatus(
			@PathVariable Long userId,
			@RequestBody UpdateActiveStatusRequest request,
			Principal principal) {
		return ResponseEntity.ok(platformAdminUserService.updateUserStatus(
				userId,
				request == null ? null : request.getActive(),
				principal));
	}

	@DeleteMapping("/users/{userId}")
	public ResponseEntity<Void> deleteUser(@PathVariable Long userId, Principal principal) {
		platformAdminUserService.deleteUser(userId, principal);
		return ResponseEntity.noContent().build();
	}

	@GetMapping("/subscriptions")
	public ResponseEntity<List<Map<String, Object>>> listSubscriptions() {
		return ResponseEntity.ok(platformAdminSubscriptionService.listSubscriptions());
	}

	@PatchMapping("/subscriptions/{subscriptionId}/status")
	public ResponseEntity<Map<String, Object>> updateSubscriptionStatus(
			@PathVariable Long subscriptionId,
			@RequestBody UpdateActiveStatusRequest request) {
		return ResponseEntity.ok(platformAdminSubscriptionService.updateSubscriptionStatus(
				subscriptionId,
				request == null ? null : request.getActive()));
	}

	@GetMapping("/promotions")
	public ResponseEntity<List<Map<String, Object>>> listPromotions() {
		return ResponseEntity.ok(platformAdminPromotionService.listPromotions());
	}

	@GetMapping("/invoices")
	public ResponseEntity<Map<String, Object>> listInvoices() {
		return ResponseEntity.ok(platformAdminInvoiceService.listInvoices());
	}

	@GetMapping("/invoices/{invoiceId}")
	public ResponseEntity<Map<String, Object>> getInvoiceById(@PathVariable Long invoiceId) {
		return ResponseEntity.ok(platformAdminInvoiceService.getInvoiceById(invoiceId));
	}

	@PatchMapping("/invoices/{invoiceId}/mark-paid")
	public ResponseEntity<Map<String, Object>> markInvoicePaid(@PathVariable Long invoiceId) {
		return ResponseEntity.ok(platformAdminInvoiceService.markInvoicePaid(invoiceId));
	}

	public static class UpdateUserRoleRequest {
		private String role;

		public String getRole() {
			return role;
		}

		public void setRole(String role) {
			this.role = role;
		}
	}

	public static class UpdateActiveStatusRequest {
		private Boolean active;

		public Boolean getActive() {
			return active;
		}

		public void setActive(Boolean active) {
			this.active = active;
		}
	}
}
