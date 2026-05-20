package com.pfe.promotionplatform.dto;

import java.math.BigDecimal;

public record PlatformAdminKpiDto(
        long totalCompanies,
        long activeCompanies,
        long totalPromotions,
        long activePromotions,
        long expiredPromotions,
        long totalCoupons,
        long usedCoupons,
        double couponUsageRate,
        BigDecimal totalRevenue,
        long paidInvoices,
        long pendingInvoices,
        long activeSubscriptions,
        long newUsersThisMonth
) {
}
