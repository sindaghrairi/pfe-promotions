package com.pfe.promotionplatform.domain.port.out;

import java.time.LocalDateTime;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.transaction.annotation.Transactional;

import com.pfe.promotionplatform.domain.model.User;

public interface UserRepository extends JpaRepository<User, Long> {
    Optional<User> findByEmailIgnoreCase(String email);
    Optional<User> findByOauthProviderAndOauthId(com.pfe.promotionplatform.domain.model.OAuthProvider oauthProvider, String oauthId);
    boolean existsByEmailIgnoreCase(String email);
    long countByCreatedAtBetween(LocalDateTime start, LocalDateTime end);

    @Query("SELECT MAX(u.createdAt) FROM User u")
    Optional<LocalDateTime> findMaxCreatedAt();

    @Modifying
    @Transactional
    @Query("""
        update User u
        set u.localPasswordSet = false
        where u.oauthProvider = com.pfe.promotionplatform.domain.model.OAuthProvider.GOOGLE
          and u.localPasswordSet is null
    """)
    int markLegacyGoogleUsersWithoutLocalPassword();

    @Modifying
    @Transactional
    @Query("""
        update User u
        set u.localPasswordSet = true
        where u.oauthProvider = com.pfe.promotionplatform.domain.model.OAuthProvider.LOCAL
          and u.localPasswordSet is null
    """)
    int markLegacyLocalUsersWithLocalPassword();

    @Modifying
    @Transactional
    @Query("""
        update User u
        set u.active = true
        where u.active is null
    """)
    int markLegacyUsersActive();
}
