import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { LoginRequest } from '../../../core/models/auth.model';
import { AuthService } from '../../../core/services/auth.service';
import { TranslationService } from '../../../core/i18n/translation.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { LanguageSwitcherComponent } from '../../../shared/language-switcher/language-switcher.component';

@Component({
  selector: 'app-admin-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, TranslatePipe, LanguageSwitcherComponent],
  templateUrl: './admin-login.component.html',
  styleUrl: './admin-login.component.css'
})
export class AdminLoginComponent {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly translations = inject(TranslationService);

  readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]]
  });

  loading = false;
  errorMessage = '';

  loginWithGoogle(): void {
    this.authService.loginWithGoogle(true);
  }

  get authQueryParams(): { redirectTo: string } | undefined {
    const redirectTo = this.route.snapshot.queryParamMap.get('redirectTo');
    if (!redirectTo || !redirectTo.startsWith('/')) {
      return undefined;
    }

    return { redirectTo };
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.loading = true;
    this.errorMessage = '';

    const payload: LoginRequest = {
      email: this.form.controls.email.value.trim().toLowerCase(),
      password: this.form.controls.password.value
    };

    this.authService.adminLogin(payload).subscribe({
      next: () => {
        this.loading = false;
        const redirectTo = this.route.snapshot.queryParamMap.get('redirectTo');
        if (redirectTo?.startsWith('/')) {
          this.router.navigateByUrl(redirectTo);
          return;
        }

        this.authService.me().subscribe({
          next: () => {
            this.router.navigate(['/dashboard']);
          },
          error: () => {
            this.router.navigate(['/dashboard']);
          }
        });
      },
      error: (error: HttpErrorResponse) => {
        this.loading = false;
        console.error('[adminLogin] request failed', {
          status: error.status,
          statusText: error.statusText,
          url: error.url,
          body: error.error
        });
        this.errorMessage = this.extractApiError(error);
      }
    });
  }

  hasError(controlName: 'email' | 'password', errorName: string): boolean {
    const control = this.form.controls[controlName];
    return control.touched && control.hasError(errorName);
  }

  private extractApiError(error: HttpErrorResponse): string {
    if (error.status === 0) {
      return this.translations.translate('ERRORS.BACKEND_SERVER_PORT');
    }

    if (error.status === 401 || error.status === 403) {
      return this.translations.translate('AUTH.ADMIN_ACCESS_DENIED');
    }

    const payload = error.error;

    if (typeof payload?.error === 'string') {
      return payload.error;
    }

    if (payload && typeof payload === 'object') {
      const firstKey = Object.keys(payload)[0];
      if (firstKey && typeof payload[firstKey] === 'string') {
        return payload[firstKey];
      }
    }

    return this.translations.translate('AUTH.ADMIN_LOGIN_ERROR');
  }

}
