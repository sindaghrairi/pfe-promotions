package com.pfe.promotionplatform.application.usecase;

import java.util.LinkedHashMap;
import java.util.Map;

import org.springframework.stereotype.Service;

import com.pfe.promotionplatform.domain.model.Invoice;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class PlatformAdminInvoiceService {

    private final InvoiceWorkflowService invoiceWorkflowService;

    public Map<String, Object> listInvoices() {
        var items = invoiceWorkflowService.listInvoicesForPlatformAdmin().stream()
                .map(this::toInvoiceDto)
                .toList();

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("message", items.isEmpty() ? "Aucune facture disponible" : "Factures chargees avec succes");
        response.put("items", items);
        response.put("total", items.size());

        return response;
    }

    public Map<String, Object> getInvoiceById(Long invoiceId) {
        Invoice invoice = invoiceWorkflowService.getInvoiceForPlatformAdmin(invoiceId);

        return toInvoiceDto(invoice);
    }

    public Map<String, Object> markInvoicePaid(Long invoiceId) {
        return toInvoiceDto(invoiceWorkflowService.markPaid(invoiceId));
    }

    private Map<String, Object> toInvoiceDto(Invoice invoice) {
        Map<String, Object> dto = new LinkedHashMap<>();
        dto.put("id", invoice.getId());
        dto.put("companyName", invoice.getCompanyName());
        dto.put("companyEmail", invoice.getCompanyEmail());
        dto.put("plan", invoice.getPlan());
        dto.put("amount", invoice.getAmount());
        dto.put("status", invoice.getStatus());
        dto.put("issuedAt", invoice.getIssuedAt());
        dto.put("dueAt", invoice.getDueAt());
        dto.put("paidAt", invoice.getPaidAt());
        dto.put("createdAt", invoice.getCreatedAt());
        return dto;
    }
}
