package com.pfe.promotionplatform.dto;

import java.util.List;

public record ChartPointResponse(
        String title,
        List<String> labels,
        List<ChartDatasetResponse> datasets
) {
}
