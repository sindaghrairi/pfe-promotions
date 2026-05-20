import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

@Component({
  selector: 'app-auth-space',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './auth-space.component.html',
  styleUrl: './auth-space.component.css'
})
export class AuthSpaceComponent {
  readonly redirectTo: string;
  readonly userRedirectTo: string;
  readonly companyLabel: string;

  constructor(private readonly route: ActivatedRoute) {
    const redirectParam = this.route.snapshot.queryParamMap.get('redirectTo');
    const companyParam = this.route.snapshot.queryParamMap.get('company');

    this.redirectTo = redirectParam || '/dashboard';
    this.userRedirectTo = this.resolveUserRedirect(this.redirectTo);
    this.companyLabel = companyParam ? this.normalizeCompany(companyParam) : '';
  }

  private resolveUserRedirect(redirectTo: string): string {
    // Company routes are admin-only; user auth should not redirect there.
    if (redirectTo.startsWith('/entreprises/')) {
      return '/dashboard';
    }

    return redirectTo;
  }

  private normalizeCompany(company: string): string {
    return company
      .split(' ')
      .filter(Boolean)
      .map((chunk) => chunk[0].toUpperCase() + chunk.slice(1).toLowerCase())
      .join(' ');
  }
}
