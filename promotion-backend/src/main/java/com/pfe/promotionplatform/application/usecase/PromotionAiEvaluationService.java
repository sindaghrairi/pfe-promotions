package com.pfe.promotionplatform.application.usecase;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.text.Normalizer;
import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import com.pfe.promotionplatform.presentation.dto.PromotionAiEvaluationRequest;
import com.pfe.promotionplatform.presentation.dto.PromotionAiEvaluationResponse;
import com.pfe.promotionplatform.infrastructure.ai.MarketingCopyAiService;
import com.pfe.promotionplatform.infrastructure.ai.MarketingCopyAiService.MarketingCopyResult;

@Service
public class PromotionAiEvaluationService {
    private static final Logger log = LoggerFactory.getLogger(PromotionAiEvaluationService.class);

    private final MarketingCopyAiService marketingCopyAiService;

    public PromotionAiEvaluationService(MarketingCopyAiService marketingCopyAiService) {
        this.marketingCopyAiService = marketingCopyAiService;
    }

    private static final BigDecimal HUNDRED = BigDecimal.valueOf(100);
    private static final BigDecimal MIN_ATTRACTIVE_DISCOUNT = BigDecimal.valueOf(5);
    private static final BigDecimal MAX_NORMAL_DISCOUNT = BigDecimal.valueOf(80);

    public PromotionAiEvaluationResponse evaluate(PromotionAiEvaluationRequest request) {
        List<String> alerts = new ArrayList<>();
        List<String> anomalies = new ArrayList<>();
        List<String> recommendations = new ArrayList<>();
        String category = normalizeCategory(request.category());

        int score = 0;
        BigDecimal discount = evaluatePrices(request, category, alerts, anomalies);
        boolean coherentPrices = discount != null;
        if (coherentPrices) {
            score += scorePrices(discount);
            score += scoreDiscount(discount, category, recommendations);
        } else {
            recommendations.add("Renseignez des prix coherents pour obtenir une reduction exploitable.");
        }

        score += scoreDuration(request.startDate(), request.endDate(), category, alerts, anomalies, recommendations);
        score += scoreUsageLimit(request.usageLimit(), alerts, recommendations);
        score += scoreTitle(request.title(), recommendations);
        score += scoreCoupon(request.couponCode(), recommendations);

        if (anomalies.isEmpty()) {
            recommendations.add("Promotion coherente et attractive.");
        }

        int boundedScore = Math.max(0, Math.min(score, 100));
        MarketingCopyResult marketingCopy = generateMarketingCopySafely(
                request,
                discount,
                boundedScore,
                recommendations);

        return new PromotionAiEvaluationResponse(
                boundedScore,
                levelFor(boundedScore),
                discount,
                List.copyOf(alerts),
                List.copyOf(anomalies),
                List.copyOf(recommendations),
                marketingCopy.proposedTitle(),
                marketingCopy.suggestedDescription(),
                marketingCopy.reformulatedRecommendation(),
                marketingCopy.fallbackMessage());
    }

    private MarketingCopyResult generateMarketingCopySafely(
            PromotionAiEvaluationRequest request,
            BigDecimal discount,
            int boundedScore,
            List<String> recommendations) {
        try {
            return marketingCopyAiService.generateMarketingCopy(
                    request.title(),
                    request.category(),
                    request.initialPrice(),
                    request.promotionalPrice(),
                    discount,
                    boundedScore,
                    recommendations);
        } catch (Exception ex) {
            log.error("Gemini fallback cause: MarketingCopyAiService threw an exception. Symbolic analysis will still be returned. errorType={} message={}",
                    ex.getClass().getSimpleName(),
                    ex.getMessage(),
                    ex);
            return marketingCopyAiService.fallbackResult("Gemini indisponible: analyse symbolique conservee.");
        }
    }

    private BigDecimal evaluatePrices(
            PromotionAiEvaluationRequest request,
            String category,
            List<String> alerts,
            List<String> anomalies) {
        BigDecimal initialPrice = request.initialPrice();
        BigDecimal promotionalPrice = request.promotionalPrice();

        if (initialPrice == null || promotionalPrice == null
                || initialPrice.signum() <= 0 || promotionalPrice.signum() <= 0) {
            anomalies.add("Les prix doivent etre superieurs a 0.");
            return null;
        }

        if (promotionalPrice.compareTo(initialPrice) >= 0) {
            anomalies.add("Le prix promotionnel doit etre inferieur au prix initial.");
            return null;
        }

        BigDecimal discount = initialPrice.subtract(promotionalPrice)
                .multiply(HUNDRED)
                .divide(initialPrice, 2, RoundingMode.HALF_UP);

        if (discount.compareTo(MIN_ATTRACTIVE_DISCOUNT) < 0) {
            alerts.add("La reduction est faible, la promotion peut etre peu attractive.");
        }
        if (discount.compareTo(MAX_NORMAL_DISCOUNT) > 0) {
            anomalies.add("La reduction est anormalement elevee.");
        }
        if ("electronique".equals(category) && discount.compareTo(BigDecimal.valueOf(70)) > 0) {
            anomalies.add("Une reduction superieure a 70% est suspecte pour la categorie Electronique.");
        }

        return discount;
    }

    private int scorePrices(BigDecimal discount) {
        if (discount.compareTo(MIN_ATTRACTIVE_DISCOUNT) < 0) {
            return 16;
        }
        if (discount.compareTo(MAX_NORMAL_DISCOUNT) > 0) {
            return 10;
        }
        if (isBetween(discount, 10, 60)) {
            return 25;
        }

        return 22;
    }

    private int scoreDiscount(BigDecimal discount, String category, List<String> recommendations) {
        if (discount.compareTo(MIN_ATTRACTIVE_DISCOUNT) < 0) {
            return 6;
        }
        if (discount.compareTo(MAX_NORMAL_DISCOUNT) > 0) {
            return 0;
        }

        if ("mode".equals(category) && !isBetween(discount, 20, 50)) {
            recommendations.add("Pour la categorie Mode, visez une reduction entre 20% et 50%.");
            return discount.compareTo(BigDecimal.valueOf(10)) < 0 ? 14 : 21;
        }
        if ("sport".equals(category) && !isBetween(discount, 15, 40)) {
            recommendations.add("Pour la categorie Sport, visez une reduction entre 15% et 40%.");
            return discount.compareTo(BigDecimal.valueOf(10)) < 0 ? 14 : 21;
        }
        if ("electronique".equals(category) && discount.compareTo(BigDecimal.valueOf(70)) > 0) {
            return 8;
        }
        if (discount.compareTo(BigDecimal.valueOf(10)) < 0) {
            return 16;
        }
        if (discount.compareTo(BigDecimal.valueOf(15)) < 0) {
            return 23;
        }
        if (discount.compareTo(BigDecimal.valueOf(50)) <= 0) {
            return 30;
        }
        if (discount.compareTo(BigDecimal.valueOf(70)) <= 0) {
            return 24;
        }

        return 16;
    }

    private int scoreDuration(
            String rawStartDate,
            String rawEndDate,
            String category,
            List<String> alerts,
            List<String> anomalies,
            List<String> recommendations) {
        LocalDate startDate = parseDate(rawStartDate);
        LocalDate endDate = parseDate(rawEndDate);

        if (startDate == null || endDate == null) {
            recommendations.add("Renseignez une periode de promotion valide.");
            return 0;
        }

        long durationDays = ChronoUnit.DAYS.between(startDate, endDate);
        if (durationDays < 0) {
            anomalies.add("La date de fin doit etre posterieure a la date de debut.");
            return 0;
        }

        boolean restaurant = "restaurant".equals(category);
        boolean services = "services".equals(category);
        if (durationDays < 1 && !restaurant) {
            alerts.add("La duree de la promotion est trop courte.");
        }
        if (durationDays > 60 && !services) {
            alerts.add("La duree de la promotion est trop longue.");
        }
        if ("alimentation".equals(category) && durationDays > 30) {
            recommendations.add("Pour l'Alimentation, privilegiez une duree courte ou moyenne.");
        }

        if (durationDays < 1) {
            return restaurant ? 16 : 5;
        }
        if (durationDays > 60) {
            return services && durationDays <= 90 ? 16 : 7;
        }
        if ("alimentation".equals(category) && durationDays > 30) {
            return 13;
        }
        if (durationDays <= 2) {
            return restaurant ? 18 : 13;
        }
        if (durationDays <= 6) {
            return 17;
        }
        if (durationDays <= 14) {
            return 20;
        }
        if (durationDays <= 21) {
            return 19;
        }
        if (durationDays <= 30) {
            return 18;
        }

        return services ? 18 : 15;
    }

    private int scoreUsageLimit(Integer usageLimit, List<String> alerts, List<String> recommendations) {
        if (usageLimit == null) {
            recommendations.add("Definissez une limite d'utilisation adaptee a votre campagne.");
            return 0;
        }
        if (usageLimit < 5) {
            alerts.add("La limite d'utilisation est insuffisante.");
            return Math.max(0, usageLimit) * 2;
        }
        if (usageLimit < 20) {
            return 6;
        }
        if (usageLimit < 50) {
            return 8;
        }
        if (usageLimit <= 200) {
            return 10;
        }

        return 9;
    }

    private int scoreTitle(String title, List<String> recommendations) {
        String cleanedTitle = title == null ? "" : title.trim();
        if (cleanedTitle.length() < 8) {
            recommendations.add("Ajoutez un titre plus clair et plus attractif.");
            return cleanedTitle.isEmpty() ? 0 : 4;
        }
        if (cleanedTitle.length() < 15) {
            return 7;
        }
        if (cleanedTitle.length() > 90) {
            recommendations.add("Raccourcissez le titre pour le rendre plus lisible.");
            return 7;
        }

        return 10;
    }

    private int scoreCoupon(String couponCode, List<String> recommendations) {
        if (couponCode == null || couponCode.isBlank()) {
            recommendations.add("Ajoutez un code coupon pour ameliorer l'engagement des consommateurs.");
            return 0;
        }
        if (couponCode.trim().length() < 4) {
            recommendations.add("Utilisez un code coupon plus explicite.");
            return 3;
        }

        return 5;
    }

    private boolean isBetween(BigDecimal value, int min, int max) {
        return value.compareTo(BigDecimal.valueOf(min)) >= 0
                && value.compareTo(BigDecimal.valueOf(max)) <= 0;
    }

    private LocalDate parseDate(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }

        try {
            return LocalDate.parse(value);
        } catch (DateTimeParseException ex) {
            return null;
        }
    }

    private String levelFor(int score) {
        if (score >= 85) {
            return "Excellent";
        }
        if (score >= 70) {
            return "Bon";
        }
        if (score >= 40) {
            return "Moyen";
        }
        return "Faible";
    }

    private String normalizeCategory(String category) {
        if (category == null) {
            return "";
        }

        String normalized = Normalizer.normalize(category, Normalizer.Form.NFD)
                .replaceAll("\\p{M}+", "")
                .trim()
                .toLowerCase();
        if ("alimentaire".equals(normalized)) {
            return "alimentation";
        }
        if ("service".equals(normalized)) {
            return "services";
        }
        return normalized;
    }
}
