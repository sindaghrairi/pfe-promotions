package com.pfe.promotionplatform.presentation.dto;

public record PlatformAdminChartsDto(
        PlatformAdminChartDto companiesByPeriod,
        PlatformAdminChartDto promotionsByPeriod,
        PlatformAdminChartDto promotionStatusDistribution,
        PlatformAdminChartDto topCompaniesByPromotions,
        PlatformAdminChartDto topCompaniesByCouponsUsed,
        PlatformAdminChartDto monthlyRevenue,
        PlatformAdminChartDto subscriptionsByPlan,
        PlatformAdminChartDto platformEvolution
) {
}
