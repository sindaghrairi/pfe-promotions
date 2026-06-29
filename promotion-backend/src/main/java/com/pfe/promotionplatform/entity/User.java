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
@Table(name = "users")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String fullName;

    @Column(nullable = false, unique = true)
    private String email;

    @Column(nullable = false)
    private String password;

    // Google-only accounts start with a technical password that is not usable by the owner.
    private Boolean localPasswordSet;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    @Builder.Default
    private OAuthProvider oauthProvider = OAuthProvider.LOCAL;

    @Column(unique = true)
    private String oauthId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Role role;

    @Builder.Default
    private Boolean active = true;

    @Column(nullable = false)
    private LocalDateTime createdAt;

    @PrePersist
    void prePersist() {
        if (this.oauthProvider == null) {
            this.oauthProvider = OAuthProvider.LOCAL;
        }
        if (this.localPasswordSet == null) {
            this.localPasswordSet = this.oauthProvider != OAuthProvider.GOOGLE;
        }
        if (this.active == null) {
            this.active = true;
        }
        this.createdAt = LocalDateTime.now();
    }
}
