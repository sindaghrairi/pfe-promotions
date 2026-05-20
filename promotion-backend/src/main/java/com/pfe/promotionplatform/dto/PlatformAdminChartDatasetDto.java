package com.pfe.promotionplatform.dto;

import java.util.List;

public record PlatformAdminChartDatasetDto(
        String label,
        List<Number> data,
        String color
) {
}
