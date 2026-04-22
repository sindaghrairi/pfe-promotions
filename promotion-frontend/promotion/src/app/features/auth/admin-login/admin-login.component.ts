import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { LoginRequest } from '../../../core/models/auth.model';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-admin-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './admin-login.component.html',
  styleUrl: './admin-login.component.css'
})
export class AdminLoginComponent {
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
        const selectedCompanySlug = this.extractCompanySlug(this.route.snapshot.queryParamMap.get('redirectTo'));
        if (selectedCompanySlug) {
          this.router.navigate(['/entreprises', selectedCompanySlug]);
          return;
        }

        this.authService.me().subscribe({
          next: (response) => {
            const connectedCompanySlug = (response.companySlug ?? '').trim();
            if (connectedCompanySlug) {
              this.router.navigate(['/entreprises', connectedCompanySlug]);
              return;
            }

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
      return "Serveur indisponible. Verifiez que le backend tourne sur le port 8081.";
    }

    if (error.status === 401 || error.status === 403) {
      return 'Acces refuse. Verifiez vos identifiants admin.';
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

    return 'Echec de connexion admin. Verifiez vos identifiants.';
  }

  private extractCompanySlug(redirectTo: string | null): string {
    if (!redirectTo || !redirectTo.startsWith('/entreprises/')) {
      return '';
    }

    const segments = redirectTo.split('/').filter(Boolean);
    return segments.length >= 2 ? segments[1] : '';
  }
}
