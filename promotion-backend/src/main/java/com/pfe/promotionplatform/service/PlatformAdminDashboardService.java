package com.pfe.promotionplatform.service;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Stream;

import org.springframework.stereotype.Service;

import com.pfe.promotionplatform.entity.AdminSubscription;
import com.pfe.promotionplatform.entity.Promotion;
import com.pfe.promotionplatform.entity.PromotionStatus;
import com.pfe.promotionplatform.entity.Role;
import com.pfe.promotionplatform.entity.User;
import com.pfe.promotionplatform.repository.AdminSubscriptionRepository;
import com.pfe.promotionplatform.repository.PromotionRepository;
import com.pfe.promotionplatform.repository.UserRepository;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class PlatformAdminDashboardService {

    private final UserRepository userRepository;
    private final AdminSubscriptionRepository adminSubscriptionRepository;
    private final PromotionRepository promotionRepository;

    public Map<String, Object> dashboardStats() {
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

        return stats;
    }

    public Map<String, Object> acquisitionStats() {
        LocalDate today = LocalDate.now();

        // Anchor the 7-day window on the most recent activity date.
        // If all data is older than 6 days, shift the window backwards so the chart shows real data.
        Optional<LocalDateTime> maxUser = userRepository.findMaxCreatedAt();
        Optional<LocalDateTime> maxSub = adminSubscriptionRepository.findMaxCreatedAt();
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
        return result;
    }
}
