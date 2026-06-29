package com.pfe.promotionplatform.security;

import java.io.IOException;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;

@Component
@RequiredArgsConstructor
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private static final Logger log = LoggerFactory.getLogger(JwtAuthenticationFilter.class);

    private final JwtService jwtService;
    private final CustomUserDetailsService userDetailsService;

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {
        String authHeader = request.getHeader("Authorization");
        boolean aiEvaluationRequest = "/api/ai/evaluate-promotion".equals(request.getRequestURI());

        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            if (aiEvaluationRequest) {
                log.info("AI promotion evaluation JWT check: tokenReceived=false path={}", request.getRequestURI());
            }
            filterChain.doFilter(request, response);
            return;
        }

        String jwt = authHeader.substring(7);
        if (aiEvaluationRequest) {
            log.info("AI promotion evaluation JWT check: tokenReceived=true tokenLength={} path={}",
                    jwt.length(),
                    request.getRequestURI());
        }

        try {
            String userEmail = jwtService.extractUsername(jwt);
            String role = jwtService.extractRole(jwt);
            if (aiEvaluationRequest) {
                log.info("AI promotion evaluation JWT claims: email={} role={}", userEmail, role);
            }

            if (userEmail != null && SecurityContextHolder.getContext().getAuthentication() == null) {
                UserDetails userDetails = userDetailsService.loadUserByUsername(userEmail);

                if (!userDetails.isEnabled()) {
                    log.debug("Ignoring JWT for disabled account: {}", userEmail);
                } else if (jwtService.isTokenValid(jwt, userDetails)) {
                    UsernamePasswordAuthenticationToken authToken = new UsernamePasswordAuthenticationToken(
                            userDetails,
                            null,
                            userDetails.getAuthorities());

                    authToken.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
                    SecurityContextHolder.getContext().setAuthentication(authToken);
                    if (aiEvaluationRequest) {
                        log.info("AI promotion evaluation JWT authentication set: email={} authorities={}",
                                userEmail,
                                userDetails.getAuthorities());
                    }
                } else if (aiEvaluationRequest) {
                    log.warn("AI promotion evaluation JWT rejected: email={} reason=invalid_or_expired", userEmail);
                }
            }
        } catch (Exception ex) {
            // Invalid JWT should not break public endpoints; continue as anonymous.
            if (aiEvaluationRequest) {
                log.warn("AI promotion evaluation JWT rejected: path={} reason={}",
                        request.getRequestURI(),
                        ex.getMessage());
            } else {
                log.debug("Ignoring invalid JWT on path={}: {}", request.getRequestURI(), ex.getMessage());
            }
        }

        filterChain.doFilter(request, response);
    }
}
