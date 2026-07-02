package com.pfe.promotionplatform.application.usecase;

import java.security.Principal;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.springframework.stereotype.Service;

import com.pfe.promotionplatform.domain.model.AdminSubscriptionStatus;
import com.pfe.promotionplatform.domain.model.Role;
import com.pfe.promotionplatform.domain.model.User;
import com.pfe.promotionplatform.domain.port.out.AdminSubscriptionRepository;
import com.pfe.promotionplatform.domain.port.out.UserRepository;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class PlatformAdminUserService {

    private final UserRepository userRepository;
    private final AdminSubscriptionRepository adminSubscriptionRepository;

    public List<Map<String, Object>> listUsers() {
        return userRepository.findAll().stream()
                .sorted(Comparator.comparing(User::getCreatedAt, Comparator.nullsLast(Comparator.reverseOrder())))
                .map(this::toUserDto)
                .toList();
    }

    public Map<String, Object> updateUserRole(Long userId, String role, Principal principal) {
        if (role == null) {
            throw new IllegalArgumentException("Le role est obligatoire");
        }

        User target = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("Utilisateur introuvable"));

        Role newRole;
        try {
            newRole = Role.valueOf(role.trim().toUpperCase());
        } catch (IllegalArgumentException ex) {
            throw new IllegalArgumentException("Role invalide. Roles autorises: CLIENT, ADMIN, PLATFORM_ADMIN");
        }

        if (principal != null && target.getEmail() != null
                && target.getEmail().equalsIgnoreCase(principal.getName())
                && newRole != Role.PLATFORM_ADMIN) {
            throw new IllegalArgumentException("Vous ne pouvez pas retirer votre propre role PLATFORM_ADMIN");
        }

        target.setRole(newRole);
        userRepository.save(target);

        return toUserDto(target);
    }

    public Map<String, Object> updateUserStatus(Long userId, Boolean active, Principal principal) {
        if (active == null) {
            throw new IllegalArgumentException("Le statut est obligatoire");
        }

        User target = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("Utilisateur introuvable"));

        if (principal != null && target.getEmail() != null
                && target.getEmail().equalsIgnoreCase(principal.getName())
                && Boolean.FALSE.equals(active)) {
            throw new IllegalArgumentException("Vous ne pouvez pas desactiver votre propre compte");
        }

        target.setActive(active);
        userRepository.save(target);

        if (target.getRole() == Role.ADMIN && target.getEmail() != null) {
            adminSubscriptionRepository.findByContactEmailIgnoreCase(target.getEmail()).ifPresent(subscription -> {
                subscription.setActive(active);
                subscription.setStatus(Boolean.TRUE.equals(active)
                        ? AdminSubscriptionStatus.ACTIVE
                        : AdminSubscriptionStatus.CANCELED);
                adminSubscriptionRepository.save(subscription);
            });
        }

        return toUserDto(target);
    }

    public void deleteUser(Long userId, Principal principal) {
        User target = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("Utilisateur introuvable"));

        if (principal != null && target.getEmail() != null && target.getEmail().equalsIgnoreCase(principal.getName())) {
            throw new IllegalArgumentException("Vous ne pouvez pas supprimer votre propre compte");
        }

        if (target.getRole() == Role.ADMIN && target.getEmail() != null) {
            adminSubscriptionRepository.findByContactEmailIgnoreCase(target.getEmail()).ifPresent(subscription -> {
                subscription.setActive(false);
                subscription.setStatus(AdminSubscriptionStatus.CANCELED);
                adminSubscriptionRepository.save(subscription);
            });
        }

        userRepository.delete(target);
    }

    private Map<String, Object> toUserDto(User user) {
        Map<String, Object> dto = new LinkedHashMap<>();
        dto.put("id", user.getId());
        dto.put("fullName", user.getFullName());
        dto.put("email", user.getEmail());
        dto.put("role", user.getRole());
        dto.put("active", !Boolean.FALSE.equals(user.getActive()));
        dto.put("createdAt", user.getCreatedAt());
        return dto;
    }
}
