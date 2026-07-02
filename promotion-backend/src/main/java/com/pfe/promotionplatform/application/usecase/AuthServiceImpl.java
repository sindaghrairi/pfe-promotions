package com.pfe.promotionplatform.application.usecase;

import java.text.Normalizer;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import com.pfe.promotionplatform.presentation.dto.AdminRegisterRequest;
import com.pfe.promotionplatform.presentation.dto.AdminSubscriptionResponse;
import com.pfe.promotionplatform.presentation.dto.AdminSubscribeRequest;
import com.pfe.promotionplatform.presentation.dto.AuthResponse;
import com.pfe.promotionplatform.presentation.dto.LoginRequest;
import com.pfe.promotionplatform.presentation.dto.MessageResponse;
import com.pfe.promotionplatform.presentation.dto.PlatformAdminPlanDto;
import com.pfe.promotionplatform.presentation.dto.RegisterRequest;
import com.pfe.promotionplatform.domain.model.AdminSubscription;
import com.pfe.promotionplatform.domain.model.AdminSubscriptionStatus;
import com.pfe.promotionplatform.domain.model.Plan;
import com.pfe.promotionplatform.domain.model.Role;
import com.pfe.promotionplatform.domain.model.User;
import com.pfe.promotionplatform.domain.port.out.AdminSubscriptionRepository;
import com.pfe.promotionplatform.domain.port.out.PlanRepository;
import com.pfe.promotionplatform.domain.port.out.UserRepository;
import com.pfe.promotionplatform.infrastructure.security.CustomUserDetailsService;
import com.pfe.promotionplatform.infrastructure.security.JwtService;
import com.pfe.promotionplatform.domain.port.in.AuthService;
import com.pfe.promotionplatform.application.usecase.SubscriptionInvoiceService;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class AuthServiceImpl implements AuthService {

        private static final Logger log = LoggerFactory.getLogger(AuthServiceImpl.class);
        private final AdminSubscriptionRepository adminSubscriptionRepository;
    private final PlanRepository planRepository;
    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final CustomUserDetailsService customUserDetailsService;
    private final SubscriptionInvoiceService subscriptionInvoiceService;

        @PostConstruct
        void normalizeLegacyData() {
                int updated = adminSubscriptionRepository.normalizePlans();
                if (updated > 0) {
                        log.info("Normalized {} subscription plan value(s) to BASIC/STANDARD/PREMIUM", updated);
                }

                int subscriptionStatuses = adminSubscriptionRepository.markLegacySubscriptionStatuses();
                if (subscriptionStatuses > 0) {
                        log.info("Marked {} legacy subscription status value(s)", subscriptionStatuses);
                }

                int googlePasswords = userRepository.markLegacyGoogleUsersWithoutLocalPassword();
                int localPasswords = userRepository.markLegacyLocalUsersWithLocalPassword();
                if (googlePasswords > 0 || localPasswords > 0) {
                        log.info("Normalized local password flag for {} Google and {} local legacy user(s)",
                                        googlePasswords,
                                        localPasswords);
                }

                int activeUsers = userRepository.markLegacyUsersActive();
                if (activeUsers > 0) {
                        log.info("Marked {} legacy user(s) as active", activeUsers);
                }

                int invoices = subscriptionInvoiceService.backfillActiveSubscriptionsWithoutInvoice();
                if (invoices > 0) {
                        log.info("Created {} missing subscription invoice(s)", invoices);
                }
        }

        @Override
        public MessageResponse adminSubscribe(AdminSubscribeRequest request) {
                String normalizedContactEmail = normalizeEmail(request.getContactEmail());
                String normalizedPlan = normalizePlan(request.getPlan());
                ensurePlanIsActive(normalizedPlan);

                AdminSubscription existing = adminSubscriptionRepository
                                .findByContactEmailIgnoreCase(normalizedContactEmail)
                                .orElse(null);

                if (existing != null) {
                        if (userRepository.existsByEmailIgnoreCase(normalizedContactEmail)) {
                                throw new IllegalArgumentException("Cet email est deja utilise par un compte");
                        }

                        existing.setCompanyName(request.getCompanyName());
                        existing.setPlan(normalizedPlan);
                        existing.setActive(true);
                        existing.setStatus(AdminSubscriptionStatus.ACTIVE);
                        adminSubscriptionRepository.save(existing);
                        subscriptionInvoiceService.createInitialInvoiceIfMissing(existing);
                        return new MessageResponse("Abonnement actif. Vous pouvez maintenant creer votre compte admin.");
                }

                if (userRepository.existsByEmailIgnoreCase(normalizedContactEmail)) {
                        throw new IllegalArgumentException("Cet email est deja utilise par un compte");
                }

                AdminSubscription subscription = AdminSubscription.builder()
                                .companyName(request.getCompanyName())
                                .contactEmail(normalizedContactEmail)
                                .plan(normalizedPlan)
                                .active(true)
                                .status(AdminSubscriptionStatus.ACTIVE)
                                .build();

                adminSubscriptionRepository.save(subscription);
                subscriptionInvoiceService.createInitialInvoiceIfMissing(subscription);
                return new MessageResponse("Abonnement active. Vous pouvez maintenant creer votre compte admin.");
        }

        @Override
        public AuthResponse adminRegister(AdminRegisterRequest request) {
                String normalizedEmail = normalizeEmail(request.getEmail());

                AdminSubscription subscription = adminSubscriptionRepository
                                .findByContactEmailIgnoreCaseAndActiveTrue(normalizedEmail)
                                .orElseThrow(() -> new IllegalArgumentException("Vous devez d'abord vous abonner"));

                if (!subscription.getCompanyName().equalsIgnoreCase(request.getCompanyName().trim())) {
                        throw new IllegalArgumentException("Le nom de la societe ne correspond pas a l'abonnement");
                }

                if (userRepository.existsByEmailIgnoreCase(normalizedEmail)) {
                        throw new IllegalArgumentException("Cet email existe deja");
                }

                User user = User.builder()
                                .fullName(request.getFullName())
                                .email(normalizedEmail)
                                .password(passwordEncoder.encode(request.getPassword()))
                                .localPasswordSet(true)
                                .role(Role.ADMIN)
                                .build();

                userRepository.save(user);

                var userDetails = customUserDetailsService.loadUserByUsername(user.getEmail());
                String token = jwtService.generateToken(
                                userDetails,
                                Map.of("role", user.getRole().name(), "fullName", user.getFullName()));

                return AuthResponse.builder()
                                .token(token)
                                .email(user.getEmail())
                                .role(user.getRole().name())
                                .build();
        }

        @Override
        public AuthResponse adminLogin(LoginRequest request) {
                String normalizedEmail = normalizeEmail(request.getEmail());
                log.info("adminLogin attempt for email={} ", normalizedEmail);

                User user = userRepository.findByEmailIgnoreCase(normalizedEmail).orElse(null);
                if (user == null) {
                        boolean hasActiveSubscription = adminSubscriptionRepository
                                        .findByContactEmailIgnoreCaseAndActiveTrue(normalizedEmail)
                                        .isPresent();

                        log.warn("adminLogin failed: user not found for email={} (activeSubscription={})",
                                        normalizedEmail,
                                        hasActiveSubscription);

                        if (hasActiveSubscription) {
                                throw new IllegalArgumentException(
                                                "Abonnement actif detecte, mais compte admin non cree. Passez par l'inscription admin.");
                        }

                        throw new IllegalArgumentException("Email ou mot de passe incorrect");
                }

                if (user.getRole() != Role.ADMIN) {
                        log.warn("adminLogin forbidden: email={} has role={}", normalizedEmail, user.getRole());
                        throw new IllegalArgumentException("Ce compte n'est pas un compte admin societe");
                }

                if (!passwordEncoder.matches(request.getPassword(), user.getPassword())) {
                        log.warn("adminLogin failed: invalid password for email={}", normalizedEmail);
                        throw new IllegalArgumentException("Email ou mot de passe incorrect");
                }

                ensureUserCanAuthenticate(user);

                var userDetails = customUserDetailsService.loadUserByUsername(user.getEmail());
                String token = jwtService.generateToken(
                                userDetails,
                                Map.of("role", user.getRole().name(), "fullName", user.getFullName()));

                log.info("adminLogin success for email={} role={}", user.getEmail(), user.getRole());

                return AuthResponse.builder()
                                .token(token)
                                .email(user.getEmail())
                                .role(user.getRole().name())
                                .build();
        }

        @Override
        public AuthResponse platformAdminLogin(LoginRequest request) {
                String normalizedEmail = normalizeEmail(request.getEmail());
                log.info("platformAdminLogin attempt for email={}", normalizedEmail);

                User user = userRepository.findByEmailIgnoreCase(normalizedEmail)
                                .orElseThrow(() -> {
                                        log.warn("platformAdminLogin failed: user not found for email={}", normalizedEmail);
                                        return new IllegalArgumentException("Email ou mot de passe incorrect");
                                });

                if (user.getRole() != Role.PLATFORM_ADMIN) {
                        log.warn("platformAdminLogin forbidden: email={} has role={}", normalizedEmail, user.getRole());
                        throw new IllegalArgumentException("Ce compte n'est pas un compte admin plateforme");
                }

                if (!passwordEncoder.matches(request.getPassword(), user.getPassword())) {
                        log.warn("platformAdminLogin failed: invalid password for email={}", normalizedEmail);
                        throw new IllegalArgumentException("Email ou mot de passe incorrect");
                }

                ensureUserCanAuthenticate(user);

                var userDetails = customUserDetailsService.loadUserByUsername(user.getEmail());
                String token = jwtService.generateToken(
                                userDetails,
                                Map.of("role", user.getRole().name(), "fullName", user.getFullName()));

                log.info("platformAdminLogin success for email={} role={}", user.getEmail(), user.getRole());

                return AuthResponse.builder()
                                .token(token)
                                .email(user.getEmail())
                                .role(user.getRole().name())
                                .build();
        }

    @Override
    public AuthResponse register(RegisterRequest request) {
                String normalizedEmail = normalizeEmail(request.getEmail());

                if (userRepository.existsByEmailIgnoreCase(normalizedEmail)) {
            throw new IllegalArgumentException("Cet email existe deja");
        }

        User user = User.builder()
                .fullName(request.getFullName())
                .email(normalizedEmail)
                .password(passwordEncoder.encode(request.getPassword()))
                .localPasswordSet(true)
                .role(Role.CLIENT)
                .build();

        userRepository.save(user);

        var userDetails = customUserDetailsService.loadUserByUsername(user.getEmail());
        String token = jwtService.generateToken(
                userDetails,
                Map.of("role", user.getRole().name(), "fullName", user.getFullName()));

        return AuthResponse.builder()
                .token(token)
                .email(user.getEmail())
                .role(user.getRole().name())
                .build();
    }

    @Override
    public AuthResponse login(LoginRequest request) {
                String normalizedEmail = normalizeEmail(request.getEmail());
                log.info("login attempt for email={}", normalizedEmail);
                User user = userRepository.findByEmailIgnoreCase(normalizedEmail)
                .orElseThrow(() -> {
                        log.warn("login failed: user not found for email={}", normalizedEmail);
                        return new IllegalArgumentException("Email ou mot de passe incorrect");
                });

        if (!passwordEncoder.matches(request.getPassword(), user.getPassword())) {
            log.warn("login failed: invalid password for email={}", normalizedEmail);
            throw new IllegalArgumentException("Email ou mot de passe incorrect");
        }

        ensureUserCanAuthenticate(user);

        var userDetails = customUserDetailsService.loadUserByUsername(user.getEmail());
        String token = jwtService.generateToken(
                userDetails,
                Map.of("role", user.getRole().name(), "fullName", user.getFullName()));

        log.info("login success for email={} role={}", user.getEmail(), user.getRole());

        return AuthResponse.builder()
                .token(token)
                .email(user.getEmail())
                .role(user.getRole().name())
                .build();
    }

    @Override
    public Map<String, String> me(String email) {
        String normalizedEmail = normalizeEmail(email);

        User user = userRepository.findByEmailIgnoreCase(normalizedEmail)
                .orElseThrow(() -> new IllegalArgumentException("Utilisateur introuvable"));

        Map<String, String> profile = new HashMap<>();
        profile.put("email", user.getEmail());
        profile.put("role", user.getRole().name());

        if (user.getRole() == Role.ADMIN) {
            adminSubscriptionRepository.findByContactEmailIgnoreCaseAndActiveTrue(normalizedEmail).ifPresent(subscription -> {
                profile.put("companyName", subscription.getCompanyName());
                profile.put("companySlug", slugifyCompanyName(subscription.getCompanyName()));
            });
        }

        return profile;
    }

        @Override
        public Map<String, String> platformAdminMe(String email) {
                String normalizedEmail = normalizeEmail(email);

                User user = userRepository.findByEmailIgnoreCase(normalizedEmail)
                                .orElseThrow(() -> new IllegalArgumentException("Utilisateur introuvable"));

                if (user.getRole() != Role.PLATFORM_ADMIN) {
                        throw new IllegalArgumentException("Acces reserve a l'admin plateforme");
                }

                Map<String, String> profile = new HashMap<>();
                profile.put("email", user.getEmail());
                profile.put("role", user.getRole().name());
                profile.put("fullName", user.getFullName());

                return profile;
        }

        @Override
        public AdminSubscriptionResponse adminSubscriptionMe(String email) {
                String normalizedEmail = normalizeEmail(email);

                AdminSubscription subscription = adminSubscriptionRepository
                                .findByContactEmailIgnoreCaseAndActiveTrue(normalizedEmail)
                                .orElseThrow(() -> new IllegalArgumentException("Aucun abonnement actif trouve pour ce compte"));

                return AdminSubscriptionResponse.builder()
                                .companyName(subscription.getCompanyName())
                                .contactEmail(subscription.getContactEmail())
                                .plan(normalizePlan(subscription.getPlan()))
                                .createdAt(subscription.getCreatedAt() == null ? null : subscription.getCreatedAt().toString())
                                .active(subscription.getActive())
                                .build();
        }

        @Override
        public AdminSubscriptionResponse adminSubscriptionByCompanyName(String companyName) {
                String normalizedCompany = companyName == null ? "" : companyName.trim();
                if (normalizedCompany.isEmpty()) {
                        throw new IllegalArgumentException("Le nom de la societe est obligatoire");
                }

                AdminSubscription subscription = adminSubscriptionRepository
                                .findTopByCompanyNameIgnoreCaseAndActiveTrueOrderByCreatedAtDesc(normalizedCompany)
                                .orElseThrow(() -> new IllegalArgumentException(
                                                "Aucun abonnement actif trouve pour cette societe"));

                return AdminSubscriptionResponse.builder()
                                .companyName(subscription.getCompanyName())
                                .contactEmail(subscription.getContactEmail())
                                .plan(normalizePlan(subscription.getPlan()))
                                .createdAt(subscription.getCreatedAt() == null ? null : subscription.getCreatedAt().toString())
                                .active(subscription.getActive())
                                .build();
        }

        @Override
        public Map<String, Boolean> adminAccountExists(String email, String companyName) {
                String normalizedEmail = normalizeEmail(email);
                if (!normalizedEmail.isEmpty()) {
                        return Map.of("exists", userRepository.existsByEmailIgnoreCase(normalizedEmail));
                }

                String normalizedCompany = companyName == null ? "" : companyName.trim();
                if (normalizedCompany.isEmpty()) {
                        throw new IllegalArgumentException("Email ou nom de societe obligatoire");
                }

                AdminSubscription subscription = adminSubscriptionRepository
                                .findTopByCompanyNameIgnoreCaseAndActiveTrueOrderByCreatedAtDesc(normalizedCompany)
                                .orElse(null);

                if (subscription == null) {
                        return Map.of("exists", false);
                }

                String subscriptionEmail = normalizeEmail(subscription.getContactEmail());
                boolean exists = !subscriptionEmail.isEmpty() && userRepository.existsByEmailIgnoreCase(subscriptionEmail);
                return Map.of("exists", exists);
        }

        @Override
        public Map<String, Object> getPlanById(Long planId) {
                if (planId == null || planId <= 0) {
                        throw new IllegalArgumentException("Id de plan invalide");
                }

                Plan plan = planRepository.findById(planId)
                                .orElseThrow(() -> new IllegalArgumentException("Plan introuvable pour cet id"));

                if (!Boolean.TRUE.equals(plan.getActive())) {
                        throw new IllegalArgumentException("Ce plan est actuellement inactif");
                }

                return Map.of(
                                "id", planId,
                                "code", normalizePlan(plan.getName()));
        }

        @Override
        public List<PlatformAdminPlanDto> getActivePlans() {
                return planRepository.findAll().stream()
                                .filter(plan -> isSupportedSubscriptionPlan(plan.getName()))
                                .sorted(Comparator.comparing(Plan::getId))
                                .map(this::toPlanDto)
                                .toList();
        }

        private String normalizeEmail(String email) {
                return email == null ? "" : email.trim().toLowerCase();
        }

        private String slugifyCompanyName(String companyName) {
                if (companyName == null) {
                        return "";
                }

                String normalized = Normalizer.normalize(companyName, Normalizer.Form.NFD)
                                .replaceAll("\\p{M}+", "")
                                .toLowerCase()
                                .replaceAll("[^a-z0-9]+", "-")
                                .replaceAll("^-+|-+$", "");

                return normalized;
        }

        private String normalizePlan(String plan) {
                String value = plan == null ? "" : plan.trim().toUpperCase(Locale.ROOT);

                return switch (value) {
                        case "BASIC" -> "BASIC";
                        case "STANDARD", "ENTERPRISE" -> "STANDARD";
                        case "PREMIUM", "PRO" -> "PREMIUM";
                        default -> throw new IllegalArgumentException(
                                        "Plan invalide. Valeurs acceptees: BASIC, STANDARD, PREMIUM");
                };
        }

        private void ensurePlanIsActive(String planCode) {
                Plan plan = planRepository.findByNameIgnoreCase(planCode)
                                .orElseThrow(() -> new IllegalArgumentException("Plan introuvable"));

                if (!Boolean.TRUE.equals(plan.getActive())) {
                        throw new IllegalArgumentException("Ce plan est actuellement inactif");
                }
        }

        private void ensureUserCanAuthenticate(User user) {
                if (Boolean.FALSE.equals(user.getActive())) {
                        throw new IllegalArgumentException("Votre compte est inactif. Contactez l'admin plateforme.");
                }

                if (user.getRole() == Role.ADMIN
                                && !adminSubscriptionRepository.existsByContactEmailIgnoreCaseAndActiveTrue(user.getEmail())) {
                        throw new IllegalArgumentException(
                                        "Votre abonnement est inactif. Contactez l'admin plateforme.");
                }
        }

        private boolean isSupportedSubscriptionPlan(String plan) {
                try {
                        normalizePlan(plan);
                        return true;
                } catch (IllegalArgumentException ex) {
                        return false;
                }
        }

        private PlatformAdminPlanDto toPlanDto(Plan plan) {
                return new PlatformAdminPlanDto(
                                plan.getId(),
                                normalizePlan(plan.getName()),
                                plan.getPrice(),
                                plan.getDescription(),
                                plan.getDuration(),
                                plan.getActive(),
                                plan.getCreatedAt(),
                                plan.getUpdatedAt());
        }
}
