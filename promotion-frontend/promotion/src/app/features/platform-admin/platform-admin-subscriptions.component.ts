import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, inject } from '@angular/core';
import { RouterLink } from '@angular/router';

import { PlatformAdminSubscription } from '../../core/models/platform-admin.model';
import { PlatformAdminService } from '../../core/services/platform-admin.service';

@Component({
  selector: 'app-platform-admin-subscriptions',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './platform-admin-subscriptions.component.html',
  styleUrl: './platform-admin-subscriptions.component.css'
})
export class PlatformAdminSubscriptionsComponent implements OnInit {
  private readonly platformAdminService = inject(PlatformAdminService);

  loading = true;
  errorMessage = '';
  subscriptions: PlatformAdminSubscription[] = [];

  ngOnInit(): void {
    this.platformAdminService.listSubscriptions().subscribe({
      next: (response) => {
        this.loading = false;
        this.subscriptions = response;
      },
      error: (error: HttpErrorResponse) => {
        this.loading = false;
        this.errorMessage = this.extractError(error);
      }
    });
  }

  private extractError(error: HttpErrorResponse): string {
    if (typeof error.error?.error === 'string') {
      return error.error.error;
    }
    return 'Impossible de charger les abonnements.';
  }
}
