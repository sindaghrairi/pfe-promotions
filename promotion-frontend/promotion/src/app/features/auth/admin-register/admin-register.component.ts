import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { AdminRegisterRequest } from '../../../core/models/auth.model';
import { AuthService } from '../../../core/services/auth.service';
import { TranslationService } from '../../../core/i18n/translation.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { LanguageSwitcherComponent } from '../../../shared/language-switcher/language-switcher.component';

@Component({
  selector: 'app-admin-register',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, TranslatePipe, LanguageSwitcherComponent],
  templateUrl: './admin-register.component.html',
  styleUrl: './admin-register.component.css'
})
export class AdminRegisterComponent {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly translations = inject(TranslationService);

  readonly form = this.fb.nonNullable.group({
    fullName: ['', [Validators.required, Validators.minLength(3)]],
    companyName: ['', [Validators.required, Validators.minLength(2)]],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
    confirmPassword: ['', [Validators.required]]
  });

  loading = false;
  errorMessage = '';
  redirectTo = '/entreprises/entreprise';

  get isConfirmPasswordValid(): boolean {
    const confirmControl = this.form.controls.confirmPassword;
    if (!confirmControl.value) {
      return false;
    }

    return confirmControl.valid && confirmControl.value === this.form.controls.password.value;
  }

  get passwordStrengthPercent(): number {
    const password = this.form.controls.password.value;
    if (!password) {
      return 0;
    }

    let score = 0;

    if (password.length >= 8) {
      score += 30;
    } else if (password.length >= 6) {
      score += 15;
    }

    if (/[a-z]/.test(password)) {
      score += 20;
    }

    if (/[A-Z]/.test(password)) {
      score += 20;
    }

    if (/\d/.test(password)) {
      score += 15;
    }

    if (/[^A-Za-z0-9]/.test(password)) {
      score += 15;
    }

    return Math.min(100, score);
  }

  get passwordStrengthLabel(): string {
    if (this.passwordStrengthPercent >= 75) {
      return this.t('ADMIN_REGISTER.STRENGTH_STRONG');
    }

    if (this.passwordStrengthPercent >= 45) {
      return this.t('ADMIN_REGISTER.STRENGTH_MEDIUM');
    }

    return this.t('ADMIN_REGISTER.STRENGTH_WEAK');
  }

  constructor() {
    this.route.queryParamMap.subscribe((params) => {
      const email = params.get('email') ?? '';
      const companyName = params.get('companyName') ?? '';
      const redirectTo = params.get('redirectTo');

      if (redirectTo?.startsWith('/')) {
        this.redirectTo = redirectTo;
      }

      if (email) {
        this.form.controls.email.setValue(email);
      }

      if (companyName) {
        this.form.controls.companyName.setValue(companyName);
        if (!redirectTo) {
          this.redirectTo = this.buildCompanyRedirect(companyName);
        }
      }
    });
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    if (this.form.controls.password.value !== this.form.controls.confirmPassword.value) {
      this.errorMessage = this.t('ADMIN_REGISTER.PASSWORD_MISMATCH');
      return;
    }

    this.loading = true;
    this.errorMessage = '';

    const payload: AdminRegisterRequest = {
      fullName: this.form.controls.fullName.value,
      companyName: this.form.controls.companyName.value,
      email: this.form.controls.email.value,
      password: this.form.controls.password.value
    };

    this.authService.adminRegister(payload).subscribe({
      next: () => {
        this.loading = false;
        this.router.navigateByUrl(this.redirectTo);
      },
      error: (error: HttpErrorResponse) => {
        this.loading = false;
        this.errorMessage = this.extractApiError(error);
      }
    });
  }

  hasError(controlName: 'fullName' | 'companyName' | 'email' | 'password' | 'confirmPassword', errorName: string): boolean {
    const control = this.form.controls[controlName];
    return control.touched && control.hasError(errorName);
  }

  isControlValid(controlName: 'fullName' | 'companyName' | 'email' | 'password' | 'confirmPassword'): boolean {
    const control = this.form.controls[controlName];
    return control.touched && control.valid;
  }

  private extractApiError(error: HttpErrorResponse): string {
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

    return this.t('ADMIN_REGISTER.CREATE_ERROR');
  }

  private t(key: string, params?: Record<string, string | number>): string {
    return this.translations.translate(key, params);
  }

  private buildCompanyRedirect(companyName: string): string {
    const slug = companyName
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    return `/entreprises/${slug || 'entreprise'}`;
  }
}
