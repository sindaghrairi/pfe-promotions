package com.pfe.promotionplatform.service;

import java.math.BigDecimal;
import java.time.Duration;
import java.util.List;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.reactive.function.client.WebClientResponseException;

import com.fasterxml.jackson.databind.ObjectMapper;

import jakarta.annotation.PostConstruct;

@Service
public class MarketingCopyAiService {

    private static final Logger log = LoggerFactory.getLogger(MarketingCopyAiService.class);
    private static final Duration GEMINI_TIMEOUT = Duration.ofSeconds(30);

    private final ObjectMapper objectMapper;
    private final WebClient webClient;
    private final String apiKey;
    private final String model;
    private final String baseUrl;
    private boolean missingKeyLogged;

    public MarketingCopyAiService(
            ObjectMapper objectMapper,
            WebClient webClient,
            @Value("${app.gemini.api-key:}") String apiKey,
            @Value("${app.gemini.model:gemini-2.5-flash}") String model,
            @Value("${app.gemini.base-url:https://generativelanguage.googleapis.com/v1beta}") String baseUrl) {
        this.objectMapper = objectMapper;
        this.webClient = webClient;
        this.apiKey = apiKey == null ? "" : apiKey.trim();
        this.model = model == null || model.isBlank() ? "gemini-2.5-flash" : model.trim();
        this.baseUrl = trimTrailingSlash(baseUrl);
    }

    @PostConstruct
    void logGeminiConfiguration() {
        log.info("Gemini marketing copy configuration: apiKeyDetected={} apiKeyLength={} model={} baseUrl={}",
                hasApiKey(),
                apiKey.length(),
                model,
                baseUrl);
    }

    public MarketingCopyResult generateMarketingCopy(
            String promotionTitle,
            String category,
            BigDecimal initialPrice,
            BigDecimal promotionalPrice,
            BigDecimal discountPercent,
            int aiScore,
            List<String> symbolicRecommendations) {

        if (!hasApiKey()) {
            if (!missingKeyLogged) {
                log.warn("Gemini fallback cause: GEMINI_API_KEY missing. apiKeyDetected=false apiKeyLength=0");
                missingKeyLogged = true;
            }
            return fallbackResult("Gemini indisponible: cle API manquante.");
        }

        String prompt = buildPrompt(
                promotionTitle,
                category,
                initialPrice,
                promotionalPrice,
                discountPercent,
                aiScore,
                symbolicRecommendations);

        GeminiGenerateContentRequest request = new GeminiGenerateContentRequest(
                List.of(new GeminiContent(
                        "user",
                        List.of(new GeminiPart(prompt)))),
                new GeminiGenerationConfig("application/json", 0.4));

        log.info(
                "Gemini call attempt: model={} apiKeyDetected={} apiKeyLength={} score={} category={} promptLength={} recommendationsCount={}",
                model,
                hasApiKey(),
                apiKey.length(),
                aiScore,
                valueOrFallback(category),
                prompt.length(),
                symbolicRecommendations == null ? 0 : symbolicRecommendations.size());

        GeminiGenerateContentResponse response;
        try {
            log.info("Gemini call before request: sending generateContent request.");
            response = webClient.post()
                    .uri(geminiGenerateContentUrl())
                    .header("x-goog-api-key", apiKey)
                    .contentType(MediaType.APPLICATION_JSON)
                    .accept(MediaType.APPLICATION_JSON)
                    .bodyValue(request)
                    .retrieve()
                    .bodyToMono(GeminiGenerateContentResponse.class)
                    .block(GEMINI_TIMEOUT);
            log.info("Gemini call after request: response received candidates={} promptFeedbackPresent={}",
                    response == null || response.candidates() == null ? 0 : response.candidates().size(),
                    response != null && response.promptFeedback() != null);
        } catch (WebClientResponseException ex) {
            log.error("Gemini call failed: status={} errorType={} message={} responseBody={}",
                    ex.getStatusCode(),
                    ex.getClass().getName(),
                    ex.getMessage(),
                    ex.getResponseBodyAsString(),
                    ex);
            return fallbackResult("Gemini indisponible: appel API echoue.");
        } catch (Exception ex) {
            log.error("Gemini call failed: errorType={} message={}",
                    ex.getClass().getName(),
                    ex.getMessage(),
                    ex);
            return fallbackResult("Gemini indisponible: appel API echoue.");
        }

        String output = extractOutputText(response);
        log.info("Gemini raw text received: length={} preview={}",
                output == null ? 0 : output.length(),
                preview(output));

        MarketingCopyResult result = parseMarketingCopy(output);
        log.info("Gemini marketing copy parsed: titlePresent={} descriptionPresent={} recommendationPresent={} fallbackPresent={}",
                hasText(result.proposedTitle()),
                hasText(result.suggestedDescription()),
                hasText(result.reformulatedRecommendation()),
                hasText(result.fallbackMessage()));
        return result;
    }

    public String generateMarketingRecommendation(String recommendation) {
        return "Analyse interne conservee : "
                + (recommendation == null || recommendation.isBlank()
                        ? "aucune recommandation interne exploitable."
                        : recommendation.trim());
    }

    public MarketingCopyResult fallbackResult(String reason) {
        log.warn("Gemini fallback returned: reason={}", reason);
        return new MarketingCopyResult(null, null, null, reason);
    }

    private String buildPrompt(
            String promotionTitle,
            String category,
            BigDecimal initialPrice,
            BigDecimal promotionalPrice,
            BigDecimal discountPercent,
            int aiScore,
            List<String> symbolicRecommendations) {

        return """
                Tu es un assistant marketing intelligent integre a une plateforme web de gestion des promotions
                commerciales pour entreprises.

                Contexte :
                - L'analyse principale est une IA symbolique interne basee sur des regles metier.
                - Tu ne dois pas modifier le score, les anomalies ou les recommandations internes.
                - Ton role est uniquement de proposer un meilleur texte marketing.
                - Le formulaire ne contient pas de description existante.

                Donnees :
                - Titre actuel : %s
                - Categorie : %s
                - Prix initial : %s
                - Prix promotionnel : %s
                - Reduction calculee : %s
                - Score IA interne : %d/100
                - Recommandations internes :
                %s

                Contraintes :
                - N'invente aucune information absente des donnees.
                - Ne promets pas de resultats commerciaux certains.
                - Respecte les alertes et limites de l'analyse interne.
                - Redige en francais professionnel, naturel et concis.

                Reponds uniquement avec un objet JSON valide, sans Markdown, sans commentaire, avec exactement ces cles :
                {
                  "proposedTitle": "un titre marketing court et attractif",
                  "suggestedDescription": "une description marketing suggeree de 2 phrases maximum",
                  "reformulatedRecommendation": "une recommandation reformulee claire pour aider l'admin societe"
                }
                """.formatted(
                valueOrFallback(promotionTitle),
                valueOrFallback(category),
                valueOrFallback(initialPrice),
                valueOrFallback(promotionalPrice),
                discountPercent == null ? "Non calculee" : discountPercent.toPlainString() + "%",
                aiScore,
                formatRecommendations(symbolicRecommendations));
    }

    private MarketingCopyResult parseMarketingCopy(String output) {
        if (!hasText(output)) {
            log.warn("Gemini fallback cause: response text is empty or blank.");
            return fallbackResult("Gemini indisponible: reponse vide.");
        }

        String json = extractJsonObject(output);
        log.info("Gemini JSON parse attempt: extractedJsonLength={} extractedJsonPreview={}",
                json.length(),
                preview(json));
        try {
            MarketingCopyJson result = objectMapper.readValue(json, MarketingCopyJson.class);
            if (!hasText(result.proposedTitle())
                    && !hasText(result.suggestedDescription())
                    && !hasText(result.reformulatedRecommendation())) {
                log.warn("Gemini fallback cause: JSON parsed but expected fields are empty. rawOutputPreview={}",
                        preview(output));
                return fallbackResult("Gemini indisponible: reponse inexploitable.");
            }

            return new MarketingCopyResult(
                    nullIfBlank(result.proposedTitle()),
                    nullIfBlank(result.suggestedDescription()),
                    nullIfBlank(result.reformulatedRecommendation()),
                    null);
        } catch (Exception ex) {
            log.warn("Gemini fallback cause: JSON parsing failed. errorType={} message={} rawOutputPreview={}",
                    ex.getClass().getName(),
                    ex.getMessage(),
                    preview(output),
                    ex);
            return fallbackResult("Gemini indisponible: reponse non parseable.");
        }
    }

    private String extractOutputText(GeminiGenerateContentResponse response) {
        if (response == null || response.candidates() == null) {
            return "";
        }

        return response.candidates().stream()
                .filter(candidate -> candidate.content() != null && candidate.content().parts() != null)
                .flatMap(candidate -> candidate.content().parts().stream())
                .map(GeminiPart::text)
                .filter(this::hasText)
                .reduce((left, right) -> left + System.lineSeparator() + right)
                .orElse("");
    }

    private String geminiGenerateContentUrl() {
        return baseUrl + "/models/" + model + ":generateContent";
    }

    private boolean hasApiKey() {
        return !apiKey.isBlank();
    }

    private String preview(String value) {
        if (value == null) {
            return "";
        }

        String compact = value.replaceAll("\\s+", " ").trim();
        if (compact.length() <= 500) {
            return compact;
        }
        return compact.substring(0, 500) + "...";
    }

    private String extractJsonObject(String output) {
        String trimmed = output.trim();
        int start = trimmed.indexOf('{');
        int end = trimmed.lastIndexOf('}');
        if (start >= 0 && end > start) {
            return trimmed.substring(start, end + 1);
        }
        return trimmed;
    }

    private String formatRecommendations(List<String> recommendations) {
        if (recommendations == null || recommendations.isEmpty()) {
            return "- Aucune recommandation interne fournie.";
        }

        return recommendations.stream()
                .filter(recommendation -> recommendation != null && !recommendation.isBlank())
                .map(recommendation -> "- " + recommendation.trim())
                .reduce((left, right) -> left + System.lineSeparator() + right)
                .orElse("- Aucune recommandation interne exploitable.");
    }

    private boolean hasText(String value) {
        return value != null && !value.isBlank();
    }

    private String nullIfBlank(String value) {
        return hasText(value) ? value.trim() : null;
    }

    private String valueOrFallback(String value) {
        return value == null || value.isBlank() ? "Non renseigne" : value.trim();
    }

    private String valueOrFallback(BigDecimal value) {
        return value == null ? "Non renseigne" : value.toPlainString();
    }

    private String trimTrailingSlash(String value) {
        if (value == null || value.isBlank()) {
            return "https://generativelanguage.googleapis.com/v1beta";
        }
        return value.trim().replaceAll("/+$", "");
    }

    private record GeminiGenerateContentRequest(
            List<GeminiContent> contents,
            GeminiGenerationConfig generationConfig) {
    }

    private record GeminiGenerationConfig(
            String responseMimeType,
            Double temperature) {
    }

    private record GeminiGenerateContentResponse(
            List<GeminiCandidate> candidates,
            Object promptFeedback) {
    }

    private record GeminiCandidate(
            GeminiContent content,
            String finishReason) {
    }

    private record GeminiContent(
            String role,
            List<GeminiPart> parts) {
    }

    private record GeminiPart(String text) {
    }

    private record MarketingCopyJson(
            String proposedTitle,
            String suggestedDescription,
            String reformulatedRecommendation) {
    }

    public record MarketingCopyResult(
            String proposedTitle,
            String suggestedDescription,
            String reformulatedRecommendation,
            String fallbackMessage) {
    }
}
