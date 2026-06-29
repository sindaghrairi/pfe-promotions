package com.pfe.promotionplatform.service;

import java.time.LocalDate;
import java.util.List;

import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.pfe.promotionplatform.entity.Invoice;
import com.pfe.promotionplatform.entity.InvoiceStatus;
import com.pfe.promotionplatform.entity.AdminSubscription;
import com.pfe.promotionplatform.entity.AdminSubscriptionStatus;
import com.pfe.promotionplatform.entity.Role;
import com.pfe.promotionplatform.repository.AdminSubscriptionRepository;
import com.pfe.promotionplatform.repository.InvoiceRepository;
import com.pfe.promotionplatform.repository.UserRepository;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class InvoiceWorkflowService {

    private final InvoiceRepository invoiceRepository;
    private final AdminSubscriptionRepository adminSubscriptionRepository;
    private final UserRepository userRepository;
    private final SubscriptionStatusService subscriptionStatusService;

    @Transactional
    public List<Invoice> listInvoicesForPlatformAdmin() {
        markPendingInvoicesOverdue(LocalDate.now());
        return invoiceRepository.findAllByOrderByIssuedAtDesc();
    }

    @Transactional
    public Invoice getInvoiceForPlatformAdmin(Long invoiceId) {
        markPendingInvoicesOverdue(LocalDate.now());
        return findInvoice(invoiceId);
    }

    @Transactional
    public Invoice markPaid(Long invoiceId) {
        Invoice invoice = findInvoice(invoiceId);
        if (invoice.getStatus() == InvoiceStatus.PAID) {
            throw new IllegalArgumentException("Cette facture est deja payee");
        }
        if (invoice.getStatus() != InvoiceStatus.PENDING && invoice.getStatus() != InvoiceStatus.OVERDUE) {
            throw new IllegalArgumentException("Seule une facture en attente ou en retard peut etre payee");
        }

        invoice.setStatus(InvoiceStatus.PAID);
        invoice.setPaidAt(LocalDate.now());
        Invoice savedInvoice = invoiceRepository.save(invoice);
        reactivateSubscriptionAfterPayment(savedInvoice);
        return savedInvoice;
    }

    @Scheduled(cron = "0 0 0 * * *")
    @Transactional
    public void markPendingInvoicesOverdueNightly() {
        markPendingInvoicesOverdue(LocalDate.now());
    }

    private void markPendingInvoicesOverdue(LocalDate today) {
        List<Invoice> invoices = invoiceRepository.findAllByStatusAndPaidAtIsNullAndDueAtBefore(
                InvoiceStatus.PENDING,
                today);

        if (!invoices.isEmpty()) {
            invoices.forEach(invoice -> invoice.setStatus(InvoiceStatus.OVERDUE));
            invoiceRepository.saveAll(invoices);
        }

        expireLongOverdueSubscriptions(today);
    }

    private void expireLongOverdueSubscriptions(LocalDate today) {
        List<Invoice> invoices = invoiceRepository.findAllByStatusAndPaidAtIsNullAndDueAtBefore(
                InvoiceStatus.OVERDUE,
                today.minusDays(15));

        invoices.stream()
                .filter(invoice -> subscriptionStatusService.isInvoiceExpired(invoice, today))
                .forEach(this::expireSubscriptionForInvoice);
    }

    private void expireSubscriptionForInvoice(Invoice invoice) {
        adminSubscriptionRepository.findByContactEmailIgnoreCase(invoice.getCompanyEmail())
                .filter(subscription -> subscription.getStatus() != AdminSubscriptionStatus.CANCELED)
                .ifPresent(subscription -> {
                    subscription.setActive(false);
                    subscription.setStatus(AdminSubscriptionStatus.EXPIRED);
                    adminSubscriptionRepository.save(subscription);
                    syncCompanyAdminActive(subscription, false);
                });
    }

    private void reactivateSubscriptionAfterPayment(Invoice invoice) {
        adminSubscriptionRepository.findByContactEmailIgnoreCase(invoice.getCompanyEmail())
                .filter(subscription -> subscription.getStatus() != AdminSubscriptionStatus.CANCELED)
                .ifPresent(subscription -> {
                    subscription.setActive(true);
                    subscription.setStatus(AdminSubscriptionStatus.ACTIVE);
                    adminSubscriptionRepository.save(subscription);
                    syncCompanyAdminActive(subscription, true);
                });
    }

    private void syncCompanyAdminActive(AdminSubscription subscription, boolean active) {
        userRepository.findByEmailIgnoreCase(subscription.getContactEmail()).ifPresent(user -> {
            if (user.getRole() == Role.ADMIN) {
                user.setActive(active);
                userRepository.save(user);
            }
        });
    }

    private Invoice findInvoice(Long invoiceId) {
        return invoiceRepository.findById(invoiceId)
                .orElseThrow(() -> new IllegalArgumentException("Facture introuvable"));
    }
}
