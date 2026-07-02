package com.pfe.promotionplatform.presentation.dto;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

public record CompanyAdminDashboardResponse(
        String period,
        LocalDate from,
        LocalDate to,
        String companyName,
        String companySlug,
        CompanyAdminKpiResponse kpis,
        Map<String, ChartPointResponse> charts,
        List<TopPromotionResponse> topPromotions,
        List<String> notes
) {
}
