package com.pfe.promotionplatform.dto;

import java.util.List;

public record PlatformAdminChartDto(
        String title,
        List<String> labels,
        List<PlatformAdminChartDatasetDto> datasets
) {
}
