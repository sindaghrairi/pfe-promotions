package com.pfe.promotionplatform.application.usecase;

import java.time.LocalDate;
import java.util.Map;

import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.pfe.promotionplatform.presentation.dto.AccountProfileResponse;
import com.pfe.promotionplatform.presentation.dto.AdminSubscriptionResponse;
import com.pfe.promotionplatform.presentation.dto.AccountProfileUpdateRequest;
import com.pfe.promotionplatform.presentation.dto.ChangePasswordRequest;
import com.pfe.promotionplatform.presentation.dto.CompanyAdminProfileResponse;
import com.pfe.promotionplatform.presentation.dto.CompanyAdminProfileUpdateRequest;
import com.pfe.promotionplatform.presentation.dto.CompanySubscriptionUpdateRequest;
import com.pfe.promotionplatform.presentation.dto.MessageResponse;
import com.pfe.promotionplatform.presentation.dto.SetPasswordRequest;
import com.pfe.promotionplatform.domain.model.AdminSubscription;
import com.pfe.promotionplatform.domain.model.AdminSubscriptionStatus;
import com.pfe.promotionplatform.domain.model.Invoice;
import com.pfe.promotionplatform.domain.model.InvoiceStatus;
import com.pfe.promotionplatform.domain.model.OAuthProvider;
import com.pfe.promotionplatform.domain.model.Plan;
import com.pfe.promotionplatform.domain.model.Role;
import com.pfe.promotionplatform.domain.model.User;
import com.pfe.promotionplatform.domain.port.out.AdminSubscriptionRepository;
import com.pfe.promotionplatform.domain.port.out.InvoiceRepository;
import com.pfe.promotionplatform.domain.port.out.PlanRepository;
import com.pfe.promotionplatform.domain.port.out.UserRepository;
import com.pfe.promotionplatform.infrastructure.security.CustomUserDetailsService;
import com.pfe.promotionplatform.infrastructure.security.JwtService;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class AccountService {

    private final UserRepository userRepository;
    private final AdminSubscriptionRepository adminSubscriptionRepository;
    private final PlanRepository planRepository;
    private final InvoiceRepository invoiceRepository;
    private final PasswordEncoder passwordEncoder;
    private final CustomUserDetailsService customUserDetailsService;
    private final JwtService jwtService;
    private final SubscriptionStatusService subscriptionStatusService;

    public AccountProfileResponse clientProfile(String principalEmail) {
        User user = currentUser(principalEmail, Role.CLIENT);
        return toClientProfile(user, null);
    }

    @Transactional
    public AccountProfileResponse updateClientProfile(String principalEmail, AccountProfileUpdateRequest request) {
        User user = currentUser(principalEmail, Role.CLIENT);
        updateUserEmail(user, request.email());
        user.setFullName(request.fullName().trim());
        userRepository.save(user);
        return toClientProfile(user, issueToken(user));
    }

    @Transactional
    public MessageResponse changeClientPassword(String principalEmail, ChangePasswordRequest request) {
        User user = currentUser(principalEmail, Role.CLIENT);
        changePassword(user, request);
        return new MessageResponse("Mot de passe modifie avec succes.");
    }

    @Transactional
    public MessageResponse setClientPassword(String principalEmail, SetPasswordRequest request) {
        User user = currentUser(principalEmail, Role.CLIENT);
        setGooglePassword(user, request);
        return new MessageResponse("Mot de passe local defini avec succes.");
    }

    public CompanyAdminProfileResponse companyAdminProfile(String principalEmail) {
        User user = currentUser(principalEmail, Role.ADMIN);
        return toCompanyProfile(user, currentSubscription(user), null);
    }

    public AdminSubscriptionResponse companyAdminSubscription(String principalEmail) {
        User user = currentUser(principalEmail, Role.ADMIN);
        return toSubscriptionResponse(currentSubscriptionIncludingInactive(user), null);
    }

    @Transactional
    public CompanyAdminProfileResponse updateCompanyAdminProfile(
            String principalEmail,
            CompanyAdminProfileUpdateRequest request) {
        User user = currentUser(principalEmail, Role.ADMIN);
        AdminSubscription subscription = currentSubscription(user);
        updateUserEmail(user, request.email());
        ensureSubscriptionEmailAvailable(subscription, request.email());

        subscription.setCompanyName(request.companyName().trim());
        subscription.setContactEmail(normalizeEmail(request.email()));
        userRepository.save(user);
        adminSubscriptionRepository.save(subscription);
        return toCompanyProfile(user, subscription, issueToken(user));
    }

    @Transactional
    public MessageResponse changeCompanyAdminPassword(String principalEmail, ChangePasswordRequest request) {
        User user = currentUser(principalEmail, Role.ADMIN);
        changePassword(user, request);
        return new MessageResponse("Mot de passe admin modifie avec succes.");
    }

    @Transactional
    public MessageResponse setCompanyAdminPassword(String principalEmail, SetPasswordRequest request) {
        User user = currentUser(principalEmail, Role.ADMIN);
        setGooglePassword(user, request);
        return new MessageResponse("Mot de passe local admin defini avec succes.");
    }

    @Transactional
    public CompanyAdminProfileResponse updateCompanySubscription(
            String principalEmail,
            CompanySubscriptionUpdateRequest request) {
        User user = currentUser(principalEmail, Role.ADMIN);
        AdminSubscription subscription = currentSubscription(user);
        Plan plan = activePlan(request.plan());
        String nextPlan = normalizePlan(plan.getName());

        if (!nextPlan.equalsIgnoreCase(normalizePlan(subscription.getPlan()))) {
            subscription.setPlan(nextPlan);
            adminSubscriptionRepository.save(subscription);
            createPlanChangeInvoice(subscription, plan);
        }

        return toCompanyProfile(user, subscription, null);
    }

    @Transactional
    public AdminSubscriptionResponse reactivateCompanySubscription(String principalEmail) {
        User user = currentUser(principalEmail, Role.ADMIN);
        AdminSubscription subscription = currentSubscriptionIncludingInactive(user);
        AdminSubscriptionStatus currentStatus = refreshAndComputeSubscriptionStatus(subscription, latestInvoice(subscription));

        if (currentStatus != AdminSubscriptionStatus.EXPIRED && currentStatus != AdminSubscriptionStatus.CANCELED) {
            throw new IllegalArgumentException("Seul un abonnement expire ou annule peut etre reactive.");
        }

        subscription.setActive(true);
        subscription.setStatus(AdminSubscriptionStatus.ACTIVE);
        adminSubscriptionRepository.save(subscription);

        Plan plan = planRepository.findByNameIgnoreCase(normalizePlan(subscription.getPlan()))
                .orElseThrow(() -> new IllegalArgumentException("Plan introuvable"));

        Invoice invoice = createPendingInvoice(subscription, plan, LocalDate.now());

        return toSubscriptionResponse(
                subscription,
                "Votre abonnement a ete reactive. Une nouvelle facture est en attente de validation.",
                invoice);
    }

    private void changePassword(User user, ChangePasswordRequest request) {
        if (!hasLocalPassword(user)) {
            throw new IllegalArgumentException("Definissez d'abord un mot de passe local pour ce compte Google");
        }

        if (!passwordEncoder.matches(request.oldPassword(), user.getPassword())) {
            throw new IllegalArgumentException("Ancien mot de passe incorrect");
        }

        if (!request.newPassword().equals(request.confirmNewPassword())) {
            throw new IllegalArgumentException("La confirmation du nouveau mot de passe ne correspond pas");
        }

        user.setPassword(passwordEncoder.encode(request.newPassword()));
        userRepository.save(user);
    }

    private void setGooglePassword(User user, SetPasswordRequest request) {
        if (user.getOauthProvider() != OAuthProvider.GOOGLE) {
            throw new IllegalArgumentException("Cette action est reservee aux comptes Google");
        }

        if (!request.newPassword().equals(request.confirmNewPassword())) {
            throw new IllegalArgumentException("La confirmation du nouveau mot de passe ne correspond pas");
        }

        user.setPassword(passwordEncoder.encode(request.newPassword()));
        user.setLocalPasswordSet(true);
        userRepository.save(user);
    }

    private void updateUserEmail(User user, String email) {
        String normalizedEmail = normalizeEmail(email);
        userRepository.findByEmailIgnoreCase(normalizedEmail).ifPresent(existing -> {
            if (!existing.getId().equals(user.getId())) {
                throw new IllegalArgumentException("Cet email existe deja");
            }
        });
        user.setEmail(normalizedEmail);
    }

    private void ensureSubscriptionEmailAvailable(AdminSubscription subscription, String email) {
        adminSubscriptionRepository.findByContactEmailIgnoreCase(normalizeEmail(email)).ifPresent(existing -> {
            if (!existing.getId().equals(subscription.getId())) {
                throw new IllegalArgumentException("Cet email est deja utilise par un abonnement");
            }
        });
    }

    private User currentUser(String principalEmail, Role role) {
        User user = userRepository.findByEmailIgnoreCase(normalizeEmail(principalEmail))
                .orElseThrow(() -> new IllegalArgumentException("Utilisateur introuvable"));

        if (user.getRole() != role) {
            throw new IllegalArgumentException("Vous ne pouvez modifier que votre propre espace");
        }
        return user;
    }

    private AdminSubscription currentSubscription(User user) {
        return adminSubscriptionRepository.findByContactEmailIgnoreCaseAndActiveTrue(normalizeEmail(user.getEmail()))
                .orElseThrow(() -> new IllegalArgumentException("Aucun abonnement actif trouve pour ce compte"));
    }

    private AdminSubscription currentSubscriptionIncludingInactive(User user) {
        return adminSubscriptionRepository.findByContactEmailIgnoreCase(normalizeEmail(user.getEmail()))
                .orElseThrow(() -> new IllegalArgumentException("Aucun abonnement trouve pour ce compte"));
    }

    private Plan activePlan(String planCode) {
        Plan plan = planRepository.findByNameIgnoreCase(normalizePlan(planCode))
                .orElseThrow(() -> new IllegalArgumentException("Plan introuvable"));
        if (!Boolean.TRUE.equals(plan.getActive())) {
            throw new IllegalArgumentException("Ce plan est actuellement inactif");
        }
        return plan;
    }

    private void createPlanChangeInvoice(AdminSubscription subscription, Plan plan) {
        LocalDate today = LocalDate.now();
        createPendingInvoice(subscription, plan, today);
    }

    private Invoice createPendingInvoice(AdminSubscription subscription, Plan plan, LocalDate issuedAt) {
        return invoiceRepository.save(Invoice.builder()
                .companyName(subscription.getCompanyName())
                .companyEmail(subscription.getContactEmail())
                .plan(normalizePlan(plan.getName()))
                .amount(plan.getPrice())
                .status(InvoiceStatus.PENDING)
                .issuedAt(issuedAt)
                .dueAt(issuedAt.plusDays(30))
                .build());
    }

    private Invoice latestInvoice(AdminSubscription subscription) {
        return invoiceRepository
                .findFirstByCompanyEmailIgnoreCaseOrderByIssuedAtDescCreatedAtDesc(subscription.getContactEmail())
                .orElse(null);
    }

    private AdminSubscriptionStatus refreshAndComputeSubscriptionStatus(
            AdminSubscription subscription,
            Invoice latestInvoice) {
        AdminSubscriptionStatus status = subscriptionStatusService.computeEffectiveSubscriptionStatus(
                subscription,
                latestInvoice);

        if (status == AdminSubscriptionStatus.EXPIRED
                && subscription.getStatus() != AdminSubscriptionStatus.EXPIRED) {
            subscription.setActive(false);
            subscription.setStatus(AdminSubscriptionStatus.EXPIRED);
            adminSubscriptionRepository.save(subscription);
            syncCompanyAdminActive(subscription, false);
        }

        return status;
    }

    private LocalDate nextInvoiceDate(AdminSubscription subscription, Invoice latestInvoice) {
        if (latestInvoice != null && latestInvoice.getDueAt() != null) {
            return latestInvoice.getDueAt();
        }

        if (subscription.getCreatedAt() != null) {
            return subscription.getCreatedAt().toLocalDate().plusDays(30);
        }

        return LocalDate.now().plusDays(30);
    }

    private AdminSubscriptionResponse toSubscriptionResponse(AdminSubscription subscription, String message) {
        return toSubscriptionResponse(subscription, message, latestInvoice(subscription));
    }

    private AdminSubscriptionResponse toSubscriptionResponse(
            AdminSubscription subscription,
            String message,
            Invoice latestInvoice) {
        AdminSubscriptionStatus status = refreshAndComputeSubscriptionStatus(subscription, latestInvoice);
        LocalDate nextInvoice = nextInvoiceDate(subscription, latestInvoice);

        return AdminSubscriptionResponse.builder()
                .companyName(subscription.getCompanyName())
                .contactEmail(subscription.getContactEmail())
                .plan(normalizePlan(subscription.getPlan()))
                .createdAt(subscription.getCreatedAt() == null ? null : subscription.getCreatedAt().toString())
                .active(subscription.getActive())
                .status(status.name())
                .nextInvoice(nextInvoice == null ? null : nextInvoice.toString())
                .latestInvoiceStatus(latestInvoice == null ? null : latestInvoice.getStatus().name())
                .latestInvoiceDueAt(latestInvoice == null || latestInvoice.getDueAt() == null
                        ? null
                        : latestInvoice.getDueAt().toString())
                .message(message)
                .build();
    }

    private AccountProfileResponse toClientProfile(User user, String token) {
        return new AccountProfileResponse(
                user.getFullName(),
                user.getEmail(),
                user.getRole().name(),
                user.getOauthProvider().name(),
                hasLocalPassword(user),
                token);
    }

    private CompanyAdminProfileResponse toCompanyProfile(User user, AdminSubscription subscription, String token) {
        return new CompanyAdminProfileResponse(
                subscription.getCompanyName(),
                user.getEmail(),
                normalizePlan(subscription.getPlan()),
                subscription.getActive(),
                user.getOauthProvider().name(),
                hasLocalPassword(user),
                token);
    }

    private boolean hasLocalPassword(User user) {
        if (user.getLocalPasswordSet() != null) {
            return user.getLocalPasswordSet();
        }
        return user.getOauthProvider() != OAuthProvider.GOOGLE;
    }

    private void syncCompanyAdminActive(AdminSubscription subscription, boolean active) {
        userRepository.findByEmailIgnoreCase(subscription.getContactEmail()).ifPresent(user -> {
            if (user.getRole() == Role.ADMIN) {
                user.setActive(active);
                userRepository.save(user);
            }
        });
    }

    private String issueToken(User user) {
        var userDetails = customUserDetailsService.loadUserByUsername(user.getEmail());
        return jwtService.generateToken(userDetails,
                Map.of("role", user.getRole().name(), "fullName", user.getFullName()));
    }

    private String normalizeEmail(String email) {
        return email == null ? "" : email.trim().toLowerCase();
    }

    private String normalizePlan(String plan) {
        String value = plan == null ? "" : plan.trim().toUpperCase();
        return switch (value) {
            case "BASIC" -> "BASIC";
            case "STANDARD", "ENTERPRISE" -> "STANDARD";
            case "PREMIUM", "PRO" -> "PREMIUM";
            default -> throw new IllegalArgumentException("Plan invalide. Valeurs acceptees: BASIC, STANDARD, PREMIUM");
        };
    }
}
