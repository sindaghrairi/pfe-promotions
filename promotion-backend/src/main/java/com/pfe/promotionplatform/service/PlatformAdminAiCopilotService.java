package com.pfe.promotionplatform.service;

import java.time.Duration;
import java.util.List;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.HttpStatusCode;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.reactive.function.client.WebClientResponseException;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.pfe.promotionplatform.dto.PlatformCopilotRequestDto;
import com.pfe.promotionplatform.dto.PlatformCopilotResponseDto;
import com.pfe.promotionplatform.service.PlatformCopilotContextService.PlatformCopilotContext;

import jakarta.annotation.PostConstruct;

@Service
public class PlatformAdminAiCopilotService {

    private static final Logger log = LoggerFactory.getLogger(PlatformAdminAiCopilotService.class);
    private static final Duration GROQ_TIMEOUT = Duration.ofSeconds(30);

    private final ObjectMapper objectMapper;
    private final WebClient webClient;
    private final PlatformCopilotContextService platformCopilotContextService;
    private final String apiKey;
    private final String model;
    private final String baseUrl;
    private boolean missingKeyLogged;

    public PlatformAdminAiCopilotService(
            ObjectMapper objectMapper,
            WebClient webClient,
            PlatformCopilotContextService platformCopilotContextService,
            @Value("${app.groq.api-key:}") String apiKey,
            @Value("${app.groq.model:llama-3.1-8b-instant}") String model,
            @Value("${app.groq.base-url:https://api.groq.com/openai/v1}") String baseUrl) {
        this.objectMapper = objectMapper;
        this.webClient = webClient;
        this.platformCopilotContextService = platformCopilotContextService;
        this.apiKey = apiKey == null ? "" : apiKey.trim();
        this.model = model == null || model.isBlank() ? "llama-3.1-8b-instant" : model.trim();
        this.baseUrl = trimTrailingSlash(baseUrl);
    }

    @PostConstruct
    void logGroqConfiguration() {
        log.info("Groq platform copilot configuration: apiKeyDetected={} apiKeyLength={} model={} baseUrl={}",
                hasApiKey(),
                apiKey.length(),
                model,
                baseUrl);
    }

    public PlatformCopilotResponseDto ask(PlatformCopilotRequestDto request) {
        String question = request == null || request.question() == null || request.question().isBlank()
                ? "Analyse la sante de la plateforme et propose les priorites du jour."
                : request.question().trim();
        String period = request == null || request.period() == null || request.period().isBlank()
                ? "12m"
                : request.period().trim();

        log.info("Platform copilot question received: period={} questionLength={} questionPreview={}",
                period,
                question.length(),
                preview(question));
        PlatformCopilotContext context = platformCopilotContextService.buildContext(period);
        String contextJson = serializeContext(context);
        log.info("Platform copilot context ready: jsonLength={} riskyCompanies={} companiesToWatch={}",
                contextJson.length(),
                context.riskIntelligence().riskyCompanies(),
                context.companiesToWatch().size());

        if (!hasApiKey()) {
            if (!missingKeyLogged) {
                log.warn("Groq fallback cause: GROQ_API_KEY missing. apiKeyDetected=false apiKeyLength=0");
                missingKeyLogged = true;
            }
            return fallbackResponse(context, "Groq indisponible: cle API manquante.");
        }

        log.info("Groq call attempt: model={} apiKeyDetected={} apiKeyLength={} period={} questionLength={}",
                model,
                hasApiKey(),
                apiKey.length(),
                period,
                question.length());

        try {
            GroqChatResponse response = callGroq(question, contextJson, false);
            String answer = extractAnswer(response);
            log.info("Groq answer extracted: answerLength={}", answer.length());
            if (answer.isBlank()) {
                log.warn("Groq fallback used: empty answer.");
                return fallbackResponse(context, "Groq indisponible: reponse vide.");
            }

            log.info("Groq response accepted: fallbackUsed=false answerPreview={}", preview(answer));
            return new PlatformCopilotResponseDto(
                    model,
                    answer,
                    context.riskIntelligence().globalActions(),
                    false);
        } catch (WebClientResponseException ex) {
            log.error("Groq call failed: status={} body={}", ex.getStatusCode(), ex.getResponseBodyAsString(), ex);
            if (shouldRetryWithCompactContext(ex)) {
                try {
                    String compactContextJson = serializeObject(platformCopilotContextService.compact(context));
                    log.warn("Groq retry with compact context: originalStatus={} compactJsonLength={}",
                            ex.getStatusCode(),
                            compactContextJson.length());
                    GroqChatResponse response = callGroq(question, compactContextJson, true);
                    String answer = extractAnswer(response);
                    if (!answer.isBlank()) {
                        log.info("Groq compact retry accepted: fallbackUsed=false answerPreview={}", preview(answer));
                        return new PlatformCopilotResponseDto(
                                model,
                                answer,
                                context.riskIntelligence().globalActions(),
                                false);
                    }
                } catch (WebClientResponseException retryEx) {
                    log.error("Groq compact retry failed: status={} body={}",
                            retryEx.getStatusCode(),
                            retryEx.getResponseBodyAsString(),
                            retryEx);
                    ex = retryEx;
                } catch (Exception retryEx) {
                    log.error("Groq compact retry failed: errorType={} message={}",
                            retryEx.getClass().getName(),
                            retryEx.getMessage(),
                            retryEx);
                }
            }
            log.warn("Groq fallback used: webClientResponseException status={}", ex.getStatusCode());
            return fallbackResponse(context, groqFailureReason(ex));
        } catch (Exception ex) {
            log.error("Groq call failed: errorType={} message={}", ex.getClass().getName(), ex.getMessage(), ex);
            log.warn("Groq fallback used: exceptionType={}", ex.getClass().getName());
            return fallbackResponse(context, "Groq indisponible: appel API echoue.");
        }
    }

    private String systemPrompt() {
        return """
                Tu es un AI Platform Copilot pour un admin plateforme d'une application de gestion des promotions commerciales.
                Tu reponds uniquement aux questions liees a la plateforme SaaS : entreprises, abonnements, factures, revenus, promotions, coupons, utilisateurs, statistiques, risques et actions recommandees.
                Tu n'es pas limite a des intentions fixes : tu comprends la question libre de l'admin et tu exploites le contexte backend.
                Reponds en francais professionnel, clair et concis.
                N'invente jamais de chiffres, d'entreprises, de factures, de revenus ou de dates.
                Utilise uniquement le contexte JSON fourni par le backend PostgreSQL.
                Si une information n'existe pas dans le contexte, reponds exactement : "Je ne dispose pas de cette information dans les donnees actuelles de la plateforme."
                Les scores et risques Company Health Score, inactivite, resiliation et non-paiement sont calcules par le backend. Tu dois seulement les expliquer et les reformuler.
                Explique les KPI simplement, detecte les risques visibles dans le contexte et propose des actions concretes.
                Refuse poliment toute question hors contexte de la plateforme.
                """;
    }

    private String buildUserPrompt(String question, String contextJson) {
        return """
                Question admin :
                %s

                Contexte backend PostgreSQL au format JSON :
                %s

                Consignes de reponse :
                - Reponds directement a la question.
                - Cite uniquement les donnees presentes dans le JSON.
                - Si la question est analytique, donne un diagnostic puis les risques puis les actions.
                - Si la question demande une donnee absente du JSON, indique que tu ne disposes pas de cette information.
                """.formatted(question, contextJson);
    }

    private GroqChatResponse callGroq(String question, String contextJson, boolean compactContext) {
        GroqChatRequest groqRequest = new GroqChatRequest(
                model,
                List.of(
                        new GroqMessage("system", systemPrompt()),
                        new GroqMessage("user", buildUserPrompt(question, contextJson))),
                0.25,
                1000);

        log.info("Groq call launched: endpoint={} model={} compactContext={} contextLength={}",
                baseUrl + "/chat/completions",
                model,
                compactContext,
                contextJson.length());
        GroqChatResponse response = webClient.post()
                .uri(baseUrl + "/chat/completions")
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + apiKey)
                .contentType(MediaType.APPLICATION_JSON)
                .accept(MediaType.APPLICATION_JSON)
                .bodyValue(groqRequest)
                .retrieve()
                .bodyToMono(GroqChatResponse.class)
                .block(GROQ_TIMEOUT);

        log.info("Groq response received: compactContext={} choices={}",
                compactContext,
                response == null || response.choices() == null ? 0 : response.choices().size());
        return response;
    }

    private PlatformCopilotResponseDto fallbackResponse(PlatformCopilotContext context, String reason) {
        var users = context.users();
        var subscriptions = context.subscriptions();
        var promotions = context.promotions();
        var coupons = context.coupons();
        var invoices = context.invoices();
        var revenue = context.revenue();
        var risks = context.riskIntelligence();
        String answer = """
                %s

                Diagnostic automatique :
                La plateforme compte %d utilisateur(s), %d entreprise(s), dont %d abonnement(s) actif(s). Elle totalise %d promotion(s), %d coupon(s) utilise(s) et %s TND de revenus payes.

                Points de vigilance :
                - %d facture(s) en attente et %d facture(s) en retard peuvent impacter le revenu.
                - %d promotion(s) expiree(s) et %d brouillon(s) doivent etre surveilles.
                - Le taux d'utilisation des coupons est de %.1f%%.
                - %d entreprise(s) sont a risque, dont %d critique(s), selon le Risk Intelligence backend.

                Actions recommandees :
                %s
                """.formatted(
                reason,
                users.totalUsers(),
                subscriptions.totalCompanies(),
                subscriptions.activeSubscriptions(),
                promotions.totalPromotions(),
                coupons.usedCoupons(),
                revenue.totalPaidRevenue(),
                invoices.pendingInvoices(),
                invoices.overdueInvoices(),
                promotions.expiredPromotions(),
                promotions.draftPromotions(),
                coupons.usageRate(),
                risks.riskyCompanies(),
                risks.criticalCompanies(),
                formatActions(risks.globalActions()));

        log.info("Platform copilot fallback response built: fallbackUsed=true reason={}", reason);
        return new PlatformCopilotResponseDto(model, answer, risks.globalActions(), true);
    }

    private String serializeContext(PlatformCopilotContext context) {
        return serializeObject(context);
    }

    private String serializeObject(Object value) {
        try {
            return objectMapper.writeValueAsString(value);
        } catch (JsonProcessingException ex) {
            log.error("Platform copilot context serialization failed: errorType={} message={}",
                    ex.getClass().getName(),
                    ex.getMessage(),
                    ex);
            return "{}";
        }
    }

    private boolean shouldRetryWithCompactContext(WebClientResponseException ex) {
        int status = ex.getStatusCode().value();
        return status == 400 || status == 413 || status == 422;
    }

    private String groqFailureReason(WebClientResponseException ex) {
        HttpStatusCode status = ex.getStatusCode();
        int value = status.value();
        if (value == 401 || value == 403) {
            return "Groq indisponible: cle API refusee par Groq. Redemarrez Spring Boot avec la nouvelle variable GROQ_API_KEY.";
        }
        if (value == 429) {
            return "Groq indisponible: limite de requetes ou quota atteint.";
        }
        if (value == 400 || value == 413 || value == 422) {
            return "Groq indisponible: le contexte envoye a ete refuse par l'API.";
        }
        return "Groq indisponible: appel API echoue.";
    }

    private String formatActions(List<String> actions) {
        if (actions == null || actions.isEmpty()) {
            return "1. Continuer la surveillance reguliere de la plateforme.";
        }
        StringBuilder builder = new StringBuilder();
        for (int index = 0; index < actions.size(); index++) {
            builder.append(index + 1).append(". ").append(actions.get(index));
            if (index < actions.size() - 1) {
                builder.append(System.lineSeparator());
            }
        }
        return builder.toString();
    }

    private String extractAnswer(GroqChatResponse response) {
        if (response == null || response.choices() == null || response.choices().isEmpty()) {
            return "";
        }
        GroqChoice choice = response.choices().get(0);
        return choice == null || choice.message() == null || choice.message().content() == null
                ? ""
                : choice.message().content().trim();
    }

    private boolean hasApiKey() {
        return !apiKey.isBlank();
    }

    private String preview(String value) {
        if (value == null) {
            return "";
        }
        String compact = value.replaceAll("\\s+", " ").trim();
        return compact.length() <= 220 ? compact : compact.substring(0, 220) + "...";
    }

    private String trimTrailingSlash(String value) {
        if (value == null || value.isBlank()) {
            return "https://api.groq.com/openai/v1";
        }
        return value.trim().replaceAll("/+$", "");
    }

    private record GroqChatRequest(
            String model,
            List<GroqMessage> messages,
            double temperature,
            int max_tokens) {
    }

    private record GroqMessage(String role, String content) {
    }

    private record GroqChatResponse(List<GroqChoice> choices) {
    }

    private record GroqChoice(GroqMessage message) {
    }
}
