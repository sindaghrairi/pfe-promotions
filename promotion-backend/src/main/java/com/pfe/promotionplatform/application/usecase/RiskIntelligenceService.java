package com.pfe.promotionplatform.application.usecase;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.stream.Collectors;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.pfe.promotionplatform.domain.model.AdminSubscription;
import com.pfe.promotionplatform.domain.model.Coupon;
import com.pfe.promotionplatform.domain.model.Invoice;
import com.pfe.promotionplatform.domain.model.InvoiceStatus;
import com.pfe.promotionplatform.domain.model.Promotion;
import com.pfe.promotionplatform.domain.model.PromotionStatus;
import com.pfe.promotionplatform.domain.port.out.AdminSubscriptionRepository;
import com.pfe.promotionplatform.domain.port.out.CouponRepository;
import com.pfe.promotionplatform.domain.port.out.InvoiceRepository;
import com.pfe.promotionplatform.domain.port.out.PromotionRepository;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Service
@RequiredArgsConstructor
@Slf4j
public class RiskIntelligenceService {

    private final AdminSubscriptionRepository subscriptionRepository;
    private final PromotionRepository promotionRepository;
    private final CouponRepository couponRepository;
    private final InvoiceRepository invoiceRepository;

    @Transactional(readOnly = true)
    public RiskIntelligenceSnapshot analyze() {
        List<AdminSubscription> subscriptions = subscriptionRepository.findAll();
        List<Promotion> promotions = promotionRepository.findAll();
        List<Coupon> coupons = couponRepository.findAll();
        List<Invoice> invoices = invoiceRepository.findAll();

        RiskIntelligenceSnapshot snapshot = analyze(subscriptions, promotions, coupons, invoices);
        log.info("Risk intelligence built: companies={} riskyCompanies={} criticalCompanies={}",
                snapshot.companies().size(),
                snapshot.riskyCompanies(),
                snapshot.criticalCompanies());
        return snapshot;
    }

    public RiskIntelligenceSnapshot analyze(
            List<AdminSubscription> subscriptions,
            List<Promotion> promotions,
            List<Coupon> coupons,
            List<Invoice> invoices) {
        Map<String, List<Promotion>> promotionsByCompany = promotions.stream()
                .collect(Collectors.groupingBy(promotion -> normalizeCompanyKey(promotion.getCompanySlug())));
        Map<String, List<Coupon>> couponsByCompany = coupons.stream()
                .filter(coupon -> coupon.getPromotion() != null)
                .collect(Collectors.groupingBy(coupon -> normalizeCompanyKey(coupon.getPromotion().getCompanySlug())));
        Map<String, List<Invoice>> invoicesByCompany = invoices.stream()
                .collect(Collectors.groupingBy(invoice -> normalizeCompanyKey(companyKey(invoice))));

        List<CompanyRiskInsight> companyRisks = subscriptions.stream()
                .map(subscription -> analyzeCompany(
                        subscription,
                        promotionsByCompany.getOrDefault(normalizeCompanyKey(subscription.getCompanyName()), List.of()),
                        couponsByCompany.getOrDefault(normalizeCompanyKey(subscription.getCompanyName()), List.of()),
                        invoicesByCompany.getOrDefault(normalizeCompanyKey(subscription.getCompanyName()), List.of())))
                .sorted(Comparator.comparingInt(CompanyRiskInsight::healthScore))
                .toList();

        long riskyCompanies = companyRisks.stream()
                .filter(company -> company.healthScore() < 60)
                .count();
        long criticalCompanies = companyRisks.stream()
                .filter(company -> company.healthScore() < 40)
                .count();

        List<String> globalActions = new ArrayList<>();
        if (riskyCompanies > 0) {
            globalActions.add("Contacter les entreprises avec un score inferieur a 60.");
        }
        if (criticalCompanies > 0) {
            globalActions.add("Prioriser les entreprises critiques avant toute campagne d'acquisition.");
        }
        long paymentRisks = companyRisks.stream().filter(company -> company.paymentRisk() >= 60).count();
        if (paymentRisks > 0) {
            globalActions.add("Verifier les factures en attente ou en retard des entreprises a risque.");
        }
        if (globalActions.isEmpty()) {
            globalActions.add("Continuer la surveillance hebdomadaire des entreprises actives.");
        }

        return new RiskIntelligenceSnapshot(companyRisks, riskyCompanies, criticalCompanies, globalActions);
    }

    private CompanyRiskInsight analyzeCompany(
            AdminSubscription subscription,
            List<Promotion> promotions,
            List<Coupon> coupons,
            List<Invoice> invoices) {
        int score = 100;
        List<String> causes = new ArrayList<>();
        List<String> actions = new ArrayList<>();

        LocalDateTime lastPromotionAt = promotions.stream()
                .map(Promotion::getCreatedAt)
                .filter(date -> date != null)
                .max(LocalDateTime::compareTo)
                .orElse(null);
        long daysSinceLastPromotion = lastPromotionAt == null
                ? -1
                : ChronoUnit.DAYS.between(lastPromotionAt, LocalDateTime.now());

        long activePromotions = promotions.stream()
                .filter(promotion -> promotion.getStatus() == PromotionStatus.ACTIVE)
                .count();
        long pendingInvoices = invoices.stream()
                .filter(invoice -> invoice.getStatus() == InvoiceStatus.PENDING)
                .count();
        long overdueInvoices = invoices.stream()
                .filter(invoice -> invoice.getStatus() == InvoiceStatus.OVERDUE
                        || (invoice.getStatus() == InvoiceStatus.PENDING
                                && invoice.getDueAt() != null
                                && invoice.getDueAt().isBefore(LocalDate.now())))
                .count();
        long usedCoupons = coupons.stream().mapToLong(coupon -> valueOrZero(coupon.getUsedCount())).sum();
        long allowedCoupons = coupons.stream().mapToLong(coupon -> valueOrZero(coupon.getAllowedCount())).sum();
        double couponUsageRate = allowedCoupons == 0 ? 0 : (usedCoupons * 100.0) / allowedCoupons;

        if (!Boolean.TRUE.equals(subscription.getActive())) {
            score -= 30;
            causes.add("abonnement inactif");
            actions.add("Verifier la raison de l'inactivation de l'abonnement.");
        }
        if (lastPromotionAt == null) {
            score -= 35;
            causes.add("aucune promotion creee");
            actions.add("Contacter l'entreprise pour l'accompagner dans la creation d'une premiere promotion.");
        } else if (daysSinceLastPromotion > 45) {
            score -= 25;
            causes.add("aucune promotion depuis " + daysSinceLastPromotion + " jours");
            actions.add("Contacter l'entreprise afin de comprendre la baisse d'activite.");
        } else if (daysSinceLastPromotion > 30) {
            score -= 15;
            causes.add("activite promotionnelle faible depuis " + daysSinceLastPromotion + " jours");
        }
        if (activePromotions == 0) {
            score -= 15;
            causes.add("aucune promotion active");
            actions.add("Proposer une nouvelle campagne promotionnelle.");
        }
        if (overdueInvoices > 0) {
            score -= 30;
            causes.add(overdueInvoices + " facture(s) en retard");
            actions.add("Relancer le paiement des factures en retard.");
        } else if (pendingInvoices > 0) {
            score -= 15;
            causes.add(pendingInvoices + " facture(s) en attente");
            actions.add("Surveiller les factures en attente.");
        }
        if (allowedCoupons > 0 && couponUsageRate < 10) {
            score -= 10;
            causes.add("faible utilisation des coupons (" + Math.round(couponUsageRate) + "%)");
            actions.add("Analyser l'attractivite des coupons et la visibilite des offres.");
        }

        int healthScore = Math.max(0, Math.min(100, score));
        int inactivityRisk = riskFromInactivity(lastPromotionAt, daysSinceLastPromotion, activePromotions);
        int paymentRisk = overdueInvoices > 0 ? 90 : pendingInvoices > 0 ? 55 : 10;
        int churnRisk = Math.max(inactivityRisk, paymentRisk);
        String riskLevel = riskLevel(healthScore);

        if (causes.isEmpty()) {
            causes.add("activite saine selon les donnees disponibles");
        }
        if (actions.isEmpty()) {
            actions.add("Maintenir le suivi regulier de l'entreprise.");
        }

        return new CompanyRiskInsight(
                subscription.getId(),
                subscription.getCompanyName(),
                healthScore,
                riskLevel,
                inactivityRisk,
                churnRisk,
                paymentRisk,
                activePromotions,
                promotions.size(),
                usedCoupons,
                pendingInvoices,
                overdueInvoices,
                daysSinceLastPromotion,
                causes,
                actions);
    }

    private int riskFromInactivity(LocalDateTime lastPromotionAt, long daysSinceLastPromotion, long activePromotions) {
        if (lastPromotionAt == null) {
            return 90;
        }
        if (daysSinceLastPromotion > 45) {
            return 75;
        }
        if (daysSinceLastPromotion > 30 || activePromotions == 0) {
            return 55;
        }
        return 15;
    }

    private String riskLevel(int healthScore) {
        if (healthScore < 40) {
            return "CRITICAL";
        }
        if (healthScore < 60) {
            return "HIGH";
        }
        if (healthScore < 80) {
            return "MEDIUM";
        }
        return "LOW";
    }

    private String companyKey(Invoice invoice) {
        if (invoice.getCompanyName() != null && !invoice.getCompanyName().isBlank()) {
            return invoice.getCompanyName();
        }
        return invoice.getCompanyEmail();
    }

    private String normalizeCompanyKey(String value) {
        if (value == null || value.isBlank()) {
            return "unknown";
        }
        return value.trim().toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]+", "");
    }

    private int valueOrZero(Integer value) {
        return value == null ? 0 : value;
    }

    public record RiskIntelligenceSnapshot(
            List<CompanyRiskInsight> companies,
            long riskyCompanies,
            long criticalCompanies,
            List<String> globalActions) {
    }

    public record CompanyRiskInsight(
            Long companyId,
            String companyName,
            int healthScore,
            String riskLevel,
            int inactivityRisk,
            int churnRisk,
            int paymentRisk,
            long activePromotions,
            long totalPromotions,
            long usedCoupons,
            long pendingInvoices,
            long overdueInvoices,
            long daysSinceLastPromotion,
            List<String> causes,
            List<String> recommendedActions) {
    }
}
