import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import {
  PromotionAiEvaluationRequest,
  PromotionAiEvaluationResponse
} from '../models/ai-promotion.model';
import { AuthService } from './auth.service';

@Injectable({ providedIn: 'root' })
export class AiPromotionService {
  private readonly http = inject(HttpClient);
  private readonly authService = inject(AuthService);
  private readonly apiUrl = 'http://localhost:8081/api/ai';

  evaluatePromotion(payload: PromotionAiEvaluationRequest): Observable<PromotionAiEvaluationResponse> {
    const token = this.authService.getToken();
    const options = token
      ? { headers: { Authorization: `Bearer ${token}` } }
      : undefined;

    return this.http.post<PromotionAiEvaluationResponse>(`${this.apiUrl}/evaluate-promotion`, payload, options);
  }
}
