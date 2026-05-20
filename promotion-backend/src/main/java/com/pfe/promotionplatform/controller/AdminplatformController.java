package com.pfe.promotionplatform.controller;

import java.security.Principal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Stream;

import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.pfe.promotionplatform.entity.AdminSubscription;
import com.pfe.promotionplatform.entity.Invoice;
import com.pfe.promotionplatform.entity.Promotion;
import com.pfe.promotionplatform.entity.PromotionStatus;
import com.pfe.promotionplatform.entity.Role;
import com.pfe.promotionplatform.entity.User;
import com.pfe.promotionplatform.repository.AdminSubscriptionRepository;
import com.pfe.promotionplatform.repository.InvoiceRepository;
import com.pfe.promotionplatform.repository.PromotionRepository;
import com.pfe.promotionplatform.repository.UserRepository;

import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/platform-admin")
@RequiredArgsConstructor
@PreAuthorize("hasRole('PLATFORM_ADMIN')")
public class AdminplatformController {

	private final UserRepository userRepository;
	private final AdminSubscriptionRepository adminSubscriptionRepository;
	private final PromotionRepository promotionRepository;
	private final InvoiceRepository invoiceRepository;

	@GetMapping("/dashboard/stats")
	public ResponseEntity<Map<String, Object>> dashboardStats() {
		List<User> users = userRepository.findAll();
		List<AdminSubscription> subscriptions = adminSubscriptionRepository.findAll();
		List<Promotion> promotions = promotionRepository.findAll();

		long totalUsers = users.size();
		long totalClients = users.stream().filter(user -> user.getRole() == Role.CLIENT).count();
		long totalCompanyAdmins = users.stream().filter(user -> user.getRole() == Role.ADMIN).count();
		long totalPlatformAdmins = users.stream().filter(user -> user.getRole() == Role.PLATFORM_ADMIN).count();

		long activeSubscriptions = subscriptions.stream().filter(subscription -> Boolean.TRUE.equals(subscription.getActive())).count();
		long inactiveSubscriptions = subscriptions.size() - activeSubscriptions;

		long activePromotions = promotions.stream().filter(promo -> promo.getStatus() == PromotionStatus.ACTIVE).count();
		long expiredPromotions = promotions.stream().filter(promo -> promo.getStatus() == PromotionStatus.EXPIRED).count();
		long scheduledPromotions = promotions.stream().filter(promo -> promo.getStatus() == PromotionStatus.SCHEDULED).count();
		long draftPromotions = promotions.stream().filter(promo -> promo.getStatus() == PromotionStatus.DRAFT).count();

		Map<String, Object> stats = new LinkedHashMap<>();
		stats.put("totalUsers", totalUsers);
		stats.put("totalClients", totalClients);
		stats.put("totalCompanyAdmins", totalCompanyAdmins);
		stats.put("totalPlatformAdmins", totalPlatformAdmins);
		stats.put("activeSubscriptions", activeSubscriptions);
		stats.put("inactiveSubscriptions", inactiveSubscriptions);
		stats.put("totalPromotions", promotions.size());
		stats.put("activePromotions", activePromotions);
		stats.put("expiredPromotions", expiredPromotions);
		stats.put("scheduledPromotions", scheduledPromotions);
		stats.put("draftPromotions", draftPromotions);

		return ResponseEntity.ok(stats);
	}

	@GetMapping("/dashboard/acquisition-stats")
	public ResponseEntity<Map<String, Object>> acquisitionStats() {
		LocalDate today = LocalDate.now();

		// Anchor the 7-day window on the most recent activity date.
		// If all data is older than 6 days, shift the window backwards so the chart shows real data.
		Optional<LocalDateTime> maxUser = userRepository.findMaxCreatedAt();
		Optional<LocalDateTime> maxSub  = adminSubscriptionRepository.findMaxCreatedAt();
		Optional<LocalDateTime> maxPromo = promotionRepository.findMaxCreatedAt();

		LocalDate endDate = Stream.of(maxUser, maxSub, maxPromo)
				.filter(Optional::isPresent)
				.map(opt -> opt.get().toLocalDate())
				.max(Comparator.naturalOrder())
				.filter(d -> d.isBefore(today.minusDays(6)))
				.orElse(today);

		List<String> labels = new ArrayList<>();
		List<Long> users = new ArrayList<>();
		List<Long> companies = new ArrayList<>();
		List<Long> promos = new ArrayList<>();

		for (int i = 6; i >= 0; i--) {
			LocalDate date = endDate.minusDays(i);
			LocalDateTime start = date.atStartOfDay();
			LocalDateTime end = date.atTime(23, 59, 59, 999_999_999);

			labels.add(i == 0 ? "J0" : "J-" + i);
			users.add(userRepository.countByCreatedAtBetween(start, end));
			companies.add(adminSubscriptionRepository.countByCreatedAtBetween(start, end));
			promos.add(promotionRepository.countByCreatedAtBetween(start, end));
		}

		Map<String, Object> result = new LinkedHashMap<>();
		result.put("labels", labels);
		result.put("users", users);
		result.put("companies", companies);
		result.put("promos", promos);
		return ResponseEntity.ok(result);
	}

	@GetMapping("/users")
	public ResponseEntity<List<Map<String, Object>>> listUsers() {
		List<Map<String, Object>> response = userRepository.findAll().stream()
				.sorted(Comparator.comparing(User::getCreatedAt, Comparator.nullsLast(Comparator.reverseOrder())))
				.map(this::toUserDto)
				.toList();

		return ResponseEntity.ok(response);
	}

	@PutMapping("/users/{userId}/role")
	public ResponseEntity<Map<String, Object>> updateUserRole(
			@PathVariable Long userId,
			@RequestBody UpdateUserRoleRequest request,
			Principal principal) {
		if (request == null || request.getRole() == null) {
			throw new IllegalArgumentException("Le role est obligatoire");
		}

		User target = userRepository.findById(userId)
				.orElseThrow(() -> new IllegalArgumentException("Utilisateur introuvable"));

		Role newRole;
		try {
			newRole = Role.valueOf(request.getRole().trim().toUpperCase());
		} catch (IllegalArgumentException ex) {
			throw new IllegalArgumentException("Role invalide. Roles autorises: CLIENT, ADMIN, PLATFORM_ADMIN");
		}

		if (principal != null && target.getEmail() != null
				&& target.getEmail().equalsIgnoreCase(principal.getName())
				&& newRole != Role.PLATFORM_ADMIN) {
			throw new IllegalArgumentException("Vous ne pouvez pas retirer votre propre role PLATFORM_ADMIN");
		}

		target.setRole(newRole);
		userRepository.save(target);

		return ResponseEntity.ok(toUserDto(target));
	}

	@DeleteMapping("/users/{userId}")
	public ResponseEntity<Void> deleteUser(@PathVariable Long userId, Principal principal) {
		User target = userRepository.findById(userId)
				.orElseThrow(() -> new IllegalArgumentException("Utilisateur introuvable"));

		if (principal != null && target.getEmail() != null && target.getEmail().equalsIgnoreCase(principal.getName())) {
			throw new IllegalArgumentException("Vous ne pouvez pas supprimer votre propre compte");
		}

		if (target.getRole() == Role.ADMIN && target.getEmail() != null) {
			adminSubscriptionRepository.findByContactEmailIgnoreCase(target.getEmail()).ifPresent(subscription -> {
				subscription.setActive(false);
				adminSubscriptionRepository.save(subscription);
			});
		}

		userRepository.delete(target);
		return ResponseEntity.noContent().build();
	}

	@GetMapping("/subscriptions")
	public ResponseEntity<List<Map<String, Object>>> listSubscriptions() {
		List<Map<String, Object>> response = adminSubscriptionRepository.findAll().stream()
				.sorted(Comparator.comparing(AdminSubscription::getCreatedAt, Comparator.nullsLast(Comparator.reverseOrder())))
				.map(this::toSubscriptionDto)
				.toList();

		return ResponseEntity.ok(response);
	}

	@GetMapping("/promotions")
	public ResponseEntity<List<Map<String, Object>>> listPromotions() {
		List<Map<String, Object>> response = promotionRepository.findAll().stream()
				.map(this::toPromotionDto)
				.toList();

		return ResponseEntity.ok(response);
	}

	@GetMapping("/invoices")
	public ResponseEntity<Map<String, Object>> listInvoices() {
		List<Map<String, Object>> items = invoiceRepository.findAllByOrderByIssuedAtDesc().stream()
				.map(this::toInvoiceDto)
				.toList();

		Map<String, Object> response = new LinkedHashMap<>();
		response.put("message", items.isEmpty() ? "Aucune facture disponible" : "Factures chargees avec succes");
		response.put("items", items);
		response.put("total", items.size());

		return ResponseEntity.ok(response);
	}

	@GetMapping("/invoices/{invoiceId}")
	public ResponseEntity<Map<String, Object>> getInvoiceById(@PathVariable Long invoiceId) {
		Invoice invoice = invoiceRepository.findById(invoiceId)
				.orElseThrow(() -> new IllegalArgumentException("Facture introuvable"));

		return ResponseEntity.ok(toInvoiceDto(invoice));
	}

	private Map<String, Object> toUserDto(User user) {
		Map<String, Object> dto = new LinkedHashMap<>();
		dto.put("id", user.getId());
		dto.put("fullName", user.getFullName());
		dto.put("email", user.getEmail());
		dto.put("role", user.getRole());
		dto.put("createdAt", user.getCreatedAt());
		return dto;
	}

	private Map<String, Object> toSubscriptionDto(AdminSubscription subscription) {
		Map<String, Object> dto = new LinkedHashMap<>();
		dto.put("id", subscription.getId());
		dto.put("companyName", subscription.getCompanyName());
		dto.put("contactEmail", subscription.getContactEmail());
		dto.put("plan", subscription.getPlan());
		dto.put("active", subscription.getActive());
		dto.put("createdAt", subscription.getCreatedAt());
		return dto;
	}

	private Map<String, Object> toInvoiceDto(Invoice invoice) {
		Map<String, Object> dto = new LinkedHashMap<>();
		dto.put("id", invoice.getId());
		dto.put("companyName", invoice.getCompanyName());
		dto.put("companyEmail", invoice.getCompanyEmail());
		dto.put("plan", invoice.getPlan());
		dto.put("amount", invoice.getAmount());
		dto.put("status", invoice.getStatus());
		dto.put("issuedAt", invoice.getIssuedAt());
		dto.put("dueAt", invoice.getDueAt());
		dto.put("paidAt", invoice.getPaidAt());
		dto.put("createdAt", invoice.getCreatedAt());
		return dto;
	}

	private Map<String, Object> toPromotionDto(Promotion promotion) {
		Map<String, Object> dto = new LinkedHashMap<>();
		dto.put("id", promotion.getId());
		dto.put("companySlug", promotion.getCompanySlug());
		dto.put("status", promotion.getStatus());
		dto.put("startDate", promotion.getStartDate());
		dto.put("endDate", promotion.getEndDate());
		dto.put("createdAt", promotion.getCreatedAt());
		dto.put("views", promotion.getViews() != null ? promotion.getViews() : 0);
		dto.put("usageCount", promotion.getUsageCount() != null ? promotion.getUsageCount() : 0);
		dto.put("claimedCount", promotion.getClaimedCount() != null ? promotion.getClaimedCount() : 0);
		return dto;
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
}
