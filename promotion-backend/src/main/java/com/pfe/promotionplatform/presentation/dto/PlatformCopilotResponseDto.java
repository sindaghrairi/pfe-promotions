package com.pfe.promotionplatform.presentation.dto;

import java.util.List;

public record PlatformCopilotResponseDto(
        String model,
        String answer,
        List<String> suggestedActions,
        boolean fallback
) {
}
