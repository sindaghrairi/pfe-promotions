package com.pfe.promotionplatform.application.usecase;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;

import org.springframework.stereotype.Service;

import com.pfe.promotionplatform.presentation.dto.PromotionAiEvaluationRequest;
import com.pfe.promotionplatform.presentation.dto.PromotionAiEvaluationResponse;

@Service
public class SimplePromotionRecommendationService {

    private static final BigDecimal HUNDRED = BigDecimal.valueOf(100);

    public PromotionAiEvaluationResponse evaluate(PromotionAiEvaluationRequest request) {
        List<String> alerts = new ArrayList<>();
        List<String> anomalies = new ArrayList<>();
        List<String> recommendations = new ArrayList<>();

        BigDecimal discount = evaluatePrices(request.initialPrice(), request.promotionalPrice(), alerts, anomalies, recommendations);
        evaluateDuration(request.startDate(), request.endDate(), alerts, recommendations);
        evaluateUsageLimit(request.usageLimit(), alerts, recommendations);
        evaluateTitle(request.title(), recommendations);
        evaluateCoupon(request.couponCode(), recommendations);

        if (alerts.isEmpty() && anomalies.isEmpty() && recommendations.isEmpty()) {
            recommendations.add("Promotion coherente selon les regles simples.");
        }

        int score = score(discount, alerts, anomalies, recommendations);
        return new PromotionAiEvaluationResponse(
                score,
                levelFor(score),
                discount,
                List.copyOf(alerts),
                List.copyOf(anomalies),
                List.copyOf(recommendations),
                null,
                null,
                null,
                null);
    }

    private BigDecimal evaluatePrices(
            BigDecimal initialPrice,
            BigDecimal promotionalPrice,
            List<String> alerts,
            List<String> anomalies,
            List<String> recommendations) {
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
                .divide(initialPrice, 2, RoundingMode.HALF_UP)
                .stripTrailingZeros();

        if (discount.compareTo(BigDecimal.valueOf(10)) < 0) {
            alerts.add("La reduction est faible, une remise plus attractive peut ameliorer la promotion.");
        }

        if (discount.compareTo(BigDecimal.valueOf(70)) > 0) {
            alerts.add("La reduction est tres elevee, verifiez la coherence de l'offre.");
        }

        recommendations.add("Reduction calculee automatiquement : " + discount.toPlainString() + "%.");
        return discount;
    }

    private void evaluateDuration(
            String rawStartDate,
            String rawEndDate,
            List<String> alerts,
            List<String> recommendations) {
        LocalDate startDate = parseDate(rawStartDate);
        LocalDate endDate = parseDate(rawEndDate);
        if (startDate == null || endDate == null) {
            recommendations.add("Renseignez des dates claires pour mieux cadrer la promotion.");
            return;
        }

        long durationDays = ChronoUnit.DAYS.between(startDate, endDate);
        if (durationDays < 0) {
            alerts.add("La date de fin doit etre posterieure a la date de debut.");
            return;
        }

        if (durationDays < 2) {
            recommendations.add("La duree de la promotion est courte, pensez a l'allonger pour toucher plus de clients.");
        } else if (durationDays > 60) {
            recommendations.add("La duree de la promotion est longue, pensez a garder une offre limitee dans le temps.");
        }
    }

    private void evaluateUsageLimit(Integer usageLimit, List<String> alerts, List<String> recommendations) {
        if (usageLimit == null) {
            recommendations.add("Definissez un nombre de coupons disponible.");
            return;
        }

        if (usageLimit < 10) {
            alerts.add("Le nombre de coupons est faible, pensez a l'augmenter si le stock le permet.");
        }
    }

    private void evaluateTitle(String title, List<String> recommendations) {
        String value = title == null ? "" : title.trim();
        if (value.length() < 8) {
            recommendations.add("Le titre est court, ajoutez plus de details pour le rendre plus attractif.");
        } else if (value.length() > 90) {
            recommendations.add("Le titre est long, raccourcissez-le pour ameliorer sa lisibilite.");
        }
    }

    private void evaluateCoupon(String couponCode, List<String> recommendations) {
        if (couponCode == null || couponCode.isBlank()) {
            recommendations.add("Ajoutez un code coupon clair pour faciliter l'utilisation de l'offre.");
        }
    }

    private int score(
            BigDecimal discount,
            List<String> alerts,
            List<String> anomalies,
            List<String> recommendations) {
        int score = 80;
        score -= anomalies.size() * 25;
        score -= alerts.size() * 10;
        score -= Math.max(0, recommendations.size() - 2) * 3;
        if (discount != null && discount.compareTo(BigDecimal.valueOf(10)) >= 0
                && discount.compareTo(BigDecimal.valueOf(60)) <= 0) {
            score += 10;
        }
        return Math.max(0, Math.min(score, 100));
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
}
