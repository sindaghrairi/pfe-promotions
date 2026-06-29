import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { ActiveAdminPlanResponse } from '../../core/models/auth.model';
import { AccountService } from '../../core/services/account.service';
import { AuthService } from '../../core/services/auth.service';
import { TranslationService } from '../../core/i18n/translation.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { LanguageSwitcherComponent } from '../../shared/language-switcher/language-switcher.component';

type PlanKey = 'BASIC' | 'STANDARD' | 'PREMIUM';

@Component({
  selector: 'app-company-profile',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, TranslatePipe, LanguageSwitcherComponent],
  templateUrl: './company-profile.component.html',
  styleUrl: './profile-page.component.css'
})
export class CompanyProfileComponent {
  private readonly fb = inject(FormBuilder);
  private readonly accounts = inject(AccountService);
  private readonly auth = inject(AuthService);
  private readonly translations = inject(TranslationService);

  readonly profileForm = this.fb.nonNullable.group({
    companyName: ['', [Validators.required, Validators.minLength(2)]],
    email: ['', [Validators.required, Validators.email]]
  });
  readonly passwordForm = this.fb.nonNullable.group({
    oldPassword: ['', [Validators.required]],
    newPassword: ['', [Validators.required, Validators.minLength(6)]],
    confirmNewPassword: ['', [Validators.required]]
  });
  readonly planForm = this.fb.nonNullable.group({
    plan: ['STANDARD' as PlanKey, [Validators.required]]
  });

  loading = true;
  plansLoading = true;
  savingProfile = false;
  savingPassword = false;
  savingPlan = false;
  errorMessage = '';
  profileNotice = '';
  passwordNotice = '';
  planNotice = '';
  googleAccount = false;
  needsLocalPassword = false;
  currentPlan: PlanKey = 'STANDARD';
  plans: ActiveAdminPlanResponse[] = [];

  constructor() {
    this.loadProfile();
    this.auth.listActiveAdminPlans().subscribe({
      next: (plans) => {
        this.plansLoading = false;
        this.plans = plans.filter((plan) => plan.active);
      },
      error: (error: HttpErrorResponse) => {
        this.plansLoading = false;
        this.errorMessage = this.error(error, 'PROFILE.PLANS_ERROR');
      }
    });
  }

  saveProfile(): void {
    if (this.profileForm.invalid) {
      this.profileForm.markAllAsTouched();
      return;
    }
    this.savingProfile = true;
    this.errorMessage = '';
    this.profileNotice = '';
    this.accounts.updateCompanyProfile(this.profileForm.getRawValue()).subscribe({
      next: (profile) => {
        this.savingProfile = false;
        this.profileForm.patchValue({ companyName: profile.companyName, email: profile.email });
        this.auth.refreshStoredSession(profile.token, profile.email, 'ADMIN');
        this.profileNotice = this.t('PROFILE.COMPANY_SAVED');
      },
      error: (error: HttpErrorResponse) => {
        this.savingProfile = false;
        this.errorMessage = this.error(error, 'PROFILE.SAVE_ERROR');
      }
    });
  }

  savePassword(): void {
    if (this.passwordForm.invalid) {
      this.passwordForm.markAllAsTouched();
      return;
    }
    if (!this.passwordsMatch) {
      this.errorMessage = this.t('PROFILE.PASSWORD_MISMATCH');
      return;
    }
    const password = this.passwordForm.getRawValue();
    const usingGooglePasswordFlow = this.googleAccount;
    const settingLocalPassword = this.needsLocalPassword;
    const request = usingGooglePasswordFlow
      ? this.accounts.setCompanyPassword({
          newPassword: password.newPassword,
          confirmNewPassword: password.confirmNewPassword
        })
      : this.accounts.changeCompanyPassword(password);

    this.savingPassword = true;
    this.errorMessage = '';
    this.passwordNotice = '';
    request.subscribe({
      next: () => {
        this.savingPassword = false;
        this.passwordForm.reset();
        this.refreshProfileSecurity();
        this.passwordNotice = this.t(settingLocalPassword ? 'PROFILE.SET_PASSWORD_SUCCESS' : 'PROFILE.PASSWORD_SAVED');
      },
      error: (error: HttpErrorResponse) => {
        this.savingPassword = false;
        this.errorMessage = this.error(error, 'PROFILE.PASSWORD_ERROR');
      }
    });
  }

  savePlan(): void {
    if (this.planForm.invalid) {
      this.planForm.markAllAsTouched();
      return;
    }
    this.savingPlan = true;
    this.errorMessage = '';
    this.planNotice = '';
    this.accounts.updateCompanySubscription(this.planForm.getRawValue()).subscribe({
      next: (profile) => {
        this.savingPlan = false;
        this.currentPlan = profile.plan;
        this.planForm.patchValue({ plan: profile.plan });
        this.planNotice = this.t('PROFILE.PLAN_SAVED');
      },
      error: (error: HttpErrorResponse) => {
        this.savingPlan = false;
        this.errorMessage = this.error(error, 'PROFILE.PLAN_ERROR');
      }
    });
  }

  planDescription(plan: ActiveAdminPlanResponse): string {
    const key = `PLATFORM_PLANS.DESCRIPTION_${plan.name}`;
    const translated = this.t(key);
    return translated === key ? plan.description : translated;
  }

  get passwordsMatch(): boolean {
    return this.passwordForm.controls.newPassword.value === this.passwordForm.controls.confirmNewPassword.value;
  }

  get passwordTitleKey(): string {
    if (!this.googleAccount) {
      return 'PROFILE.CHANGE_PASSWORD';
    }
    return this.needsLocalPassword ? 'PROFILE.SET_PROMOLINK_PASSWORD' : 'PROFILE.CHANGE_PROMOLINK_PASSWORD';
  }

  hasProfileError(control: 'companyName' | 'email', error: string): boolean {
    const field = this.profileForm.controls[control];
    return field.touched && field.hasError(error);
  }

  hasPasswordError(control: 'oldPassword' | 'newPassword' | 'confirmNewPassword', error: string): boolean {
    const field = this.passwordForm.controls[control];
    return field.touched && field.hasError(error);
  }

  private loadProfile(): void {
    this.accounts.getCompanyProfile().subscribe({
      next: (profile) => {
        this.loading = false;
        this.currentPlan = profile.plan;
        this.profileForm.patchValue({ companyName: profile.companyName, email: profile.email });
        this.planForm.patchValue({ plan: profile.plan });
        this.configurePasswordMode(profile.oauthProvider, profile.localPasswordSet);
      },
      error: (error: HttpErrorResponse) => {
        this.loading = false;
        this.errorMessage = this.error(error, 'PROFILE.LOAD_ERROR');
      }
    });
  }

  private error(error: HttpErrorResponse, fallback: string): string {
    return typeof error.error?.error === 'string' ? error.error.error : this.t(fallback);
  }

  private refreshProfileSecurity(): void {
    this.accounts.getCompanyProfile().subscribe({
      next: (profile) => this.configurePasswordMode(profile.oauthProvider, profile.localPasswordSet),
      error: (error: HttpErrorResponse) => {
        this.errorMessage = this.error(error, 'PROFILE.LOAD_ERROR');
      }
    });
  }

  private configurePasswordMode(oauthProvider: 'LOCAL' | 'GOOGLE', localPasswordSet: boolean): void {
    this.googleAccount = oauthProvider === 'GOOGLE';
    this.needsLocalPassword = this.googleAccount && !localPasswordSet;
    const oldPassword = this.passwordForm.controls.oldPassword;

    if (this.googleAccount) {
      oldPassword.clearValidators();
      oldPassword.reset('');
    } else {
      oldPassword.setValidators([Validators.required]);
    }
    oldPassword.updateValueAndValidity();
  }

  private t(key: string): string {
    return this.translations.translate(key);
  }
}
