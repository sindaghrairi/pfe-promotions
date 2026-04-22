import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import {
  PlatformAdminInvoice,
  PlatformAdminInvoiceResponse,
  PlatformAdminStats,
  PlatformAdminSubscription,
  PlatformAdminUser,
  PlatformUserRole
} from '../models/platform-admin.model';

@Injectable({ providedIn: 'root' })
export class PlatformAdminService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = 'http://localhost:8081/api/platform-admin';

  getDashboardStats(): Observable<PlatformAdminStats> {
    return this.http.get<PlatformAdminStats>(`${this.apiUrl}/dashboard/stats`);
  }

  listUsers(): Observable<PlatformAdminUser[]> {
    return this.http.get<PlatformAdminUser[]>(`${this.apiUrl}/users`);
  }

  updateUserRole(userId: number, role: PlatformUserRole): Observable<PlatformAdminUser> {
    return this.http.put<PlatformAdminUser>(`${this.apiUrl}/users/${userId}/role`, { role });
  }

  deleteUser(userId: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/users/${userId}`);
  }

  listSubscriptions(): Observable<PlatformAdminSubscription[]> {
    return this.http.get<PlatformAdminSubscription[]>(`${this.apiUrl}/subscriptions`);
  }

  listInvoices(): Observable<PlatformAdminInvoiceResponse> {
    return this.http.get<PlatformAdminInvoiceResponse>(`${this.apiUrl}/invoices`);
  }

  getInvoiceById(invoiceId: number): Observable<PlatformAdminInvoice> {
    return this.http.get<PlatformAdminInvoice>(`${this.apiUrl}/invoices/${invoiceId}`);
  }
}
