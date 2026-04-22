package com.pfe.promotionplatform.repository;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

import com.pfe.promotionplatform.entity.Invoice;

public interface InvoiceRepository extends JpaRepository<Invoice, Long> {
    List<Invoice> findAllByOrderByIssuedAtDesc();
}
