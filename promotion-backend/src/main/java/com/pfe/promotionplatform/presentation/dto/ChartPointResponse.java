package com.pfe.promotionplatform.presentation.dto;

import java.util.List;

public record ChartPointResponse(
        String title,
        List<String> labels,
        List<ChartDatasetResponse> datasets
) {
}
