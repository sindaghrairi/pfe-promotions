package com.pfe.promotionplatform.service;

import java.time.LocalDate;

import org.springframework.stereotype.Service;

import com.pfe.promotionplatform.entity.AdminSubscription;
import com.pfe.promotionplatform.entity.AdminSubscriptionStatus;
import com.pfe.promotionplatform.entity.Invoice;
import com.pfe.promotionplatform.entity.InvoiceStatus;

@Service
public class SubscriptionStatusService {

    private static final int EXPIRATION_GRACE_PERIOD_DAYS = 15;

    public AdminSubscriptionStatus computeEffectiveSubscriptionStatus(
            AdminSubscription subscription,
            Invoice latestInvoice) {
        return computeEffectiveSubscriptionStatus(subscription, latestInvoice, LocalDate.now());
    }

    public AdminSubscriptionStatus computeEffectiveSubscriptionStatus(
            AdminSubscription subscription,
            Invoice latestInvoice,
            LocalDate today) {
        if (subscription.getStatus() == AdminSubscriptionStatus.CANCELED
                || subscription.getStatus() == AdminSubscriptionStatus.EXPIRED) {
            return subscription.getStatus();
        }

        if (!Boolean.TRUE.equals(subscription.getActive())) {
            return AdminSubscriptionStatus.CANCELED;
        }

        if (latestInvoice != null) {
            if (isInvoiceExpired(latestInvoice, today)) {
                return AdminSubscriptionStatus.EXPIRED;
            }
            if (isInvoiceOverdue(latestInvoice, today)) {
                return AdminSubscriptionStatus.OVERDUE;
            }
            if (latestInvoice.getStatus() == InvoiceStatus.PENDING) {
                return AdminSubscriptionStatus.PENDING;
            }
            if (latestInvoice.getStatus() == InvoiceStatus.CANCELED) {
                return AdminSubscriptionStatus.CANCELED;
            }
        }

        return AdminSubscriptionStatus.ACTIVE;
    }

    public boolean isInvoiceExpired(Invoice invoice, LocalDate today) {
        return invoice.getDueAt() != null
                && isInvoiceOverdue(invoice, today)
                && today.isAfter(invoice.getDueAt().plusDays(EXPIRATION_GRACE_PERIOD_DAYS));
    }

    public boolean isInvoiceOverdue(Invoice invoice, LocalDate today) {
        return invoice.getStatus() == InvoiceStatus.OVERDUE
                || (invoice.getStatus() == InvoiceStatus.PENDING
                && invoice.getDueAt() != null
                && invoice.getDueAt().isBefore(today));
    }
}
