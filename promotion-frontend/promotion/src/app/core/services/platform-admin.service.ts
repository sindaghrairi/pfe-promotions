import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import {
  AcquisitionStats,
  PlatformAdminDashboard,
  PlatformAdminInvoice,
  PlatformAdminInvoiceResponse,
  PlatformAdminPlan,
  PlatformAdminPlanPayload,
  PlatformAdminPromotion,
  PlatformAdminStats,
  PlatformCopilotRequest,
  PlatformCopilotResponse,
  PlatformAdminSubscription,
  PlatformAdminUser,
  PlatformDashboardPeriod,
  PlatformUserRole
} from '../models/platform-admin.model';

@Injectable({ providedIn: 'root' })
export class PlatformAdminService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = 'http://localhost:8081/api/platform-admin';

  getDashboardStats(): Observable<PlatformAdminStats> {
    return this.http.get<PlatformAdminStats>(`${this.apiUrl}/dashboard/stats`);
  }

  getAcquisitionStats(): Observable<AcquisitionStats> {
    return this.http.get<AcquisitionStats>(`${this.apiUrl}/dashboard/acquisition-stats`);
  }

  getDashboardAnalytics(period: PlatformDashboardPeriod): Observable<PlatformAdminDashboard> {
    return this.http.get<PlatformAdminDashboard>(`${this.apiUrl}/stats/dashboard`, {
      params: { period }
    });
  }

  askPlatformCopilot(payload: PlatformCopilotRequest): Observable<PlatformCopilotResponse> {
    return this.http.post<PlatformCopilotResponse>(`${this.apiUrl}/ai/copilot/ask`, payload);
  }

  listUsers(): Observable<PlatformAdminUser[]> {
    return this.http.get<PlatformAdminUser[]>(`${this.apiUrl}/users`);
  }

  updateUserRole(userId: number, role: PlatformUserRole): Observable<PlatformAdminUser> {
    return this.http.put<PlatformAdminUser>(`${this.apiUrl}/users/${userId}/role`, { role });
  }

  updateUserStatus(userId: number, active: boolean): Observable<PlatformAdminUser> {
    return this.http.patch<PlatformAdminUser>(`${this.apiUrl}/users/${userId}/status`, { active });
  }

  deleteUser(userId: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/users/${userId}`);
  }

  listSubscriptions(): Observable<PlatformAdminSubscription[]> {
    return this.http.get<PlatformAdminSubscription[]>(`${this.apiUrl}/subscriptions`);
  }

  updateSubscriptionStatus(subscriptionId: number, active: boolean): Observable<PlatformAdminSubscription> {
    return this.http.patch<PlatformAdminSubscription>(`${this.apiUrl}/subscriptions/${subscriptionId}/status`, { active });
  }

  listPromotions(): Observable<PlatformAdminPromotion[]> {
    return this.http.get<PlatformAdminPromotion[]>(`${this.apiUrl}/promotions`);
  }

  listInvoices(): Observable<PlatformAdminInvoiceResponse> {
    return this.http.get<PlatformAdminInvoiceResponse>(`${this.apiUrl}/invoices`);
  }

  getInvoiceById(invoiceId: number): Observable<PlatformAdminInvoice> {
    return this.http.get<PlatformAdminInvoice>(`${this.apiUrl}/invoices/${invoiceId}`);
  }

  markInvoicePaid(invoiceId: number): Observable<PlatformAdminInvoice> {
    return this.http.patch<PlatformAdminInvoice>(`${this.apiUrl}/invoices/${invoiceId}/mark-paid`, {});
  }

  getPlans(): Observable<PlatformAdminPlan[]> {
    return this.http.get<PlatformAdminPlan[]>(`${this.apiUrl}/plans`);
  }

  updatePlan(id: number, payload: PlatformAdminPlanPayload): Observable<PlatformAdminPlan> {
    return this.http.put<PlatformAdminPlan>(`${this.apiUrl}/plans/${id}`, payload);
  }

  togglePlanStatus(id: number, active: boolean): Observable<PlatformAdminPlan> {
    return this.http.patch<PlatformAdminPlan>(`${this.apiUrl}/plans/${id}/status`, { active });
  }
}
