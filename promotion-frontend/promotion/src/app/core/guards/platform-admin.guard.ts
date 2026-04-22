import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';

import { AuthService } from '../services/auth.service';

export const platformAdminGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (!authService.isAuthenticated()) {
    return router.createUrlTree(['/platform-admin/login']);
  }

  if (authService.getStoredRole() !== 'PLATFORM_ADMIN') {
    return router.createUrlTree(['/']);
  }

  return true;
};
