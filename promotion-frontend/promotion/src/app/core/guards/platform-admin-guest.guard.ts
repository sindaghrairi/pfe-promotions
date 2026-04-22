import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';

import { AuthService } from '../services/auth.service';

export const platformAdminGuestGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (!authService.isAuthenticated()) {
    return true;
  }

  return authService.getStoredRole() === 'PLATFORM_ADMIN'
    ? router.createUrlTree(['/platform-admin/dashboard'])
    : router.createUrlTree(['/dashboard']);
};
