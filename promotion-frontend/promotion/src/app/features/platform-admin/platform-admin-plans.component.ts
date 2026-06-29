import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';

import {
  PlatformAdminPlan,
  PlatformAdminPlanPayload
} from '../../core/models/platform-admin.model';
import { PlatformAdminService } from '../../core/services/platform-admin.service';
import { ThemeService } from '../../core/services/theme.service';
import { TranslationService } from '../../core/i18n/translation.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { LanguageSwitcherComponent } from '../../shared/language-switcher/language-switcher.component';

@Component({
  selector: 'app-platform-admin-plans',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, TranslatePipe, LanguageSwitcherComponent],
  templateUrl: './platform-admin-plans.component.html',
  styleUrl: './platform-admin-plans.component.css'
})
export class PlatformAdminPlansComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly platformAdminService = inject(PlatformAdminService);
  private readonly themeService = inject(ThemeService);
  private readonly translations = inject(TranslationService);

  readonly isDark$ = this.themeService.isDark$;

  loading = true;
  saving = false;
  togglingId: number | null = null;
  plans: PlatformAdminPlan[] = [];
  selectedPlan: PlatformAdminPlan | null = null;
  errorMessage = '';
  successMessage = '';

  readonly planForm = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(80)]],
    price: [0, [Validators.required, Validators.min(0)]],
    description: ['', [Validators.required, Validators.maxLength(800)]],
    duration: [''],
    active: [true]
  });

  get activeCount(): number {
    return this.plans.filter((plan) => plan.active).length;
  }

  get inactiveCount(): number {
    return this.plans.filter((plan) => !plan.active).length;
  }

  get averagePrice(): number {
    if (!this.plans.length) {
      return 0;
    }

    const total = this.plans.reduce((sum, plan) => sum + Number(plan.price || 0), 0);
    return Math.round(total / this.plans.length);
  }

  ngOnInit(): void {
    this.loadPlans();
  }

  toggleTheme(): void {
    this.themeService.toggleTheme();
  }

  openEditModal(plan: PlatformAdminPlan): void {
    this.selectedPlan = plan;
    this.errorMessage = '';
    this.successMessage = '';
    this.planForm.reset({
      name: plan.name,
      price: Number(plan.price || 0),
      description: this.planDescription(plan),
      duration: plan.duration ?? '',
      active: plan.active
    });
  }

  closeEditModal(): void {
    if (this.saving) {
      return;
    }

    this.selectedPlan = null;
    this.planForm.reset();
  }

  submitEdit(): void {
    if (!this.selectedPlan) {
      return;
    }

    if (this.planForm.invalid) {
      this.planForm.markAllAsTouched();
      return;
    }

    const raw = this.planForm.getRawValue();
    const payload: PlatformAdminPlanPayload = {
      name: raw.name.trim().toUpperCase(),
      price: Number(raw.price),
      description: raw.description.trim(),
      duration: raw.duration.trim() || null,
      active: raw.active
    };

    this.saving = true;
    this.errorMessage = '';
    this.successMessage = '';

    this.platformAdminService.updatePlan(this.selectedPlan.id, payload).subscribe({
      next: (updated) => {
        this.saving = false;
        this.replacePlan(updated);
        this.selectedPlan = null;
        this.successMessage = this.translations.translate('PLATFORM_PLANS.UPDATE_SUCCESS');
      },
      error: (error: HttpErrorResponse) => {
        this.saving = false;
        this.errorMessage = this.extractError(error, this.translations.translate('PLATFORM_PLANS.UPDATE_ERROR'));
      }
    });
  }

  toggleStatus(plan: PlatformAdminPlan): void {
    this.togglingId = plan.id;
    this.errorMessage = '';
    this.successMessage = '';

    this.platformAdminService.togglePlanStatus(plan.id, !plan.active).subscribe({
      next: (updated) => {
        this.togglingId = null;
        this.replacePlan(updated);
        this.successMessage = updated.active
          ? this.translations.translate('PLATFORM_PLANS.ACTIVATE_SUCCESS')
          : this.translations.translate('PLATFORM_PLANS.DEACTIVATE_SUCCESS');
      },
      error: (error: HttpErrorResponse) => {
        this.togglingId = null;
        this.errorMessage = this.extractError(error, this.translations.translate('PLATFORM_PLANS.STATUS_ERROR'));
      }
    });
  }

  hasError(controlName: 'name' | 'price' | 'description' | 'duration', errorName: string): boolean {
    const control = this.planForm.controls[controlName];
    return control.touched && control.hasError(errorName);
  }

  planDescription(plan: PlatformAdminPlan): string {
    const key = this.planDescriptionKey(plan);
    return key ? this.translations.translate(key) : plan.description;
  }

  private loadPlans(): void {
    this.loading = true;
    this.errorMessage = '';
    this.successMessage = '';

    this.platformAdminService.getPlans().subscribe({
      next: (plans) => {
        this.loading = false;
        this.plans = plans;
      },
      error: (error: HttpErrorResponse) => {
        this.loading = false;
        this.errorMessage = this.extractError(error, this.translations.translate('PLATFORM_PLANS.LOAD_ERROR'));
      }
    });
  }

  private replacePlan(updated: PlatformAdminPlan): void {
    this.plans = this.plans.map((plan) => plan.id === updated.id ? updated : plan);
  }

  private planDescriptionKey(plan: PlatformAdminPlan): string | null {
    const name = plan.name.trim().toUpperCase();
    if (name === 'BASIC') {
      return 'PLATFORM_PLANS.DESCRIPTION_BASIC';
    }
    if (name === 'STANDARD') {
      return 'PLATFORM_PLANS.DESCRIPTION_STANDARD';
    }
    if (name === 'PREMIUM') {
      return 'PLATFORM_PLANS.DESCRIPTION_PREMIUM';
    }

    return null;
  }

  private extractError(error: HttpErrorResponse, fallback: string): string {
    if (typeof error.error?.error === 'string') {
      return error.error.error;
    }

    const fieldError = Object.values(error.error ?? {}).find((value) => typeof value === 'string');
    return typeof fieldError === 'string' ? fieldError : fallback;
  }
}
