package com.pfe.promotionplatform.repository;

import java.time.LocalDateTime;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import com.pfe.promotionplatform.entity.User;

public interface UserRepository extends JpaRepository<User, Long> {
    Optional<User> findByEmailIgnoreCase(String email);
    boolean existsByEmailIgnoreCase(String email);
    long countByCreatedAtBetween(LocalDateTime start, LocalDateTime end);

    @Query("SELECT MAX(u.createdAt) FROM User u")
    Optional<LocalDateTime> findMaxCreatedAt();
}
