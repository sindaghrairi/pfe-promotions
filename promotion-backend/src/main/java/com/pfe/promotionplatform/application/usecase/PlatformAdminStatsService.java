package com.pfe.promotionplatform.application.usecase;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.YearMonth;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.pfe.promotionplatform.presentation.dto.PlatformAdminChartDatasetDto;
import com.pfe.promotionplatform.presentation.dto.PlatformAdminChartDto;
import com.pfe.promotionplatform.presentation.dto.PlatformAdminChartsDto;
import com.pfe.promotionplatform.presentation.dto.PlatformAdminDashboardDto;
import com.pfe.promotionplatform.presentation.dto.PlatformAdminKpiDto;
import com.pfe.promotionplatform.domain.model.AdminSubscription;
import com.pfe.promotionplatform.domain.model.Coupon;
import com.pfe.promotionplatform.domain.model.Invoice;
import com.pfe.promotionplatform.domain.model.InvoiceStatus;
import com.pfe.promotionplatform.domain.model.Promotion;
import com.pfe.promotionplatform.domain.model.PromotionStatus;
import com.pfe.promotionplatform.domain.model.User;
import com.pfe.promotionplatform.domain.port.out.AdminSubscriptionRepository;
import com.pfe.promotionplatform.domain.port.out.CouponRepository;
import com.pfe.promotionplatform.domain.port.out.InvoiceRepository;
import com.pfe.promotionplatform.domain.port.out.PromotionRepository;
import com.pfe.promotionplatform.domain.port.out.UserRepository;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class PlatformAdminStatsService {

    private static final DateTimeFormatter MONTH_LABEL = DateTimeFormatter.ofPattern("MMM yy", Locale.FRENCH);
    private static final DateTimeFormatter DAY_LABEL = DateTimeFormatter.ofPattern("dd MMM", Locale.FRENCH);

    private final UserRepository userRepository;
    private final AdminSubscriptionRepository subscriptionRepository;
    private final PromotionRepository promotionRepository;
    private final CouponRepository couponRepository;
    private final InvoiceRepository invoiceRepository;

    @Transactional(readOnly = true)
    public PlatformAdminDashboardDto getDashboard(String requestedPeriod) {
        PeriodWindow period = PeriodWindow.from(requestedPeriod);

        List<User> users = userRepository.findAll();
        List<AdminSubscription> subscriptions = subscriptionRepository.findAll();
        List<Promotion> promotions = promotionRepository.findAll();
        List<Coupon> coupons = couponRepository.findAll();
        List<Invoice> invoices = invoiceRepository.findAll();

        PlatformAdminKpiDto kpis = buildKpis(users, subscriptions, promotions, coupons, invoices);
        PlatformAdminChartsDto charts = new PlatformAdminChartsDto(
                countByCreatedAt("Entreprises inscrites", subscriptions, AdminSubscription::getCreatedAt, period, "#2563eb"),
                countByCreatedAt("Promotions creees", promotions, Promotion::getCreatedAt, period, "#16a34a"),
                promotionStatusDistribution(promotions),
                topCompaniesByPromotions(promotions),
                topCompaniesByCouponsUsed(coupons),
                monthlyRevenue(invoices),
                subscriptionsByPlan(subscriptions),
                platformEvolution(users, subscriptions, promotions, period)
        );

        return new PlatformAdminDashboardDto(period.key(), period.from(), period.to(), kpis, charts);
    }

    private PlatformAdminKpiDto buildKpis(
            List<User> users,
            List<AdminSubscription> subscriptions,
            List<Promotion> promotions,
            List<Coupon> coupons,
            List<Invoice> invoices) {
        long totalCompanies = subscriptions.size();
        long activeCompanies = subscriptions.stream().filter(sub -> Boolean.TRUE.equals(sub.getActive())).count();
        long activePromotions = promotions.stream().filter(promo -> promo.getStatus() == PromotionStatus.ACTIVE).count();
        long expiredPromotions = promotions.stream().filter(promo -> promo.getStatus() == PromotionStatus.EXPIRED).count();
        long usedCoupons = coupons.stream().mapToLong(coupon -> valueOrZero(coupon.getUsedCount())).sum();
        long allowedCoupons = coupons.stream().mapToLong(coupon -> valueOrZero(coupon.getAllowedCount())).sum();
        double couponUsageRate = allowedCoupons == 0
                ? 0
                : BigDecimal.valueOf((usedCoupons * 100.0) / allowedCoupons)
                        .setScale(1, RoundingMode.HALF_UP)
                        .doubleValue();
        BigDecimal totalRevenue = invoices.stream()
                .filter(invoice -> invoice.getStatus() == InvoiceStatus.PAID)
                .map(Invoice::getAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        long paidInvoices = invoices.stream().filter(invoice -> invoice.getStatus() == InvoiceStatus.PAID).count();
        long pendingInvoices = invoices.stream().filter(invoice -> invoice.getStatus() == InvoiceStatus.PENDING).count();
        long activeSubscriptions = subscriptions.stream().filter(sub -> Boolean.TRUE.equals(sub.getActive())).count();

        LocalDate now = LocalDate.now();
        LocalDateTime monthStart = now.withDayOfMonth(1).atStartOfDay();
        LocalDateTime nextMonthStart = now.plusMonths(1).withDayOfMonth(1).atStartOfDay();
        long newUsersThisMonth = users.stream()
                .filter(user -> isBetween(user.getCreatedAt(), monthStart, nextMonthStart))
                .count();

        return new PlatformAdminKpiDto(
                totalCompanies,
                activeCompanies,
                promotions.size(),
                activePromotions,
                expiredPromotions,
                coupons.size(),
                usedCoupons,
                couponUsageRate,
                totalRevenue,
                paidInvoices,
                pendingInvoices,
                activeSubscriptions,
                newUsersThisMonth
        );
    }

    private <T> PlatformAdminChartDto countByCreatedAt(
            String title,
            List<T> items,
            Function<T, LocalDateTime> dateExtractor,
            PeriodWindow period,
            String color) {
        List<Bucket> buckets = period.buckets();
        List<Number> values = buckets.stream()
                .map(bucket -> items.stream()
                        .filter(item -> isBetween(dateExtractor.apply(item), bucket.start(), bucket.end()))
                        .count())
                .map(Number.class::cast)
                .toList();

        return new PlatformAdminChartDto(
                title,
                buckets.stream().map(Bucket::label).toList(),
                List.of(new PlatformAdminChartDatasetDto(title, values, color))
        );
    }

    private PlatformAdminChartDto promotionStatusDistribution(List<Promotion> promotions) {
        List<String> labels = List.of("Actives", "Expirees", "Planifiees", "Brouillons");
        List<Number> values = List.of(
                countPromotionsByStatus(promotions, PromotionStatus.ACTIVE),
                countPromotionsByStatus(promotions, PromotionStatus.EXPIRED),
                countPromotionsByStatus(promotions, PromotionStatus.SCHEDULED),
                countPromotionsByStatus(promotions, PromotionStatus.DRAFT)
        );

        return new PlatformAdminChartDto(
                "Repartition des promotions par statut",
                labels,
                List.of(new PlatformAdminChartDatasetDto("Promotions", values, "#0f766e"))
        );
    }

    private PlatformAdminChartDto topCompaniesByPromotions(List<Promotion> promotions) {
        Map<String, Long> counts = promotions.stream()
                .collect(Collectors.groupingBy(this::companyLabel, Collectors.counting()));

        return topChart("Top 5 entreprises par promotions", counts, "Promotions", "#2563eb");
    }

    private PlatformAdminChartDto topCompaniesByCouponsUsed(List<Coupon> coupons) {
        Map<String, Long> counts = new LinkedHashMap<>();
        for (Coupon coupon : coupons) {
            String company = coupon.getPromotion() == null ? "Inconnu" : companyLabel(coupon.getPromotion());
            counts.merge(company, (long) valueOrZero(coupon.getUsedCount()), Long::sum);
        }

        return topChart("Top 5 entreprises par coupons utilises", counts, "Coupons utilises", "#ea580c");
    }

    private PlatformAdminChartDto monthlyRevenue(List<Invoice> invoices) {
        PeriodWindow period = PeriodWindow.from("12m");
        List<Bucket> buckets = period.buckets();
        List<Number> values = buckets.stream()
                .map(bucket -> invoices.stream()
                        .filter(invoice -> invoice.getStatus() == InvoiceStatus.PAID)
                        .filter(invoice -> {
                            LocalDate date = invoice.getPaidAt() != null ? invoice.getPaidAt() : invoice.getIssuedAt();
                            return date != null && !date.isBefore(bucket.start().toLocalDate()) && date.isBefore(bucket.end().toLocalDate());
                        })
                        .map(Invoice::getAmount)
                        .reduce(BigDecimal.ZERO, BigDecimal::add))
                .map(Number.class::cast)
                .toList();

        return new PlatformAdminChartDto(
                "Revenus mensuels factures",
                buckets.stream().map(Bucket::label).toList(),
                List.of(new PlatformAdminChartDatasetDto("Revenus", values, "#16a34a"))
        );
    }

    private PlatformAdminChartDto subscriptionsByPlan(List<AdminSubscription> subscriptions) {
        Map<String, Long> counts = subscriptions.stream()
                .collect(Collectors.groupingBy(
                        sub -> normalizePlan(sub.getPlan()),
                        LinkedHashMap::new,
                        Collectors.counting()));

        List<String> labels = counts.keySet().stream().sorted().toList();
        List<Number> values = labels.stream().map(counts::get).map(Number.class::cast).toList();

        return new PlatformAdminChartDto(
                "Repartition des abonnements par plan",
                labels,
                List.of(new PlatformAdminChartDatasetDto("Abonnements", values, "#7c3aed"))
        );
    }

    private PlatformAdminChartDto platformEvolution(
            List<User> users,
            List<AdminSubscription> subscriptions,
            List<Promotion> promotions,
            PeriodWindow period) {
        List<Bucket> buckets = period.buckets();

        return new PlatformAdminChartDto(
                "Evolution utilisateurs / entreprises / promotions",
                buckets.stream().map(Bucket::label).toList(),
                List.of(
                        new PlatformAdminChartDatasetDto("Utilisateurs", countSeries(users, User::getCreatedAt, buckets), "#0284c7"),
                        new PlatformAdminChartDatasetDto("Entreprises", countSeries(subscriptions, AdminSubscription::getCreatedAt, buckets), "#7c3aed"),
                        new PlatformAdminChartDatasetDto("Promotions", countSeries(promotions, Promotion::getCreatedAt, buckets), "#16a34a")
                )
        );
    }

    private <T> List<Number> countSeries(List<T> items, Function<T, LocalDateTime> dateExtractor, List<Bucket> buckets) {
        return buckets.stream()
                .map(bucket -> items.stream()
                        .filter(item -> isBetween(dateExtractor.apply(item), bucket.start(), bucket.end()))
                        .count())
                .map(Number.class::cast)
                .toList();
    }

    private PlatformAdminChartDto topChart(String title, Map<String, Long> counts, String datasetLabel, String color) {
        List<Map.Entry<String, Long>> top = counts.entrySet().stream()
                .sorted(Map.Entry.<String, Long>comparingByValue(Comparator.reverseOrder()))
                .limit(5)
                .toList();

        return new PlatformAdminChartDto(
                title,
                top.stream().map(Map.Entry::getKey).toList(),
                List.of(new PlatformAdminChartDatasetDto(
                        datasetLabel,
                        top.stream().map(Map.Entry::getValue).map(Number.class::cast).toList(),
                        color))
        );
    }

    private long countPromotionsByStatus(List<Promotion> promotions, PromotionStatus status) {
        return promotions.stream().filter(promo -> promo.getStatus() == status).count();
    }

    private String companyLabel(Promotion promotion) {
        if (promotion.getCompanySlug() == null || promotion.getCompanySlug().isBlank()) {
            return "Inconnu";
        }
        return promotion.getCompanySlug();
    }

    private String normalizePlan(String plan) {
        if (plan == null || plan.isBlank()) {
            return "Non defini";
        }
        return plan.trim().toUpperCase(Locale.ROOT);
    }

    private int valueOrZero(Integer value) {
        return value == null ? 0 : value;
    }

    private boolean isBetween(LocalDateTime value, LocalDateTime start, LocalDateTime end) {
        return value != null && !value.isBefore(start) && value.isBefore(end);
    }

    private record Bucket(String label, LocalDateTime start, LocalDateTime end) {
    }

    private record PeriodWindow(String key, LocalDate from, LocalDate to, boolean monthly) {
        static PeriodWindow from(String requestedPeriod) {
            LocalDate today = LocalDate.now();
            String normalized = requestedPeriod == null ? "12m" : requestedPeriod.trim().toLowerCase(Locale.ROOT);
            return switch (normalized) {
                case "7d" -> new PeriodWindow("7d", today.minusDays(6), today, false);
                case "30d" -> new PeriodWindow("30d", today.minusDays(29), today, false);
                default -> new PeriodWindow("12m", today.minusMonths(11).withDayOfMonth(1), today, true);
            };
        }

        List<Bucket> buckets() {
            List<Bucket> buckets = new ArrayList<>();
            if (monthly) {
                YearMonth startMonth = YearMonth.from(from);
                YearMonth endMonth = YearMonth.from(to);
                for (YearMonth current = startMonth; !current.isAfter(endMonth); current = current.plusMonths(1)) {
                    LocalDateTime start = current.atDay(1).atStartOfDay();
                    LocalDateTime end = current.plusMonths(1).atDay(1).atStartOfDay();
                    buckets.add(new Bucket(current.format(MONTH_LABEL), start, end));
                }
                return buckets;
            }

            for (LocalDate current = from; !current.isAfter(to); current = current.plusDays(1)) {
                buckets.add(new Bucket(
                        current.format(DAY_LABEL),
                        current.atStartOfDay(),
                        current.plusDays(1).atStartOfDay()));
            }
            return buckets;
        }
    }
}
