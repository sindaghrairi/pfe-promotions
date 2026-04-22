export interface PlatformAdminStats {
  totalUsers: number;
  totalClients: number;
  totalCompanyAdmins: number;
  totalPlatformAdmins: number;
  activeSubscriptions: number;
  inactiveSubscriptions: number;
  totalPromotions: number;
  activePromotions: number;
  expiredPromotions: number;
  scheduledPromotions: number;
  draftPromotions: number;
}

export type PlatformUserRole = 'CLIENT' | 'ADMIN' | 'PLATFORM_ADMIN';

export interface PlatformAdminUser {
  id: number;
  fullName: string;
  email: string;
  role: PlatformUserRole;
  createdAt: string;
}

export interface PlatformAdminSubscription {
  id: number;
  companyName: string;
  contactEmail: string;
  plan: string;
  active: boolean;
  createdAt: string;
}

export interface PlatformAdminInvoiceResponse {
  message: string;
  total: number;
  items: PlatformAdminInvoice[];
}

export interface PlatformAdminInvoice {
  id: number;
  companyName: string;
  companyEmail: string;
  plan: string;
  amount: number;
  status: 'PENDING' | 'PAID' | 'OVERDUE' | 'CANCELED';
  issuedAt: string;
  dueAt: string;
  paidAt?: string | null;
  createdAt: string;
}
