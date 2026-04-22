import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';

import { AuthService } from '../../core/services/auth.service';
import { PlatformAdminService } from '../../core/services/platform-admin.service';
import { PlatformAdminStats } from '../../core/models/platform-admin.model';

@Component({
  selector: 'app-platform-admin-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './platform-admin-dashboard.component.html',
  styleUrl: './platform-admin-dashboard.component.css'
})
export class PlatformAdminDashboardComponent implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly platformAdminService = inject(PlatformAdminService);
  private readonly router = inject(Router);

  loading = true;
  errorMessage = '';
  email = '';
  stats: PlatformAdminStats | null = null;

  ngOnInit(): void {
    this.email = this.authService.getStoredEmail() ?? '';

    this.platformAdminService.getDashboardStats().subscribe({
      next: (response) => {
        this.loading = false;
        this.stats = response;
      },
      error: () => {
        this.loading = false;
        this.errorMessage = 'Impossible de charger les statistiques globales.';
      }
    });
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/platform-admin/login']);
  }
}
