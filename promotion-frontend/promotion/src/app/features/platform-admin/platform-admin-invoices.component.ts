import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, inject } from '@angular/core';
import { RouterLink } from '@angular/router';

import { PlatformAdminInvoiceResponse } from '../../core/models/platform-admin.model';
import { PlatformAdminService } from '../../core/services/platform-admin.service';

@Component({
  selector: 'app-platform-admin-invoices',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './platform-admin-invoices.component.html',
  styleUrl: './platform-admin-invoices.component.css'
})
export class PlatformAdminInvoicesComponent implements OnInit {
  private readonly platformAdminService = inject(PlatformAdminService);

  loading = true;
  errorMessage = '';
  invoices: PlatformAdminInvoiceResponse | null = null;

  get paymentRate(): number {
    const total = this.invoices?.items.length ?? 0;
    if (!total) {
      return 0;
    }

    return Math.round((this.countByStatus('PAID') / total) * 100);
  }

  ngOnInit(): void {
    this.platformAdminService.listInvoices().subscribe({
      next: (response) => {
        this.loading = false;
        this.invoices = response;
      },
      error: (error: HttpErrorResponse) => {
        this.loading = false;
        this.errorMessage = this.extractError(error);
      }
    });
  }

  countByStatus(status: 'PAID' | 'PENDING' | 'OVERDUE'): number {
    return this.invoices?.items.filter((item) => item.status === status).length ?? 0;
  }

  private extractError(error: HttpErrorResponse): string {
    if (typeof error.error?.error === 'string') {
      return error.error.error;
    }
    return 'Impossible de charger les factures.';
  }
}
