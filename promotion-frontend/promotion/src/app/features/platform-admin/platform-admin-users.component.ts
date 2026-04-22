import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { PlatformAdminUser, PlatformUserRole } from '../../core/models/platform-admin.model';
import { PlatformAdminService } from '../../core/services/platform-admin.service';

@Component({
  selector: 'app-platform-admin-users',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './platform-admin-users.component.html',
  styleUrl: './platform-admin-users.component.css'
})
export class PlatformAdminUsersComponent implements OnInit {
  private readonly platformAdminService = inject(PlatformAdminService);

  loading = true;
  saving = false;
  errorMessage = '';
  users: PlatformAdminUser[] = [];
  searchTerm = '';
  roleFilter: PlatformUserRole | 'ALL' = 'ALL';

  readonly roleOptions: PlatformUserRole[] = ['CLIENT', 'ADMIN', 'PLATFORM_ADMIN'];

  get filteredUsers(): PlatformAdminUser[] {
    const term = this.searchTerm.trim().toLowerCase();

    return this.users.filter((user) => {
      const roleMatch = this.roleFilter === 'ALL' || user.role === this.roleFilter;
      if (!roleMatch) {
        return false;
      }

      if (!term) {
        return true;
      }

      return `${user.id} ${user.fullName} ${user.email}`.toLowerCase().includes(term);
    });
  }

  ngOnInit(): void {
    this.loadUsers();
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

  private loadUsers(): void {
    this.loading = true;
    this.errorMessage = '';

    this.platformAdminService.listUsers().subscribe({
      next: (response) => {
        this.loading = false;
        this.users = response;
      },
      error: (error: HttpErrorResponse) => {
        this.loading = false;
        this.errorMessage = this.extractError(error, 'Impossible de charger les utilisateurs.');
      }
    });
  }

  private extractError(error: HttpErrorResponse, fallback: string): string {
    if (typeof error.error?.error === 'string') {
      return error.error.error;
    }
    return fallback;
  }
}
