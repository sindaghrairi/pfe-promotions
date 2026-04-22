import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { PlatformAdminInvoice } from '../../core/models/platform-admin.model';
import { PlatformAdminService } from '../../core/services/platform-admin.service';

@Component({
  selector: 'app-platform-admin-invoice-details',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './platform-admin-invoice-details.component.html',
  styleUrl: './platform-admin-invoice-details.component.css'
})
export class PlatformAdminInvoiceDetailsComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly platformAdminService = inject(PlatformAdminService);

  loading = true;
  errorMessage = '';
  invoice: PlatformAdminInvoice | null = null;

  ngOnInit(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    if (!id || Number.isNaN(id)) {
      this.loading = false;
      this.errorMessage = 'Identifiant de facture invalide.';
      return;
    }

    this.platformAdminService.getInvoiceById(id).subscribe({
      next: (response) => {
        this.loading = false;
        this.invoice = response;
      },
      error: (error: HttpErrorResponse) => {
        this.loading = false;
        this.errorMessage = this.extractError(error);
      }
    });
  }

  printInvoice(): void {
    if (typeof window !== 'undefined') {
      window.print();
    }
  }

  get invoiceNumber(): string {
    if (!this.invoice) {
      return '-';
    }

    const issued = this.invoice.issuedAt.replaceAll('-', '');
    return `FAC-${issued}-${this.invoice.id}`;
  }

  get cycleLabel(): string {
    return 'Mensuel';
  }

  private extractError(error: HttpErrorResponse): string {
    if (typeof error.error?.error === 'string') {
      return error.error.error;
    }
    return 'Impossible de charger cette facture.';
  }
}
