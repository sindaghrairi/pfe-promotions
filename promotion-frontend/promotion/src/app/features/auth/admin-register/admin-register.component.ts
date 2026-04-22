import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { AdminRegisterRequest } from '../../../core/models/auth.model';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-admin-register',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './admin-register.component.html',
  styleUrl: './admin-register.component.css'
})
export class AdminRegisterComponent {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

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
      this.errorMessage = 'Les mots de passe ne correspondent pas.';
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

    return "Echec de creation du compte admin. Veuillez reessayer.";
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
