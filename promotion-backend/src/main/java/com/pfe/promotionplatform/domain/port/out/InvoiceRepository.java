package com.pfe.promotionplatform.domain.port.out;

import java.util.List;
import java.time.LocalDate;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

import com.pfe.promotionplatform.domain.model.Invoice;
import com.pfe.promotionplatform.domain.model.InvoiceStatus;

public interface InvoiceRepository extends JpaRepository<Invoice, Long> {
    List<Invoice> findAllByOrderByIssuedAtDesc();
    boolean existsByCompanyEmailIgnoreCase(String companyEmail);
    List<Invoice> findAllByStatusAndPaidAtIsNullAndDueAtBefore(InvoiceStatus status, LocalDate dueAt);
    Optional<Invoice> findFirstByCompanyEmailIgnoreCaseOrderByIssuedAtDescCreatedAtDesc(String companyEmail);
}
