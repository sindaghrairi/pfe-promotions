package com.pfe.promotionplatform.presentation.dto;

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
    private String status;
    private String nextInvoice;
    private String latestInvoiceStatus;
    private String latestInvoiceDueAt;
    private String message;
}
