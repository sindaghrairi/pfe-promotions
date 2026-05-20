package com.pfe.promotionplatform.service;

import java.util.List;
import java.util.Map;

import com.pfe.promotionplatform.dto.AdminSubscriptionResponse;
import com.pfe.promotionplatform.dto.AuthResponse;
import com.pfe.promotionplatform.dto.AdminRegisterRequest;
import com.pfe.promotionplatform.dto.AdminSubscribeRequest;
import com.pfe.promotionplatform.dto.LoginRequest;
import com.pfe.promotionplatform.dto.MessageResponse;
import com.pfe.promotionplatform.dto.PlatformAdminPlanDto;
import com.pfe.promotionplatform.dto.RegisterRequest;

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
