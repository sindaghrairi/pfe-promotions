import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import {
  CompanyAdminDashboardResponse,
  CompanyCouponResponse,
  CompanyDashboardPeriod,
  PromotionDto,
  PromotionPayload
} from '../models/promo.model';

@Injectable({ providedIn: 'root' })
export class PromotionService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = 'http://localhost:8081/api/promotions';
  private readonly catalogUrl = 'http://localhost:8081/api/catalog';
  private readonly companyAdminUrl = 'http://localhost:8081/api/company-admin';

  listCompanyPromotions(companySlug: string): Observable<PromotionDto[]> {
    return this.http.get<PromotionDto[]>(`${this.apiUrl}/company/${companySlug}`);
  }

  getCompanyAdminDashboard(period: CompanyDashboardPeriod): Observable<CompanyAdminDashboardResponse> {
    return this.http.get<CompanyAdminDashboardResponse>(`${this.companyAdminUrl}/dashboard`, {
      params: { period }
    });
  }

  getCompanyCoupons(): Observable<CompanyCouponResponse[]> {
    return this.http.get<CompanyCouponResponse[]>(`${this.companyAdminUrl}/coupons`);
  }

  listPublishedPromotions(companySlug: string): Observable<PromotionDto[]> {
    return this.http.get<PromotionDto[]>(`${this.apiUrl}/company/${companySlug}/published`);
  }

  listPublishedCompanySlugs(): Observable<string[]> {
    return this.http.get<string[]>(`${this.catalogUrl}/companies/published`);
  }

  listAllPublishedPromotions(): Observable<PromotionDto[]> {
    return this.http.get<PromotionDto[]>(`${this.catalogUrl}/promotions/published`);
  }

  createPromotion(companySlug: string, payload: PromotionPayload): Observable<PromotionDto> {
    return this.http.post<PromotionDto>(`${this.apiUrl}/company/${companySlug}`, payload);
  }

  updatePromotion(companySlug: string, promotionId: number, payload: PromotionPayload): Observable<PromotionDto> {
    return this.http.put<PromotionDto>(`${this.apiUrl}/company/${companySlug}/${promotionId}`, payload);
  }

  claimCoupon(companySlug: string, promotionId: number): Observable<PromotionDto> {
    return this.http.post<PromotionDto>(`${this.apiUrl}/company/${companySlug}/${promotionId}/claim`, {});
  }

  incrementPromotionViews(companySlug: string, promotionId: number): Observable<PromotionDto> {
    return this.http.post<PromotionDto>(`${this.apiUrl}/company/${companySlug}/${promotionId}/view`, {});
  }

  deletePromotion(companySlug: string, promotionId: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/company/${companySlug}/${promotionId}`);
  }
}
