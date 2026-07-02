package com.pfe.promotionplatform.application.usecase;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
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
import com.pfe.promotionplatform.domain.model.Role;
import com.pfe.promotionplatform.domain.model.User;
import com.pfe.promotionplatform.domain.port.out.AdminSubscriptionRepository;
import com.pfe.promotionplatform.domain.port.out.CouponRepository;
import com.pfe.promotionplatform.domain.port.out.InvoiceRepository;
import com.pfe.promotionplatform.domain.port.out.PromotionRepository;
import com.pfe.promotionplatform.domain.port.out.UserRepository;
import com.pfe.promotionplatform.application.usecase.RiskIntelligenceService.CompanyRiskInsight;
import com.pfe.promotionplatform.application.usecase.RiskIntelligenceService.RiskIntelligenceSnapshot;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Service
@RequiredArgsConstructor
@Slf4j
public class PlatformCopilotContextService {

    private final UserRepository userRepository;
    private final AdminSubscriptionRepository subscriptionRepository;
    private final PromotionRepository promotionRepository;
    private final CouponRepository couponRepository;
    private final InvoiceRepository invoiceRepository;
    private final RiskIntelligenceService riskIntelligenceService;

    @Transactional(readOnly = true)
    public PlatformCopilotContext buildContext(String period) {
        List<User> users = userRepository.findAll();
        List<AdminSubscription> subscriptions = subscriptionRepository.findAll();
        List<Promotion> promotions = promotionRepository.findAll();
        List<Coupon> coupons = couponRepository.findAll();
        List<Invoice> invoices = invoiceRepository.findAll();
        RiskIntelligenceSnapshot risks = riskIntelligenceService.analyze(subscriptions, promotions, coupons, invoices);

        PlatformCopilotContext context = new PlatformCopilotContext(
                period == null || period.isBlank() ? "12m" : period.trim(),
                LocalDate.now(),
                buildUsers(users),
                buildSubscriptions(subscriptions),
                buildInvoices(invoices),
                buildPromotions(promotions),
                buildCoupons(coupons),
                buildRevenue(invoices),
                buildCompaniesToWatch(risks),
                risks);

        log.info("Platform copilot context built: users={} companies={} promotions={} invoices={} riskyCompanies={}",
                context.users().totalUsers(),
                context.subscriptions().totalCompanies(),
                context.promotions().totalPromotions(),
                context.invoices().totalInvoices(),
                context.riskIntelligence().riskyCompanies());
        return context;
    }

    public CompactPlatformCopilotContext compact(PlatformCopilotContext context) {
        return new CompactPlatformCopilotContext(
                context.period(),
                context.generatedAt(),
                context.users(),
                context.subscriptions(),
                context.invoices(),
                context.promotions(),
                context.coupons(),
                context.revenue(),
                context.companiesToWatch(),
                context.riskIntelligence().riskyCompanies(),
                context.riskIntelligence().criticalCompanies(),
                context.riskIntelligence().globalActions());
    }

    private UsersContext buildUsers(List<User> users) {
        Map<String, Long> byRole = users.stream()
                .collect(Collectors.groupingBy(user -> roleName(user.getRole()), LinkedHashMap::new, Collectors.counting()));
        return new UsersContext(
                users.size(),
                byRole.getOrDefault("CLIENT", 0L),
                byRole.getOrDefault("ADMIN", 0L),
                byRole.getOrDefault("PLATFORM_ADMIN", 0L),
                byRole);
    }

    private SubscriptionsContext buildSubscriptions(List<AdminSubscription> subscriptions) {
        long active = subscriptions.stream().filter(subscription -> Boolean.TRUE.equals(subscription.getActive())).count();
        Map<String, Long> byPlan = subscriptions.stream()
                .collect(Collectors.groupingBy(
                        subscription -> subscription.getPlan() == null ? "NON_DEFINI" : subscription.getPlan().trim().toUpperCase(),
                        LinkedHashMap::new,
                        Collectors.counting()));
        return new SubscriptionsContext(subscriptions.size(), active, subscriptions.size() - active, byPlan);
    }

    private InvoicesContext buildInvoices(List<Invoice> invoices) {
        long paid = countInvoices(invoices, InvoiceStatus.PAID);
        long pending = countInvoices(invoices, InvoiceStatus.PENDING);
        long overdue = invoices.stream()
                .filter(invoice -> invoice.getStatus() == InvoiceStatus.OVERDUE
                        || (invoice.getStatus() == InvoiceStatus.PENDING
                                && invoice.getDueAt() != null
                                && invoice.getDueAt().isBefore(LocalDate.now())))
                .count();
        long canceled = countInvoices(invoices, InvoiceStatus.CANCELED);
        BigDecimal unpaidAmount = invoices.stream()
                .filter(invoice -> invoice.getStatus() == InvoiceStatus.PENDING || invoice.getStatus() == InvoiceStatus.OVERDUE)
                .map(Invoice::getAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        return new InvoicesContext(invoices.size(), paid, pending, overdue, canceled, unpaidAmount);
    }

    private PromotionsContext buildPromotions(List<Promotion> promotions) {
        long active = countPromotions(promotions, PromotionStatus.ACTIVE);
        long expired = countPromotions(promotions, PromotionStatus.EXPIRED);
        long draft = countPromotions(promotions, PromotionStatus.DRAFT);
        long scheduled = countPromotions(promotions, PromotionStatus.SCHEDULED);
        List<CompanyActivity> topCompanies = promotions.stream()
                .collect(Collectors.groupingBy(
                        promotion -> companyLabel(promotion.getCompanySlug()),
                        Collectors.counting()))
                .entrySet()
                .stream()
                .sorted(Map.Entry.<String, Long>comparingByValue(Comparator.reverseOrder()))
                .limit(8)
                .map(entry -> new CompanyActivity(entry.getKey(), entry.getValue()))
                .toList();
        return new PromotionsContext(promotions.size(), active, expired, draft, scheduled, topCompanies);
    }

    private CouponsContext buildCoupons(List<Coupon> coupons) {
        long used = coupons.stream().mapToLong(coupon -> valueOrZero(coupon.getUsedCount())).sum();
        long allowed = coupons.stream().mapToLong(coupon -> valueOrZero(coupon.getAllowedCount())).sum();
        double usageRate = allowed == 0 ? 0 : BigDecimal.valueOf((used * 100.0) / allowed)
                .setScale(1, RoundingMode.HALF_UP)
                .doubleValue();
        return new CouponsContext(coupons.size(), used, allowed, usageRate);
    }

    private RevenueContext buildRevenue(List<Invoice> invoices) {
        BigDecimal totalPaid = invoices.stream()
                .filter(invoice -> invoice.getStatus() == InvoiceStatus.PAID)
                .map(Invoice::getAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        Map<String, BigDecimal> monthlyRevenue = invoices.stream()
                .filter(invoice -> invoice.getStatus() == InvoiceStatus.PAID)
                .filter(invoice -> invoice.getPaidAt() != null || invoice.getIssuedAt() != null)
                .collect(Collectors.groupingBy(
                        invoice -> YearMonth.from(invoice.getPaidAt() != null ? invoice.getPaidAt() : invoice.getIssuedAt()).toString(),
                        LinkedHashMap::new,
                        Collectors.mapping(Invoice::getAmount, Collectors.reducing(BigDecimal.ZERO, BigDecimal::add))));

        return new RevenueContext(totalPaid, monthlyRevenue);
    }

    private List<CompanyRiskInsight> buildCompaniesToWatch(RiskIntelligenceSnapshot risks) {
        return risks.companies().stream()
                .filter(company -> company.healthScore() < 80)
                .limit(10)
                .toList();
    }

    private long countInvoices(List<Invoice> invoices, InvoiceStatus status) {
        return invoices.stream().filter(invoice -> invoice.getStatus() == status).count();
    }

    private long countPromotions(List<Promotion> promotions, PromotionStatus status) {
        return promotions.stream().filter(promotion -> promotion.getStatus() == status).count();
    }

    private String roleName(Role role) {
        return role == null ? "UNKNOWN" : role.name();
    }

    private String companyLabel(String value) {
        return value == null || value.isBlank() ? "Inconnu" : value.trim();
    }

    private int valueOrZero(Integer value) {
        return value == null ? 0 : value;
    }

    public record PlatformCopilotContext(
            String period,
            LocalDate generatedAt,
            UsersContext users,
            SubscriptionsContext subscriptions,
            InvoicesContext invoices,
            PromotionsContext promotions,
            CouponsContext coupons,
            RevenueContext revenue,
            List<CompanyRiskInsight> companiesToWatch,
            RiskIntelligenceSnapshot riskIntelligence) {
    }

    public record UsersContext(
            long totalUsers,
            long clients,
            long companyAdmins,
            long platformAdmins,
            Map<String, Long> usersByRole) {
    }

    public record SubscriptionsContext(
            long totalCompanies,
            long activeSubscriptions,
            long inactiveSubscriptions,
            Map<String, Long> subscriptionsByPlan) {
    }

    public record InvoicesContext(
            long totalInvoices,
            long paidInvoices,
            long pendingInvoices,
            long overdueInvoices,
            long canceledInvoices,
            BigDecimal unpaidAmount) {
    }

    public record PromotionsContext(
            long totalPromotions,
            long activePromotions,
            long expiredPromotions,
            long draftPromotions,
            long scheduledPromotions,
            List<CompanyActivity> topCompaniesByPromotions) {
    }

    public record CouponsContext(
            long totalCoupons,
            long usedCoupons,
            long availableCouponCapacity,
            double usageRate) {
    }

    public record RevenueContext(
            BigDecimal totalPaidRevenue,
            Map<String, BigDecimal> monthlyPaidRevenue) {
    }

    public record CompanyActivity(String companyName, long value) {
    }

    public record CompactPlatformCopilotContext(
            String period,
            LocalDate generatedAt,
            UsersContext users,
            SubscriptionsContext subscriptions,
            InvoicesContext invoices,
            PromotionsContext promotions,
            CouponsContext coupons,
            RevenueContext revenue,
            List<CompanyRiskInsight> companiesToWatch,
            long riskyCompanies,
            long criticalCompanies,
            List<String> globalActions) {
    }
}
