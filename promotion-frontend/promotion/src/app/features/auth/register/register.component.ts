import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { RegisterRequest } from '../../../core/models/auth.model';
import { AuthService } from '../../../core/services/auth.service';
import { TranslationService } from '../../../core/i18n/translation.service';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { LanguageSwitcherComponent } from '../../../shared/language-switcher/language-switcher.component';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, TranslatePipe, LanguageSwitcherComponent],
  templateUrl: './register.component.html',
  styleUrl: './register.component.css'
})
export class RegisterComponent {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly translations = inject(TranslationService);

  readonly form = this.fb.nonNullable.group({
    fullName: ['', [Validators.required, Validators.minLength(3)]],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
    confirmPassword: ['', [Validators.required]]
  });

  loading = false;
  errorMessage = '';

  loginWithGoogle(): void {
    this.authService.loginWithGoogle();
  }

  get completionPercent(): number {
    const controls = this.form.controls;
    const filledCount = [
      controls.fullName.value,
      controls.email.value,
      controls.password.value,
      controls.confirmPassword.value
    ].filter((value) => value.trim().length > 0).length;

    return Math.round((filledCount / 4) * 100);
  }

  get isPersonalStepDone(): boolean {
    return this.form.controls.fullName.valid && this.form.controls.email.valid;
  }

  get isSecurityStepActive(): boolean {
    return this.form.controls.password.value.length > 0 || this.form.controls.confirmPassword.value.length > 0;
  }

  get isSecurityStepDone(): boolean {
    return this.form.controls.password.valid && this.isConfirmPasswordValid;
  }

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

    const payload: RegisterRequest = {
      fullName: this.form.controls.fullName.value,
      email: this.form.controls.email.value,
      password: this.form.controls.password.value
    };

    this.authService.register(payload).subscribe({
      next: () => {
        this.loading = false;
        const redirectTo = this.safeRedirect(this.route.snapshot.queryParamMap.get('redirectTo'));
        this.router.navigateByUrl(redirectTo);
      },
      error: (error: HttpErrorResponse) => {
        this.loading = false;
        this.errorMessage = this.extractApiError(error);
      }
    });
  }

  hasError(controlName: 'fullName' | 'email' | 'password' | 'confirmPassword', errorName: string): boolean {
    const control = this.form.controls[controlName];
    return control.touched && control.hasError(errorName);
  }

  isControlValid(controlName: 'fullName' | 'email' | 'password' | 'confirmPassword'): boolean {
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

    return this.t('REGISTER.CREATE_ERROR');
  }

  private t(key: string): string {
    return this.translations.translate(key);
  }

  private safeRedirect(redirectTo: string | null): string {
    if (!redirectTo || !redirectTo.startsWith('/')) {
      return '/dashboard';
    }

    return redirectTo;
  }
}
