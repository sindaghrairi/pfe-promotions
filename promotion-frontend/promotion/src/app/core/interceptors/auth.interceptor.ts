import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';

import { AuthService } from '../services/auth.service';

const PUBLIC_AUTH_PATHS = ['/api/auth/login', '/api/auth/register', '/api/auth/oauth2/', '/api/auth/admin/subscribe', '/api/auth/admin/login', '/api/auth/admin/register', '/api/auth/platform-admin/login'];

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);

  if (PUBLIC_AUTH_PATHS.some(path => req.url.includes(path))) {
    return next(req);
  }

  const token = authService.getToken();

  if (!token) {
    return next(req);
  }

  const authRequest = req.clone({
    setHeaders: {
      Authorization: `Bearer ${token}`
    }
  });

  return next(authRequest);
};
