import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, tap } from 'rxjs';

import {
  AdminAccountExistsResponse,
  ActiveAdminPlanResponse,
  AdminPlanResponse,
  AdminRegisterRequest,
  AdminSubscriptionResponse,
  AdminSubscribeRequest,
  AuthResponse,
  LoginRequest,
  MeResponse,
  MessageResponse,
  OAuth2CallbackRequest,
  OAuth2UrlResponse,
  RegisterRequest
} from '../models/auth.model';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);

  private readonly apiUrl = 'http://localhost:8081/api/auth';
  private readonly tokenKey = 'auth_token';
  private readonly emailKey = 'auth_email';
  private readonly roleKey = 'auth_role';

  register(payload: RegisterRequest): Observable<AuthResponse> {
    return this.http
      .post<AuthResponse>(`${this.apiUrl}/register`, payload)
      .pipe(tap((response) => this.saveSession(response)));
  }

  createUser(payload: RegisterRequest): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.apiUrl}/register`, payload);
  }

  adminSubscribe(payload: AdminSubscribeRequest): Observable<MessageResponse> {
    return this.http.post<MessageResponse>(`${this.apiUrl}/admin/subscribe`, payload);
  }

  adminRegister(payload: AdminRegisterRequest): Observable<AuthResponse> {
    return this.http
      .post<AuthResponse>(`${this.apiUrl}/admin/register`, payload)
      .pipe(tap((response) => this.saveSession(response)));
  }

  login(payload: LoginRequest): Observable<AuthResponse> {
    return this.http
      .post<AuthResponse>(`${this.apiUrl}/login`, payload)
      .pipe(tap((response) => this.saveSession(response)));
  }

  loginWithGoogle(admin: boolean = false): void {
    this.logout();
    const params = admin ? '?state=admin' : '';
    this.http.get<OAuth2UrlResponse>(`${this.apiUrl}/oauth2/google/url${params}`).subscribe({
      next: (response) => {
        if (this.isBrowser()) {
          window.location.href = response.url;
        }
      },
      error: () => {
        console.error('[oauth2] unable to fetch Google authorization URL');
      }
    });
  }

  handleGoogleCallback(code: string, state?: string): Observable<AuthResponse> {
    const payload: OAuth2CallbackRequest = { code, state };
    return this.http
      .post<AuthResponse>(`${this.apiUrl}/oauth2/google/callback`, payload)
      .pipe(tap((response) => this.saveSession(response)));
  }

  adminLogin(payload: LoginRequest): Observable<AuthResponse> {
    return this.http
      .post<AuthResponse>(`${this.apiUrl}/admin/login`, payload)
      .pipe(tap((response) => this.saveSession(response)));
  }

  platformAdminLogin(payload: LoginRequest): Observable<AuthResponse> {
    return this.http
      .post<AuthResponse>(`${this.apiUrl}/platform-admin/login`, payload)
      .pipe(tap((response) => this.saveSession(response)));
  }

  me(): Observable<MeResponse> {
    return this.http.get<MeResponse>(`${this.apiUrl}/me`);
  }

  platformAdminMe(): Observable<MeResponse> {
    return this.http.get<MeResponse>(`${this.apiUrl}/platform-admin/me`);
  }

  adminSubscriptionMe(): Observable<AdminSubscriptionResponse> {
    return this.http.get<AdminSubscriptionResponse>(`${this.apiUrl}/admin/subscription/me`);
  }

  adminSubscriptionByCompanyName(companyName: string): Observable<AdminSubscriptionResponse> {
    return this.http.get<AdminSubscriptionResponse>(`${this.apiUrl}/admin/subscription/company`, {
      params: { companyName }
    });
  }

  adminAccountExists(email?: string, companyName?: string): Observable<AdminAccountExistsResponse> {
    const params: Record<string, string> = {};
    if (email?.trim()) {
      params['email'] = email.trim();
    }
    if (companyName?.trim()) {
      params['companyName'] = companyName.trim();
    }

    return this.http.get<AdminAccountExistsResponse>(`${this.apiUrl}/admin/account-exists`, { params });
  }

  getPlanById(planId: number): Observable<AdminPlanResponse> {
    return this.http.get<AdminPlanResponse>(`${this.apiUrl}/admin/plan/${planId}`);
  }

  listActiveAdminPlans(): Observable<ActiveAdminPlanResponse[]> {
    return this.http.get<ActiveAdminPlanResponse[]>(`${this.apiUrl}/admin/plans`);
  }

  logout(): void {
    if (!this.isBrowser()) {
      return;
    }

    localStorage.removeItem(this.tokenKey);
    localStorage.removeItem(this.emailKey);
    localStorage.removeItem(this.roleKey);
  }

  getToken(): string | null {
    if (!this.isBrowser()) {
      return null;
    }

    return localStorage.getItem(this.tokenKey);
  }

  getStoredEmail(): string | null {
    if (!this.isBrowser()) {
      return null;
    }

    return localStorage.getItem(this.emailKey);
  }

  getStoredRole(): string | null {
    if (!this.isBrowser()) {
      return null;
    }

    const storedRole = localStorage.getItem(this.roleKey);
    if (storedRole) {
      return storedRole;
    }

    const token = this.getToken();
    return token ? this.extractRoleFromToken(token) : null;
  }

  isAuthenticated(): boolean {
    const token = this.getToken();
    if (!token) {
      return false;
    }

    if (this.isTokenExpired(token)) {
      this.logout();
      return false;
    }

    return true;
  }

  isAdminAuthenticated(): boolean {
    if (!this.isAuthenticated()) {
      return false;
    }

    return this.getStoredRole() === 'ADMIN';
  }

  isPlatformAdminAuthenticated(): boolean {
    if (!this.isAuthenticated()) {
      return false;
    }

    return this.getStoredRole() === 'PLATFORM_ADMIN';
  }

  refreshStoredSession(token: string | null | undefined, email: string, role: string): void {
    if (!token || !this.isBrowser()) {
      return;
    }

    this.saveSession({ token, email, role });
  }

  private saveSession(response: AuthResponse): void {
    if (!this.isBrowser()) {
      return;
    }

    localStorage.setItem(this.tokenKey, response.token);
    localStorage.setItem(this.emailKey, response.email);
    localStorage.setItem(this.roleKey, (response.role || '').toUpperCase());
  }

  private extractRoleFromToken(token: string): string | null {
    try {
      const payload = this.decodeTokenPayload(token) as { role?: string } | null;
      if (!payload) {
        return null;
      }

      return payload.role ? payload.role.toUpperCase() : null;
    } catch {
      return null;
    }
  }

  private isTokenExpired(token: string): boolean {
    try {
      const payload = this.decodeTokenPayload(token) as { exp?: number } | null;
      if (!payload?.exp) {
        return false;
      }

      const nowSeconds = Math.floor(Date.now() / 1000);
      return payload.exp <= nowSeconds;
    } catch {
      return true;
    }
  }

  private decodeTokenPayload(token: string): Record<string, unknown> | null {
    const parts = token.split('.');
    if (parts.length < 2) {
      return null;
    }

    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
    const payloadJson = atob(padded);
    return JSON.parse(payloadJson) as Record<string, unknown>;
  }

  private isBrowser(): boolean {
    return typeof window !== 'undefined' && typeof localStorage !== 'undefined';
  }
}
