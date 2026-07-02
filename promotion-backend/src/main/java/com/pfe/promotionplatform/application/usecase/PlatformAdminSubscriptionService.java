package com.pfe.promotionplatform.application.usecase;

import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.springframework.stereotype.Service;

import com.pfe.promotionplatform.domain.model.AdminSubscription;
import com.pfe.promotionplatform.domain.model.AdminSubscriptionStatus;
import com.pfe.promotionplatform.domain.model.Invoice;
import com.pfe.promotionplatform.domain.model.Role;
import com.pfe.promotionplatform.domain.port.out.AdminSubscriptionRepository;
import com.pfe.promotionplatform.domain.port.out.InvoiceRepository;
import com.pfe.promotionplatform.domain.port.out.UserRepository;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class PlatformAdminSubscriptionService {

    private final AdminSubscriptionRepository adminSubscriptionRepository;
    private final UserRepository userRepository;
    private final InvoiceRepository invoiceRepository;
    private final SubscriptionStatusService subscriptionStatusService;

    public List<Map<String, Object>> listSubscriptions() {
        return adminSubscriptionRepository.findAll().stream()
                .sorted(Comparator.comparing(AdminSubscription::getCreatedAt, Comparator.nullsLast(Comparator.reverseOrder())))
                .map(this::toSubscriptionDto)
                .toList();
    }

    public Map<String, Object> updateSubscriptionStatus(Long subscriptionId, Boolean active) {
        if (active == null) {
            throw new IllegalArgumentException("Le statut est obligatoire");
        }

        AdminSubscription subscription = adminSubscriptionRepository.findById(subscriptionId)
                .orElseThrow(() -> new IllegalArgumentException("Abonnement introuvable"));

        subscription.setActive(active);
        subscription.setStatus(Boolean.TRUE.equals(active)
                ? AdminSubscriptionStatus.ACTIVE
                : AdminSubscriptionStatus.CANCELED);
        adminSubscriptionRepository.save(subscription);

        userRepository.findByEmailIgnoreCase(subscription.getContactEmail()).ifPresent(user -> {
            if (user.getRole() == Role.ADMIN) {
                user.setActive(active);
                userRepository.save(user);
            }
        });

        return toSubscriptionDto(subscription);
    }

    private Map<String, Object> toSubscriptionDto(AdminSubscription subscription) {
        Invoice latestInvoice = latestInvoice(subscription);
        AdminSubscriptionStatus status = refreshAndComputeSubscriptionStatus(subscription, latestInvoice);
        Map<String, Object> dto = new LinkedHashMap<>();
        dto.put("id", subscription.getId());
        dto.put("companyName", subscription.getCompanyName());
        dto.put("contactEmail", subscription.getContactEmail());
        dto.put("plan", subscription.getPlan());
        dto.put("active", subscription.getActive());
        dto.put("status", status);
        dto.put("createdAt", subscription.getCreatedAt());
        return dto;
    }

    private Invoice latestInvoice(AdminSubscription subscription) {
        return invoiceRepository
                .findFirstByCompanyEmailIgnoreCaseOrderByIssuedAtDescCreatedAtDesc(subscription.getContactEmail())
                .orElse(null);
    }

    private AdminSubscriptionStatus refreshAndComputeSubscriptionStatus(
            AdminSubscription subscription,
            Invoice latestInvoice) {
        AdminSubscriptionStatus status = subscriptionStatusService.computeEffectiveSubscriptionStatus(
                subscription,
                latestInvoice);

        if (status == AdminSubscriptionStatus.EXPIRED
                && subscription.getStatus() != AdminSubscriptionStatus.EXPIRED) {
            subscription.setActive(false);
            subscription.setStatus(AdminSubscriptionStatus.EXPIRED);
            adminSubscriptionRepository.save(subscription);
            syncCompanyAdminActive(subscription, false);
        }

        return status;
    }

    private void syncCompanyAdminActive(AdminSubscription subscription, boolean active) {
        userRepository.findByEmailIgnoreCase(subscription.getContactEmail()).ifPresent(user -> {
            if (user.getRole() == Role.ADMIN) {
                user.setActive(active);
                userRepository.save(user);
            }
        });
    }
}
