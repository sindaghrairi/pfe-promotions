package com.pfe.promotionplatform.entity;

import java.time.LocalDateTime;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "admin_subscriptions")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AdminSubscription {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String companyName;

    @Column(nullable = false, unique = true)
    private String contactEmail;

    @Column(nullable = false)
    private String plan;

    @Column(nullable = false)
    private Boolean active;

    @Enumerated(EnumType.STRING)
    @Builder.Default
    private AdminSubscriptionStatus status = AdminSubscriptionStatus.ACTIVE;

    @Column(nullable = false)
    private LocalDateTime createdAt;

    @PrePersist
    void prePersist() {
        if (active == null) {
            this.active = true;
        }
        if (status == null) {
            this.status = Boolean.TRUE.equals(active)
                    ? AdminSubscriptionStatus.ACTIVE
                    : AdminSubscriptionStatus.CANCELED;
        }
        this.createdAt = LocalDateTime.now();
    }
}
