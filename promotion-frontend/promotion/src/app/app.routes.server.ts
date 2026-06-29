import { RenderMode, ServerRoute } from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [
  {
    path: '',
    renderMode: RenderMode.Server
  },
  {
    path: 'admin/subscribe',
    renderMode: RenderMode.Server
  },
  {
    path: 'admin/subscribe/payment',
    renderMode: RenderMode.Server
  },
  {
    path: 'admin/subscribe/overview',
    renderMode: RenderMode.Server
  },
  {
    path: 'admin/subscribe/invoice',
    renderMode: RenderMode.Server
  },
  {
    path: 'admin/register',
    renderMode: RenderMode.Server
  },
  {
    path: 'admin/login',
    renderMode: RenderMode.Server
  },
  {
    path: 'platform-admin/dashboard',
    renderMode: RenderMode.Client
  },
  {
    path: 'platform-admin/users',
    renderMode: RenderMode.Client
  },
  {
    path: 'platform-admin/subscriptions',
    renderMode: RenderMode.Client
  },
  {
    path: 'platform-admin/invoices',
    renderMode: RenderMode.Client
  },
  {
    path: 'platform-admin/invoices/:id',
    renderMode: RenderMode.Client
  },
  {
    path: 'login',
    renderMode: RenderMode.Server
  },
  {
    path: 'register',
    renderMode: RenderMode.Server
  },
  {
    path: 'oauth2/google/callback',
    renderMode: RenderMode.Client
  },
  {
    path: 'dashboard',
    renderMode: RenderMode.Server
  },
  {
    path: 'client/profile',
    renderMode: RenderMode.Server
  },
  {
    path: 'admin/profile',
    renderMode: RenderMode.Server
  },
  {
    path: 'promos/consulter-toutes',
    renderMode: RenderMode.Server
  },
  {
    path: 'entreprises/:slug',
    renderMode: RenderMode.Server
  },
  {
    path: 'entreprises/:slug/ajouter-promo',
    renderMode: RenderMode.Server
  },
  {
    path: 'entreprises/:slug/consulter-promos',
    renderMode: RenderMode.Server
  },
  {
    path: '**',
    renderMode: RenderMode.Server
  }
];
