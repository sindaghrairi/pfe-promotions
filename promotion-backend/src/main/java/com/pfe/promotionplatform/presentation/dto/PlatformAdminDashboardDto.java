package com.pfe.promotionplatform.presentation.dto;

import java.time.LocalDate;

public record PlatformAdminDashboardDto(
        String period,
        LocalDate from,
        LocalDate to,
        PlatformAdminKpiDto kpis,
        PlatformAdminChartsDto charts
) {
}
