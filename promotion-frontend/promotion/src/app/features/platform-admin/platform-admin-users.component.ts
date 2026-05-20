import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, inject } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { RegisterRequest } from '../../core/models/auth.model';
import { PlatformAdminUser, PlatformUserRole } from '../../core/models/platform-admin.model';
import { AuthService } from '../../core/services/auth.service';
import { PlatformAdminService } from '../../core/services/platform-admin.service';
import { ThemeService } from '../../core/services/theme.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { LanguageSwitcherComponent } from '../../shared/language-switcher/language-switcher.component';

@Component({
  selector: 'app-platform-admin-users',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterLink, TranslatePipe, LanguageSwitcherComponent],
  templateUrl: './platform-admin-users.component.html',
  styleUrl: './platform-admin-users.component.css'
})
export class PlatformAdminUsersComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly platformAdminService = inject(PlatformAdminService);
  private readonly themeService = inject(ThemeService);

  readonly isDark$ = this.themeService.isDark$;

  loading = true;
  saving = false;
  creatingUser = false;
  showAddUserForm = false;
  errorMessage = '';
  addUserError = '';
  addUserSuccess = '';
  users: PlatformAdminUser[] = [];
  searchTerm = '';
  roleFilter: PlatformUserRole | 'ALL' = 'ALL';
  pageSize = 6;
  currentPage = 1;

  readonly roleOptions: PlatformUserRole[] = ['CLIENT', 'ADMIN', 'PLATFORM_ADMIN'];

  readonly addUserForm = this.fb.nonNullable.group({
    fullName: ['', [Validators.required, Validators.minLength(3)]],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]]
  });

  get filteredUsers(): PlatformAdminUser[] {
    const term = this.searchTerm.trim().toLowerCase();

    const filtered = this.users.filter((user) => {
      const roleMatch = this.roleFilter === 'ALL' || user.role === this.roleFilter;
      if (!roleMatch) {
        return false;
      }

      if (!term) {
        return true;
      }

      return `${user.id} ${user.fullName} ${user.email}`.toLowerCase().includes(term);
    });

    return filtered.sort((a, b) => this.parseDate(b.createdAt) - this.parseDate(a.createdAt));
  }

  get pagedUsers(): PlatformAdminUser[] {
    const start = (this.currentPage - 1) * this.pageSize;
    return this.filteredUsers.slice(start, start + this.pageSize);
  }

  get totalPages(): number {
    const total = this.filteredUsers.length;
    return total ? Math.ceil(total / this.pageSize) : 1;
  }

  get pageNumbers(): number[] {
    return Array.from({ length: this.totalPages }, (_, index) => index + 1);
  }

  get paginationItems(): Array<number | string> {
    if (this.totalPages <= 7) {
      return this.pageNumbers;
    }

    const items: Array<number | string> = [];
    const left = Math.max(this.currentPage - 1, 2);
    const right = Math.min(this.currentPage + 1, this.totalPages - 1);

    items.push(1);

    if (left > 2) {
      items.push('...');
    }

    for (let page = left; page <= right; page += 1) {
      items.push(page);
    }

    if (right < this.totalPages - 1) {
      items.push('...');
    }

    items.push(this.totalPages);
    return items;
  }

  get startItem(): number {
    if (!this.filteredUsers.length) {
      return 0;
    }
    return (this.currentPage - 1) * this.pageSize + 1;
  }

  get endItem(): number {
    return Math.min(this.currentPage * this.pageSize, this.filteredUsers.length);
  }

  ngOnInit(): void {
    this.loadUsers();
  }

  toggleTheme(): void {
    this.themeService.toggleTheme();
  }

  toggleAddUserForm(): void {
    this.showAddUserForm = !this.showAddUserForm;
    this.addUserError = '';
    this.addUserSuccess = '';
  }

  cancelAddUser(): void {
    this.showAddUserForm = false;
    this.addUserError = '';
    this.addUserSuccess = '';
    this.addUserForm.reset();
  }

  submitAddUser(): void {
    if (this.addUserForm.invalid) {
      this.addUserForm.markAllAsTouched();
      return;
    }

    const payload: RegisterRequest = {
      fullName: this.addUserForm.controls.fullName.value.trim(),
      email: this.addUserForm.controls.email.value.trim(),
      password: this.addUserForm.controls.password.value
    };

    this.creatingUser = true;
    this.addUserError = '';
    this.addUserSuccess = '';

    this.authService.createUser(payload).subscribe({
      next: () => {
        this.creatingUser = false;
        this.addUserSuccess = 'Utilisateur ajoute avec succes.';
        this.addUserForm.reset();
        this.loadUsers(false);
      },
      error: (error: HttpErrorResponse) => {
        this.creatingUser = false;
        this.addUserError = this.extractError(error, "Impossible d'ajouter cet utilisateur.");
      }
    });
  }

  countByRole(role: PlatformUserRole): number {
    return this.users.filter((user) => user.role === role).length;
  }

  onRoleChange(user: PlatformAdminUser, role: string): void {
    const nextRole = role as PlatformUserRole;
    if (user.role === nextRole) {
      return;
    }

    this.saving = true;
    this.errorMessage = '';

    this.platformAdminService.updateUserRole(user.id, nextRole).subscribe({
      next: (updated) => {
        this.saving = false;
        const index = this.users.findIndex((item) => item.id === updated.id);
        if (index >= 0) {
          this.users[index] = updated;
        }
      },
      error: (error: HttpErrorResponse) => {
        this.saving = false;
        this.errorMessage = this.extractError(error, 'Impossible de modifier le role utilisateur.');
        this.loadUsers();
      }
    });
  }

  onSearchTermChange(value: string): void {
    this.searchTerm = value;
    this.resetPage();
  }

  hasAddUserError(controlName: 'fullName' | 'email' | 'password', errorName: string): boolean {
    const control = this.addUserForm.controls[controlName];
    return control.touched && control.hasError(errorName);
  }

  setRoleFilter(role: PlatformUserRole | 'ALL'): void {
    this.roleFilter = role;
    this.resetPage();
  }

  goToPage(page: number): void {
    const nextPage = Math.min(Math.max(page, 1), this.totalPages);
    this.currentPage = nextPage;
  }

  goToPageItem(item: number | string): void {
    if (typeof item !== 'number') {
      return;
    }
    this.goToPage(item);
  }

  focusRoleSelect(select: HTMLSelectElement): void {
    select.focus();
    select.click();
  }

  deleteUser(user: PlatformAdminUser): void {
    const confirmed = typeof window !== 'undefined'
      ? window.confirm(`Supprimer le compte ${user.email} ?`)
      : true;

    if (!confirmed) {
      return;
    }

    this.saving = true;
    this.errorMessage = '';

    this.platformAdminService.deleteUser(user.id).subscribe({
      next: () => {
        this.saving = false;
        this.users = this.users.filter((item) => item.id !== user.id);
      },
      error: (error: HttpErrorResponse) => {
        this.saving = false;
        this.errorMessage = this.extractError(error, 'Impossible de supprimer cet utilisateur.');
      }
    });
  }

  avatarClass(id: number): string {
    const palette = ['ud-av-violet', 'ud-av-indigo', 'ud-av-teal', 'ud-av-emerald', 'ud-av-amber', 'ud-av-rose'];
    return palette[id % palette.length];
  }

  userInitials(fullName: string): string {
    const chunks = fullName
      .split(' ')
      .map((part) => part.trim())
      .filter(Boolean)
      .slice(0, 2);

    if (!chunks.length) {
      return 'U';
    }

    return chunks.map((part) => part[0].toUpperCase()).join('');
  }

  private loadUsers(showLoader = true): void {
    this.loading = showLoader;
    this.errorMessage = '';

    this.platformAdminService.listUsers().subscribe({
      next: (response) => {
        this.loading = false;
        this.users = response;
        this.resetPage();
      },
      error: (error: HttpErrorResponse) => {
        this.loading = false;
        this.errorMessage = this.extractError(error, 'Impossible de charger les utilisateurs.');
      }
    });
  }

  private parseDate(value: string): number {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? 0 : parsed;
  }

  private resetPage(): void {
    this.currentPage = 1;
  }

  private extractError(error: HttpErrorResponse, fallback: string): string {
    if (typeof error.error?.error === 'string') {
      return error.error.error;
    }
    return fallback;
  }
}
