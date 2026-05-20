package com.pfe.promotionplatform.service;

import java.util.List;

import com.pfe.promotionplatform.dto.PlatformAdminPlanDto;
import com.pfe.promotionplatform.dto.PlatformAdminPlanStatusRequest;
import com.pfe.promotionplatform.dto.PlatformAdminPlanUpdateRequest;

public interface PlatformAdminPlanService {
    List<PlatformAdminPlanDto> getPlans();
    PlatformAdminPlanDto updatePlan(Long id, PlatformAdminPlanUpdateRequest request);
    PlatformAdminPlanDto togglePlanStatus(Long id, PlatformAdminPlanStatusRequest request);
}
