import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { LoginRequest } from '../../core/models/auth.model';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-platform-admin-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './platform-admin-login.component.html',
  styleUrl: './platform-admin-login.component.css'
})
export class PlatformAdminLoginComponent {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(3)]]
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

    const payload: LoginRequest = {
      email: this.form.controls.email.value.trim(),
      password: this.form.controls.password.value
    };

    this.authService.platformAdminLogin(payload).subscribe({
      next: () => {
        this.loading = false;
        this.router.navigate(['/platform-admin/dashboard']);
      },
      error: (error: HttpErrorResponse) => {
        this.loading = false;
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
      return 'Serveur indisponible. Verifiez que le backend tourne sur le port 8081.';
    }

    if (typeof error.error?.error === 'string') {
      return error.error.error;
    }

    return 'Echec de connexion admin plateforme.';
  }
}
