import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';

import { AuthService } from '../services/auth.service';

export const companyPromosGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);
  const isReadOnlyRoute = route.routeConfig?.path === 'entreprises/:slug/consulter-promos';

  if (authService.isAdminAuthenticated()) {
    return true;
  }

  if (isReadOnlyRoute && authService.isAuthenticated()) {
    return true;
  }

  const companySlug = route.paramMap.get('slug') ?? '';
  const companyName = companySlug ? companySlug.replace(/-/g, ' ') : '';

  return router.createUrlTree(['/espace'], {
    queryParams: {
      redirectTo: state.url,
      company: companyName
    }
  });
};
