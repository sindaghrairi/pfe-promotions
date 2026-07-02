package com.pfe.promotionplatform.domain.port.in;

import java.util.List;
import java.util.Map;

import com.pfe.promotionplatform.presentation.dto.AdminSubscriptionResponse;
import com.pfe.promotionplatform.presentation.dto.AuthResponse;
import com.pfe.promotionplatform.presentation.dto.AdminRegisterRequest;
import com.pfe.promotionplatform.presentation.dto.AdminSubscribeRequest;
import com.pfe.promotionplatform.presentation.dto.LoginRequest;
import com.pfe.promotionplatform.presentation.dto.MessageResponse;
import com.pfe.promotionplatform.presentation.dto.PlatformAdminPlanDto;
import com.pfe.promotionplatform.presentation.dto.RegisterRequest;

public interface AuthService {
    MessageResponse adminSubscribe(AdminSubscribeRequest request);
    AuthResponse adminRegister(AdminRegisterRequest request);
    AuthResponse adminLogin(LoginRequest request);
    AuthResponse platformAdminLogin(LoginRequest request);
    AuthResponse register(RegisterRequest request);
    AuthResponse login(LoginRequest request);
    Map<String, String> me(String email);
    Map<String, String> platformAdminMe(String email);
    AdminSubscriptionResponse adminSubscriptionMe(String email);
    Map<String, Boolean> adminAccountExists(String email, String companyName);
    Map<String, Object> getPlanById(Long planId);
    List<PlatformAdminPlanDto> getActivePlans();
    AdminSubscriptionResponse adminSubscriptionByCompanyName(String companyName);
}
