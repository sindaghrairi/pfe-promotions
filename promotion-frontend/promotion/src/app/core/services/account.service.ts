import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import {
  AccountProfileResponse,
  AccountProfileUpdateRequest,
  ChangePasswordRequest,
  CompanyAdminProfileResponse,
  CompanyAdminProfileUpdateRequest,
  CompanySubscriptionUpdateRequest,
  AdminSubscriptionResponse,
  MessageResponse,
  SetPasswordRequest
} from '../models/auth.model';

@Injectable({ providedIn: 'root' })
export class AccountService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = 'http://localhost:8081/api';

  getMyProfile(): Observable<AccountProfileResponse> {
    return this.http.get<AccountProfileResponse>(`${this.apiUrl}/account/me`);
  }

  updateMyProfile(payload: AccountProfileUpdateRequest): Observable<AccountProfileResponse> {
    return this.http.put<AccountProfileResponse>(`${this.apiUrl}/account/me`, payload);
  }

  changePassword(payload: ChangePasswordRequest): Observable<MessageResponse> {
    return this.http.patch<MessageResponse>(`${this.apiUrl}/account/password`, payload);
  }

  setPassword(payload: SetPasswordRequest): Observable<MessageResponse> {
    return this.http.patch<MessageResponse>(`${this.apiUrl}/account/set-password`, payload);
  }

  getCompanyProfile(): Observable<CompanyAdminProfileResponse> {
    return this.http.get<CompanyAdminProfileResponse>(`${this.apiUrl}/company-admin/profile`);
  }

  updateCompanyProfile(payload: CompanyAdminProfileUpdateRequest): Observable<CompanyAdminProfileResponse> {
    return this.http.put<CompanyAdminProfileResponse>(`${this.apiUrl}/company-admin/profile`, payload);
  }

  changeCompanyPassword(payload: ChangePasswordRequest): Observable<MessageResponse> {
    return this.http.patch<MessageResponse>(`${this.apiUrl}/company-admin/password`, payload);
  }

  setCompanyPassword(payload: SetPasswordRequest): Observable<MessageResponse> {
    return this.http.patch<MessageResponse>(`${this.apiUrl}/company-admin/set-password`, payload);
  }

  updateCompanySubscription(payload: CompanySubscriptionUpdateRequest): Observable<CompanyAdminProfileResponse> {
    return this.http.patch<CompanyAdminProfileResponse>(`${this.apiUrl}/company-admin/subscription`, payload);
  }

  getCompanySubscription(): Observable<AdminSubscriptionResponse> {
    return this.http.get<AdminSubscriptionResponse>(`${this.apiUrl}/company-admin/subscription`);
  }

  reactivateCompanySubscription(): Observable<AdminSubscriptionResponse> {
    return this.http.patch<AdminSubscriptionResponse>(`${this.apiUrl}/company-admin/subscription/reactivate`, {});
  }
}
