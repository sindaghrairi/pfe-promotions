package com.pfe.promotionplatform.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.pfe.promotionplatform.dto.PlatformCopilotRequestDto;
import com.pfe.promotionplatform.dto.PlatformCopilotResponseDto;
import com.pfe.promotionplatform.service.PlatformAdminAiCopilotService;

import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/api/platform-admin/ai/copilot")
@RequiredArgsConstructor
@PreAuthorize("hasRole('PLATFORM_ADMIN')")
public class PlatformAdminAiCopilotController {

    private final PlatformAdminAiCopilotService platformAdminAiCopilotService;

    @PostMapping("/ask")
    public ResponseEntity<PlatformCopilotResponseDto> ask(@RequestBody PlatformCopilotRequestDto request) {
        return ResponseEntity.ok(platformAdminAiCopilotService.ask(request));
    }
}
