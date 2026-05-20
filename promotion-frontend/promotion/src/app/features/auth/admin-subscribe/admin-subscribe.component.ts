import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslatePipe } from '../../../core/i18n/translate.pipe';
import { LanguageSwitcherComponent } from '../../../shared/language-switcher/language-switcher.component';

@Component({
  selector: 'app-admin-subscribe',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, TranslatePipe, LanguageSwitcherComponent],
  templateUrl: './admin-subscribe.component.html',
  styleUrl: './admin-subscribe.component.css'
})
export class AdminSubscribeComponent {
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly form = this.fb.nonNullable.group({
    companyName: ['', [Validators.required, Validators.minLength(2)]],
    contactEmail: ['', [Validators.required, Validators.email]]
  });

  get authQueryParams(): { redirectTo: string } | undefined {
    const redirectTo = this.route.snapshot.queryParamMap.get('redirectTo');
    if (!redirectTo || !redirectTo.startsWith('/')) {
      return undefined;
    }

    return { redirectTo };
  }

  goToPaymentTypes(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const companyName = this.form.controls.companyName.value;
    const requestedRedirect = this.route.snapshot.queryParamMap.get('redirectTo');

    this.router.navigate(['/admin/subscribe/payment'], {
      queryParams: {
        email: this.form.controls.contactEmail.value,
        companyName,
        redirectTo:
          requestedRedirect && requestedRedirect.startsWith('/')
            ? requestedRedirect
            : this.buildCompanyRedirect(companyName)
      }
    });
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

  hasError(controlName: 'companyName' | 'contactEmail', errorName: string): boolean {
    const control = this.form.controls[controlName];
    return control.touched && control.hasError(errorName);
  }

  isControlValid(controlName: 'companyName' | 'contactEmail'): boolean {
    const control = this.form.controls[controlName];
    return control.touched && control.valid;
  }
}
