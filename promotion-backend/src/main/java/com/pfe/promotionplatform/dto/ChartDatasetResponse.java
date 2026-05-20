package com.pfe.promotionplatform.dto;

import java.util.List;

public record ChartDatasetResponse(
        String label,
        List<Number> data,
        String color
) {
}
