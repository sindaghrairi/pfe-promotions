import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { AccountService } from '../../core/services/account.service';
import { AuthService } from '../../core/services/auth.service';
import { TranslationService } from '../../core/i18n/translation.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { LanguageSwitcherComponent } from '../../shared/language-switcher/language-switcher.component';

@Component({
  selector: 'app-client-profile',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, TranslatePipe, LanguageSwitcherComponent],
  templateUrl: './client-profile.component.html',
  styleUrl: './profile-page.component.css'
})
export class ClientProfileComponent {
  private readonly fb = inject(FormBuilder);
  private readonly accounts = inject(AccountService);
  private readonly auth = inject(AuthService);
  private readonly translations = inject(TranslationService);

  readonly profileForm = this.fb.nonNullable.group({
    fullName: ['', [Validators.required, Validators.minLength(3)]],
    email: ['', [Validators.required, Validators.email]]
  });
  readonly passwordForm = this.fb.nonNullable.group({
    oldPassword: ['', [Validators.required]],
    newPassword: ['', [Validators.required, Validators.minLength(6)]],
    confirmNewPassword: ['', [Validators.required]]
  });

  loading = true;
  savingProfile = false;
  savingPassword = false;
  errorMessage = '';
  profileNotice = '';
  passwordNotice = '';
  googleAccount = false;
  needsLocalPassword = false;

  constructor() {
    this.loadProfile();
  }

  saveProfile(): void {
    if (this.profileForm.invalid) {
      this.profileForm.markAllAsTouched();
      return;
    }

    this.savingProfile = true;
    this.errorMessage = '';
    this.profileNotice = '';
    this.accounts.updateMyProfile(this.profileForm.getRawValue()).subscribe({
      next: (profile) => {
        this.savingProfile = false;
        this.applyProfile(profile);
        this.auth.refreshStoredSession(profile.token, profile.email, profile.role);
        this.profileNotice = this.t('PROFILE.PROFILE_SAVED');
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
      ? this.accounts.setPassword({
          newPassword: password.newPassword,
          confirmNewPassword: password.confirmNewPassword
        })
      : this.accounts.changePassword(password);

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

  get passwordsMatch(): boolean {
    return this.passwordForm.controls.newPassword.value === this.passwordForm.controls.confirmNewPassword.value;
  }

  get passwordTitleKey(): string {
    if (!this.googleAccount) {
      return 'PROFILE.CHANGE_PASSWORD';
    }
    return this.needsLocalPassword ? 'PROFILE.SET_PROMOLINK_PASSWORD' : 'PROFILE.CHANGE_PROMOLINK_PASSWORD';
  }

  hasProfileError(control: 'fullName' | 'email', error: string): boolean {
    const field = this.profileForm.controls[control];
    return field.touched && field.hasError(error);
  }

  hasPasswordError(control: 'oldPassword' | 'newPassword' | 'confirmNewPassword', error: string): boolean {
    const field = this.passwordForm.controls[control];
    return field.touched && field.hasError(error);
  }

  private error(error: HttpErrorResponse, fallback: string): string {
    return typeof error.error?.error === 'string' ? error.error.error : this.t(fallback);
  }

  private loadProfile(): void {
    this.accounts.getMyProfile().subscribe({
      next: (profile) => {
        this.loading = false;
        this.applyProfile(profile);
      },
      error: (error: HttpErrorResponse) => {
        this.loading = false;
        this.errorMessage = this.error(error, 'PROFILE.LOAD_ERROR');
      }
    });
  }

  private refreshProfileSecurity(): void {
    this.accounts.getMyProfile().subscribe({
      next: (profile) => this.applyProfile(profile),
      error: (error: HttpErrorResponse) => {
        this.errorMessage = this.error(error, 'PROFILE.LOAD_ERROR');
      }
    });
  }

  private applyProfile(profile: { fullName: string; email: string; oauthProvider: 'LOCAL' | 'GOOGLE'; localPasswordSet: boolean }): void {
    this.profileForm.patchValue({ fullName: profile.fullName, email: profile.email });
    this.configurePasswordMode(profile.oauthProvider, profile.localPasswordSet);
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
