import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { LoginRequest } from '../../../core/models/auth.model';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css'
})
export class LoginComponent {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]]
  });

  loading = false;
  errorMessage = '';

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.loading = true;
    this.errorMessage = '';

    const payload: LoginRequest = this.form.getRawValue();

    this.authService.login(payload).subscribe({
      next: () => {
        this.loading = false;
        const redirectTo = this.safeRedirect(this.route.snapshot.queryParamMap.get('redirectTo'));
        this.router.navigateByUrl(redirectTo);
      },
      error: (error: HttpErrorResponse) => {
        this.loading = false;
        console.error('[login] request failed', {
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

    return 'Echec de connexion. Verifiez vos identifiants.';
  }

  private safeRedirect(redirectTo: string | null): string {
    if (!redirectTo || !redirectTo.startsWith('/')) {
      return '/dashboard';
    }

    return redirectTo;
  }
}
