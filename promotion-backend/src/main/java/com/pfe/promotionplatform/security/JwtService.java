package com.pfe.promotionplatform.security;

import java.nio.charset.StandardCharsets;
import java.util.Date;
import java.util.Map;
import java.util.function.Function;

import javax.crypto.SecretKey;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.stereotype.Service;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.io.Decoders;
import io.jsonwebtoken.security.Keys;

@Service
public class JwtService {

	private final String secret;
	private final long expirationMs;

	public JwtService(
			@Value("${app.jwt.secret}") String secret,
			@Value("${app.jwt.expiration-ms}") long expirationMs) {
		this.secret = secret;
		this.expirationMs = expirationMs;
	}

	public String extractUsername(String token) {
		return extractClaim(token, Claims::getSubject);
	}

	public <T> T extractClaim(String token, Function<Claims, T> claimsResolver) {
		Claims claims = extractAllClaims(token);
		return claimsResolver.apply(claims);
	}

	public String generateToken(UserDetails userDetails, Map<String, Object> extraClaims) {
		Date now = new Date();
		Date expiration = new Date(now.getTime() + expirationMs);

		return Jwts.builder()
				.claims(extraClaims)
				.subject(userDetails.getUsername())
				.issuedAt(now)
				.expiration(expiration)
				.signWith(getSignInKey())
				.compact();
	}

	public boolean isTokenValid(String token, UserDetails userDetails) {
		String username = extractUsername(token);
		return username != null
				&& username.equals(userDetails.getUsername())
				&& !isTokenExpired(token);
	}

	private boolean isTokenExpired(String token) {
		Date expiration = extractClaim(token, Claims::getExpiration);
		return expiration.before(new Date());
	}

	private Claims extractAllClaims(String token) {
		return Jwts.parser()
				.verifyWith(getSignInKey())
				.build()
				.parseSignedClaims(token)
				.getPayload();
	}

	private SecretKey getSignInKey() {
		byte[] keyBytes;
		try {
			keyBytes = Decoders.BASE64.decode(secret);
		} catch (IllegalArgumentException ex) {
			keyBytes = secret.getBytes(StandardCharsets.UTF_8);
		}
		return Keys.hmacShaKeyFor(keyBytes);
	}
}
