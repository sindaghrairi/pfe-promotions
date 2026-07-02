package com.pfe.promotionplatform.application.usecase;

import java.time.LocalDate;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.pfe.promotionplatform.domain.model.AdminSubscription;
import com.pfe.promotionplatform.domain.model.Invoice;
import com.pfe.promotionplatform.domain.model.InvoiceStatus;
import com.pfe.promotionplatform.domain.model.Plan;
import com.pfe.promotionplatform.domain.port.out.AdminSubscriptionRepository;
import com.pfe.promotionplatform.domain.port.out.InvoiceRepository;
import com.pfe.promotionplatform.domain.port.out.PlanRepository;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class SubscriptionInvoiceService {

    private static final Logger log = LoggerFactory.getLogger(SubscriptionInvoiceService.class);

    private final AdminSubscriptionRepository adminSubscriptionRepository;
    private final InvoiceRepository invoiceRepository;
    private final PlanRepository planRepository;

    @Transactional
    public void createInitialInvoiceIfMissing(AdminSubscription subscription) {
        if (subscription == null || invoiceRepository.existsByCompanyEmailIgnoreCase(subscription.getContactEmail())) {
            return;
        }

        Plan plan = planRepository.findByNameIgnoreCase(normalizePlan(subscription.getPlan()))
                .orElseThrow(() -> new IllegalArgumentException("Plan introuvable pour la facture"));
        LocalDate issuedAt = subscription.getCreatedAt() == null
                ? LocalDate.now()
                : subscription.getCreatedAt().toLocalDate();

        invoiceRepository.save(Invoice.builder()
                .companyName(subscription.getCompanyName())
                .companyEmail(subscription.getContactEmail())
                .plan(normalizePlan(plan.getName()))
                .amount(plan.getPrice())
                .status(InvoiceStatus.PENDING)
                .issuedAt(issuedAt)
                .dueAt(issuedAt.plusDays(30))
                .build());
    }

    @Transactional
    public int backfillActiveSubscriptionsWithoutInvoice() {
        int created = 0;
        for (AdminSubscription subscription : adminSubscriptionRepository.findAll()) {
            if (!Boolean.TRUE.equals(subscription.getActive())) {
                continue;
            }

            try {
                if (!invoiceRepository.existsByCompanyEmailIgnoreCase(subscription.getContactEmail())) {
                    createInitialInvoiceIfMissing(subscription);
                    created++;
                }
            } catch (IllegalArgumentException ex) {
                log.warn("Skipped invoice backfill for subscription {}: {}",
                        subscription.getId(),
                        ex.getMessage());
            }
        }
        return created;
    }

    private String normalizePlan(String plan) {
        String value = plan == null ? "" : plan.trim().toUpperCase();
        return switch (value) {
            case "BASIC" -> "BASIC";
            case "STANDARD", "ENTERPRISE" -> "STANDARD";
            case "PREMIUM", "PRO" -> "PREMIUM";
            default -> throw new IllegalArgumentException("Plan invalide pour la facture");
        };
    }
}
