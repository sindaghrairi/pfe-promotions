package com.pfe.promotionplatform.service;

import java.text.Normalizer;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.YearMonth;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.function.ToLongFunction;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.pfe.promotionplatform.dto.ChartDatasetResponse;
import com.pfe.promotionplatform.dto.ChartPointResponse;
import com.pfe.promotionplatform.dto.CompanyAdminDashboardResponse;
import com.pfe.promotionplatform.dto.CompanyAdminKpiResponse;
import com.pfe.promotionplatform.dto.CompanyCouponResponse;
import com.pfe.promotionplatform.dto.TopPromotionResponse;
import com.pfe.promotionplatform.entity.AdminSubscription;
import com.pfe.promotionplatform.entity.Coupon;
import com.pfe.promotionplatform.entity.Promotion;
import com.pfe.promotionplatform.entity.PromotionStatus;
import com.pfe.promotionplatform.repository.AdminSubscriptionRepository;
import com.pfe.promotionplatform.repository.CouponRepository;
import com.pfe.promotionplatform.repository.PromotionRepository;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class CompanyAdminDashboardService {

    private static final DateTimeFormatter MONTH_LABEL = DateTimeFormatter.ofPattern("MMM yy", Locale.FRENCH);
    private static final DateTimeFormatter DAY_LABEL = DateTimeFormatter.ofPattern("dd MMM", Locale.FRENCH);

    private final AdminSubscriptionRepository adminSubscriptionRepository;
    private final PromotionRepository promotionRepository;
    private final CouponRepository couponRepository;
    private final CouponService couponService;

    @Transactional(readOnly = true)
    public CompanyAdminDashboardResponse getDashboard(String principalEmail, String requestedPeriod) {
        AdminSubscription subscription = adminSubscriptionRepository
                .findByContactEmailIgnoreCaseAndActiveTrue(normalizeEmail(principalEmail))
                .orElseThrow(() -> new IllegalArgumentException("Abonnement admin introuvable"));

        String companyName = subscription.getCompanyName();
        String companySlug = normalizeSlug(companyName);
        PeriodWindow period = PeriodWindow.from(requestedPeriod);

        List<Promotion> promotions = promotionRepository.findByCompanySlugOrderByIdDesc(companySlug).stream()
                .map(couponService::hydrateLegacyFields)
                .toList();

        CompanyAdminKpiResponse kpis = buildKpis(promotions);
        Map<String, ChartPointResponse> charts = buildCharts(promotions, period);
        List<TopPromotionResponse> topPromotions = promotions.stream()
                .map(this::toTopPromotion)
                .sorted(Comparator.comparingLong(TopPromotionResponse::views).reversed())
                .limit(5)
                .toList();

        List<String> notes = List.of(
                "Les vues et utilisations coupons sont stockees comme compteurs agreges. Sans table d'evenements datee, les series temporelles repartissent ces compteurs selon la date de creation des promotions."
        );

        return new CompanyAdminDashboardResponse(
                period.key(),
                period.from(),
                period.to(),
                companyName,
                companySlug,
                kpis,
                charts,
                topPromotions,
                notes);
    }

    @Transactional(readOnly = true)
    public List<CompanyCouponResponse> getCoupons(String principalEmail) {
        AdminSubscription subscription = adminSubscriptionRepository
                .findByContactEmailIgnoreCaseAndActiveTrue(normalizeEmail(principalEmail))
                .orElseThrow(() -> new IllegalArgumentException("Abonnement admin introuvable"));

        String companySlug = normalizeSlug(subscription.getCompanyName());
        return couponRepository.findCompanyCoupons(companySlug).stream()
                .map(this::toCompanyCoupon)
                .toList();
    }

    private CompanyAdminKpiResponse buildKpis(List<Promotion> promotions) {
        long totalPromotions = promotions.size();
        long activePromotions = countByStatus(promotions, PromotionStatus.ACTIVE);
        long expiredPromotions = countByStatus(promotions, PromotionStatus.EXPIRED);
        long draftPromotions = countByStatus(promotions, PromotionStatus.DRAFT);
        long scheduledPromotions = countByStatus(promotions, PromotionStatus.SCHEDULED);
        long couponsUsed = promotions.stream().mapToLong(this::couponsUsed).sum();
        long couponsRemaining = promotions.stream().mapToLong(this::couponsRemaining).sum();
        long totalCoupons = couponsUsed + couponsRemaining;
        long totalViews = promotions.stream().mapToLong(this::views).sum();
        double couponUsageRate = totalCoupons == 0 ? 0 : roundOneDecimal((couponsUsed * 100.0) / totalCoupons);
        double engagementRate = totalViews == 0 ? 0 : roundOneDecimal((couponsUsed * 100.0) / totalViews);

        TopPromotionResponse bestPromotion = promotions.stream()
                .map(this::toTopPromotion)
                .max(Comparator.comparingLong(TopPromotionResponse::views)
                        .thenComparingLong(TopPromotionResponse::couponsUsed))
                .orElse(null);

        TopPromotionResponse mostUsedCoupon = promotions.stream()
                .map(this::toTopPromotion)
                .max(Comparator.comparingLong(TopPromotionResponse::couponsUsed)
                        .thenComparingLong(TopPromotionResponse::views))
                .orElse(null);

        return new CompanyAdminKpiResponse(
                totalPromotions,
                activePromotions,
                expiredPromotions,
                draftPromotions,
                scheduledPromotions,
                totalCoupons,
                couponsUsed,
                couponsRemaining,
                couponUsageRate,
                totalViews,
                bestPromotion,
                mostUsedCoupon,
                engagementRate);
    }

    private Map<String, ChartPointResponse> buildCharts(List<Promotion> promotions, PeriodWindow period) {
        Map<String, ChartPointResponse> charts = new LinkedHashMap<>();
        charts.put("viewsByPeriod", aggregateByPeriod(
                "Vues des promotions creees sur la periode",
                "Vues",
                promotions,
                period,
                this::views,
                "#2563eb"));
        charts.put("couponsUsedByPeriod", aggregateByPeriod(
                "Coupons utilises des promotions creees sur la periode",
                "Coupons utilises",
                promotions,
                period,
                this::couponsUsed,
                "#ea580c"));
        charts.put("promotionStatusDistribution", statusDistribution(promotions));
        charts.put("topPromotionsByViews", topPromotionsChart(
                "Top 5 promotions par vues",
                promotions,
                this::views,
                "Vues",
                "#2563eb"));
        charts.put("topPromotionsByCouponsUsed", topPromotionsChart(
                "Top 5 promotions par coupons utilises",
                promotions,
                this::couponsUsed,
                "Coupons utilises",
                "#16a34a"));
        charts.put("viewsVsCoupons", viewsVsCoupons(promotions));
        charts.put("activePromotionsPerformance", activePromotionsPerformance(promotions));
        charts.put("promotionCreations", promotionCreations(promotions, period));
        charts.put("couponUsedRemaining", couponUsedRemaining(promotions));
        return charts;
    }

    private ChartPointResponse aggregateByPeriod(
            String title,
            String datasetLabel,
            List<Promotion> promotions,
            PeriodWindow period,
            ToLongFunction<Promotion> metric,
            String color) {
        List<Bucket> buckets = period.buckets();
        List<Number> data = buckets.stream()
                .map(bucket -> promotions.stream()
                        .filter(promotion -> isBetween(promotion.getCreatedAt(), bucket.start(), bucket.end()))
                        .mapToLong(metric)
                        .sum())
                .map(Number.class::cast)
                .toList();

        return new ChartPointResponse(
                title,
                buckets.stream().map(Bucket::label).toList(),
                List.of(new ChartDatasetResponse(datasetLabel, data, color)));
    }

    private ChartPointResponse statusDistribution(List<Promotion> promotions) {
        return new ChartPointResponse(
                "Repartition des promotions par statut",
                List.of("Actives", "Expirees", "Brouillons", "Planifiees"),
                List.of(new ChartDatasetResponse(
                        "Promotions",
                        List.of(
                                countByStatus(promotions, PromotionStatus.ACTIVE),
                                countByStatus(promotions, PromotionStatus.EXPIRED),
                                countByStatus(promotions, PromotionStatus.DRAFT),
                                countByStatus(promotions, PromotionStatus.SCHEDULED)),
                        "#0f766e")));
    }

    private ChartPointResponse topPromotionsChart(
            String title,
            List<Promotion> promotions,
            ToLongFunction<Promotion> metric,
            String datasetLabel,
            String color) {
        List<Promotion> top = promotions.stream()
                .sorted(Comparator.comparingLong(metric).reversed())
                .limit(5)
                .toList();

        return new ChartPointResponse(
                title,
                top.stream().map(Promotion::getTitle).toList(),
                List.of(new ChartDatasetResponse(
                        datasetLabel,
                        top.stream().mapToLong(metric).boxed().map(Number.class::cast).toList(),
                        color)));
    }

    private ChartPointResponse viewsVsCoupons(List<Promotion> promotions) {
        List<Promotion> top = promotions.stream()
                .sorted(Comparator.comparingLong(this::views).reversed())
                .limit(8)
                .toList();

        return new ChartPointResponse(
                "Comparaison vues vs coupons utilises",
                top.stream().map(Promotion::getTitle).toList(),
                List.of(
                        new ChartDatasetResponse("Vues", top.stream().mapToLong(this::views).boxed().map(Number.class::cast).toList(), "#2563eb"),
                        new ChartDatasetResponse("Coupons utilises", top.stream().mapToLong(this::couponsUsed).boxed().map(Number.class::cast).toList(), "#ea580c")));
    }

    private ChartPointResponse activePromotionsPerformance(List<Promotion> promotions) {
        List<Promotion> active = promotions.stream()
                .filter(promotion -> promotion.getStatus() == PromotionStatus.ACTIVE)
                .sorted(Comparator.comparingLong(this::views).reversed())
                .limit(8)
                .toList();

        return new ChartPointResponse(
                "Performance des promotions actives",
                active.stream().map(Promotion::getTitle).toList(),
                List.of(
                        new ChartDatasetResponse("Vues", active.stream().mapToLong(this::views).boxed().map(Number.class::cast).toList(), "#2563eb"),
                        new ChartDatasetResponse("Coupons utilises", active.stream().mapToLong(this::couponsUsed).boxed().map(Number.class::cast).toList(), "#16a34a")));
    }

    private ChartPointResponse promotionCreations(List<Promotion> promotions, PeriodWindow period) {
        List<Bucket> buckets = period.buckets();
        List<Number> data = buckets.stream()
                .map(bucket -> promotions.stream()
                        .filter(promotion -> isBetween(promotion.getCreatedAt(), bucket.start(), bucket.end()))
                        .count())
                .map(Number.class::cast)
                .toList();

        return new ChartPointResponse(
                "Evolution des creations de promotions",
                buckets.stream().map(Bucket::label).toList(),
                List.of(new ChartDatasetResponse("Promotions creees", data, "#7c3aed")));
    }

    private ChartPointResponse couponUsedRemaining(List<Promotion> promotions) {
        long used = promotions.stream().mapToLong(this::couponsUsed).sum();
        long remaining = promotions.stream().mapToLong(this::couponsRemaining).sum();
        return new ChartPointResponse(
                "Coupons utilises/restants",
                List.of("Utilises", "Restants"),
                List.of(new ChartDatasetResponse("Coupons", List.of(used, remaining), "#ea580c")));
    }

    private TopPromotionResponse toTopPromotion(Promotion promotion) {
        long views = views(promotion);
        long couponsUsed = couponsUsed(promotion);
        long couponsRemaining = couponsRemaining(promotion);
        double engagementRate = views == 0 ? 0 : roundOneDecimal((couponsUsed * 100.0) / views);

        return new TopPromotionResponse(
                promotion.getId(),
                promotion.getTitle(),
                promotion.getStatus() == null ? "UNKNOWN" : promotion.getStatus().name(),
                views,
                couponsUsed,
                couponsRemaining,
                engagementRate);
    }

    private CompanyCouponResponse toCompanyCoupon(Coupon coupon) {
        Promotion promotion = coupon.getPromotion();

        return new CompanyCouponResponse(
                coupon.getId(),
                coupon.getCode(),
                promotion == null ? null : promotion.getId(),
                promotion == null ? "Promotion inconnue" : promotion.getTitle(),
                promotion == null ? "" : promotion.getDiscount(),
                promotion == null ? null : promotion.getCreatedAt(),
                coupon.getExpirationDate(),
                couponStatus(coupon),
                defaultNumber(coupon.getUsedCount()),
                defaultNumber(coupon.getAllowedCount()),
                null,
                null);
    }

    private String couponStatus(Coupon coupon) {
        if (isExpired(coupon.getExpirationDate()) || coupon.getStatus() == PromotionStatus.EXPIRED) {
            return "EXPIRED";
        }

        return defaultNumber(coupon.getUsedCount()) > 0 ? "USED" : "UNUSED";
    }

    private boolean isExpired(String expirationDate) {
        if (expirationDate == null || expirationDate.isBlank()) {
            return false;
        }

        try {
            return LocalDate.parse(expirationDate).isBefore(LocalDate.now());
        } catch (DateTimeParseException ex) {
            return false;
        }
    }

    private long countByStatus(List<Promotion> promotions, PromotionStatus status) {
        return promotions.stream().filter(promotion -> promotion.getStatus() == status).count();
    }

    private long views(Promotion promotion) {
        return promotion.getViews() == null ? 0 : promotion.getViews();
    }

    private long couponsUsed(Promotion promotion) {
        int claimed = promotion.getClaimedCount() == null ? 0 : promotion.getClaimedCount();
        if (claimed > 0) {
            return claimed;
        }

        // Legacy promotions stored the displayed "coupons utilises" value in usageCount.
        return promotion.getUsageCount() == null ? 0 : promotion.getUsageCount();
    }

    private long couponsRemaining(Promotion promotion) {
        int claimed = promotion.getClaimedCount() == null ? 0 : promotion.getClaimedCount();
        int usage = promotion.getUsageCount() == null ? 0 : promotion.getUsageCount();
        return claimed > 0 ? usage : 0;
    }

    private int defaultNumber(Integer value) {
        return value == null ? 0 : value;
    }

    private double roundOneDecimal(double value) {
        return Math.round(value * 10.0) / 10.0;
    }

    private boolean isBetween(LocalDateTime value, LocalDateTime start, LocalDateTime end) {
        return value != null && !value.isBefore(start) && value.isBefore(end);
    }

    private String normalizeEmail(String email) {
        return email == null ? "" : email.trim().toLowerCase(Locale.ROOT);
    }

    private String normalizeSlug(String value) {
        if (value == null) {
            return "";
        }

        return Normalizer.normalize(value, Normalizer.Form.NFD)
                .replaceAll("\\p{M}+", "")
                .toLowerCase(Locale.ROOT)
                .replaceAll("[^a-z0-9]+", "-")
                .replaceAll("^-+|-+$", "");
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
