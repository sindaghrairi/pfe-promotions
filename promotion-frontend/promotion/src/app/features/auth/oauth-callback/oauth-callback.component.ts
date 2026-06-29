import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { AuthService } from '../../../core/services/auth.service';
import { TranslationService } from '../../../core/i18n/translation.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';

@Component({
  selector: 'app-oauth-callback',
  standalone: true,
  imports: [CommonModule, RouterLink, TranslatePipe],
  templateUrl: './oauth-callback.component.html',
  styleUrl: './oauth-callback.component.css'
})
export class OAuthCallbackComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);
  private readonly translations = inject(TranslationService);

  loading = true;
  errorMessage = '';

  ngOnInit(): void {
    const code = this.route.snapshot.queryParamMap.get('code');
    const state = this.route.snapshot.queryParamMap.get('state') || undefined;
    const googleError = this.route.snapshot.queryParamMap.get('error');

    if (googleError) {
      this.loading = false;
      this.errorMessage = this.t('OAUTH.CANCELLED');
      return;
    }

    if (!code) {
      this.loading = false;
      this.errorMessage = this.t('OAUTH.MISSING_CODE');
      return;
    }

    const processingKey = `google_oauth_code_${code}`;
    if (this.isBrowser() && sessionStorage.getItem(processingKey)) {
      this.loading = false;
      this.errorMessage = this.t('OAUTH.ALREADY_PROCESSED');
      return;
    }

    if (this.isBrowser()) {
      sessionStorage.setItem(processingKey, '1');
    }

    this.authService.handleGoogleCallback(code, state).subscribe({
      next: () => {
        this.loading = false;
        this.router.navigateByUrl('/dashboard');
      },
      error: (error: HttpErrorResponse) => {
        this.loading = false;
        this.errorMessage = this.extractApiError(error);
        if (this.isBrowser()) {
          sessionStorage.removeItem(processingKey);
        }
      }
    });
  }

  private extractApiError(error: HttpErrorResponse): string {
    if (typeof error.error?.error === 'string') {
      return error.error.error;
    }

    if (typeof error.error === 'string' && error.error.trim()) {
      return error.error;
    }

    const statusLabel = error.status ? `HTTP ${error.status}` : this.t('OAUTH.NETWORK_ERROR');
    const statusText = error.statusText ? ` - ${error.statusText}` : '';
    return this.t('OAUTH.CALLBACK_ERROR', { status: `${statusLabel}${statusText}` });
  }

  private t(key: string, params?: Record<string, string>): string {
    return this.translations.translate(key, params);
  }

  private isBrowser(): boolean {
    return typeof window !== 'undefined' && typeof sessionStorage !== 'undefined';
  }
}
