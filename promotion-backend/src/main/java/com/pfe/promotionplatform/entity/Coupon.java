package com.pfe.promotionplatform.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonProperty;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.OneToOne;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "coupons")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Coupon {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column
    private String code;

    @Column(name = "expiration_date")
    private String expirationDate;

    @Enumerated(EnumType.STRING)
    @Column(name = "status")
    private PromotionStatus status;

    @Column(name = "used_count", nullable = false)
    private Integer usedCount;

    @Column(name = "allowed_count", nullable = false)
    private Integer allowedCount;

    @JsonIgnore
    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "promotion_id", nullable = false, unique = true)
    private Promotion promotion;

    @JsonProperty("promotionId")
    public Long getPromotionId() {
        return promotion == null ? null : promotion.getId();
    }
}
