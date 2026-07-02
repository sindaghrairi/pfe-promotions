package com.pfe.promotionplatform.presentation.dto;

import java.util.List;

public record PlatformAdminChartDatasetDto(
        String label,
        List<Number> data,
        String color
) {
}
