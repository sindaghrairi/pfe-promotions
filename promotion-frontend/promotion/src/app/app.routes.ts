import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { companyPromosGuard } from './core/guards/company-promos.guard';
import { guestGuard } from './core/guards/guest.guard';
import { AuthSpaceComponent } from './features/auth/auth-space/auth-space.component';
import { AdminLoginComponent } from './features/auth/admin-login/admin-login.component';
import { AdminPaymentTypeComponent } from './features/auth/admin-payment-type/admin-payment-type.component';
import { AdminInvoiceComponent } from './features/auth/admin-invoice/admin-invoice.component';
import { AdminSubscriptionOverviewComponent } from './features/auth/admin-subscription-overview/admin-subscription-overview.component';
import { AdminRegisterComponent } from './features/auth/admin-register/admin-register.component';
import { AdminSubscribeComponent } from './features/auth/admin-subscribe/admin-subscribe.component';
import { LoginComponent } from './features/auth/login/login.component';
import { RegisterComponent } from './features/auth/register/register.component';
import { OAuthCallbackComponent } from './features/auth/oauth-callback/oauth-callback.component';
import { DashboardComponent } from './features/dashboard/dashboard.component';
import { HomeComponent } from './features/home/home.component';
import { CompanyPromosComponent } from './features/company-promos/company-promos.component';
import { AddPromoComponent } from './features/company-promos/add-promo.component';
import { platformAdminGuard } from './core/guards/platform-admin.guard';
import { platformAdminGuestGuard } from './core/guards/platform-admin-guest.guard';
import { PlatformAdminLoginComponent } from './features/platform-admin/platform-admin-login.component';
import { PlatformAdminDashboardComponent } from './features/platform-admin/platform-admin-dashboard.component';
import { PlatformAdminUsersComponent } from './features/platform-admin/platform-admin-users.component';
import { PlatformAdminSubscriptionsComponent } from './features/platform-admin/platform-admin-subscriptions.component';
import { PlatformAdminInvoicesComponent } from './features/platform-admin/platform-admin-invoices.component';
import { PlatformAdminInvoiceDetailsComponent } from './features/platform-admin/platform-admin-invoice-details.component';
import { PlatformAdminPlansComponent } from './features/platform-admin/platform-admin-plans.component';
import { ClientProfileComponent } from './features/account/client-profile.component';
import { CompanyProfileComponent } from './features/account/company-profile.component';

export const routes: Routes = [
	{ path: '', pathMatch: 'full', component: HomeComponent },
	{ path: 'promotions', component: CompanyPromosComponent },
	{ path: 'promos/consulter-toutes', component: CompanyPromosComponent },
	{ path: 'entreprises/:slug/consulter-promos', component: CompanyPromosComponent },
	{ path: 'entreprises/:slug', canActivate: [companyPromosGuard], component: CompanyPromosComponent },
	{ path: 'entreprises/:slug/ajouter-promo', canActivate: [companyPromosGuard], component: AddPromoComponent },
	{ path: 'espace', component: AuthSpaceComponent },
	{ path: 'login', canActivate: [guestGuard], component: LoginComponent },
	{ path: 'register', canActivate: [guestGuard], component: RegisterComponent },
	{ path: 'oauth2/google/callback', component: OAuthCallbackComponent },
	{ path: 'admin/subscribe/payment', canActivate: [guestGuard], component: AdminPaymentTypeComponent },
	{ path: 'admin/subscribe/overview', component: AdminSubscriptionOverviewComponent },
	{ path: 'admin/subscribe/invoice', component: AdminInvoiceComponent },
	{ path: 'admin/subscribe', canActivate: [guestGuard], component: AdminSubscribeComponent },
	{ path: 'admin/register', component: AdminRegisterComponent },
	{ path: 'admin/login', canActivate: [guestGuard], component: AdminLoginComponent },
	{ path: 'platform-admin/login', canActivate: [platformAdminGuestGuard], component: PlatformAdminLoginComponent },
	{ path: 'platform-admin/dashboard', canActivate: [platformAdminGuard], component: PlatformAdminDashboardComponent },
	{ path: 'platform-admin/users', canActivate: [platformAdminGuard], component: PlatformAdminUsersComponent },
	{ path: 'platform-admin/subscriptions', canActivate: [platformAdminGuard], component: PlatformAdminSubscriptionsComponent },
	{ path: 'platform-admin/plans', canActivate: [platformAdminGuard], component: PlatformAdminPlansComponent },
	{ path: 'platform-admin/invoices', canActivate: [platformAdminGuard], component: PlatformAdminInvoicesComponent },
	{ path: 'platform-admin/invoices/:id', canActivate: [platformAdminGuard], component: PlatformAdminInvoiceDetailsComponent },
	{ path: 'client/profile', canActivate: [authGuard], component: ClientProfileComponent },
	{ path: 'admin/profile', canActivate: [authGuard], component: CompanyProfileComponent },
	{ path: 'dashboard', canActivate: [authGuard], component: DashboardComponent },
	{ path: '**', redirectTo: '' }
];
