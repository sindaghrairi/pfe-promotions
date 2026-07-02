package com.pfe.promotionplatform.domain.port.in;

import java.util.List;

import com.pfe.promotionplatform.presentation.dto.PlatformAdminPlanDto;
import com.pfe.promotionplatform.presentation.dto.PlatformAdminPlanStatusRequest;
import com.pfe.promotionplatform.presentation.dto.PlatformAdminPlanUpdateRequest;

public interface PlatformAdminPlanService {
    List<PlatformAdminPlanDto> getPlans();
    PlatformAdminPlanDto updatePlan(Long id, PlatformAdminPlanUpdateRequest request);
    PlatformAdminPlanDto togglePlanStatus(Long id, PlatformAdminPlanStatusRequest request);
}
