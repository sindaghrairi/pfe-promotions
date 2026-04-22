package com.pfe.promotionplatform.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AdminSubscriptionResponse {
    private String companyName;
    private String contactEmail;
    private String plan;
    private String createdAt;
    private Boolean active;
}
