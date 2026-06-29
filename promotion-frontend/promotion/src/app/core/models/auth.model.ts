export interface RegisterRequest {
  fullName: string;
  email: string;
  password: string;
}

export interface AdminSubscribeRequest {
  companyName: string;
  contactEmail: string;
  plan: string;
}

export interface AdminRegisterRequest {
  fullName: string;
  email: string;
  password: string;
  companyName: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface AuthResponse {
  token: string;
  email: string;
  role: string;
}

export interface OAuth2UrlResponse {
  url: string;
}

export interface OAuth2CallbackRequest {
  code: string;
  state?: string;
}

export interface MessageResponse {
  message: string;
}

export interface MeResponse {
  email: string;
  role?: string;
  companyName?: string;
  companySlug?: string;
}

export interface AdminSubscriptionResponse {
  companyName: string;
  contactEmail: string;
  plan: 'BASIC' | 'STANDARD' | 'PREMIUM';
  createdAt?: string | null;
  active?: boolean;
  status?: 'ACTIVE' | 'EXPIRED' | 'CANCELED' | 'PENDING' | 'OVERDUE';
  nextInvoice?: string | null;
  latestInvoiceStatus?: 'PENDING' | 'PAID' | 'OVERDUE' | 'CANCELED' | null;
  latestInvoiceDueAt?: string | null;
  message?: string | null;
}
export interface AdminPlanResponse {
  id: number;
  code: 'BASIC' | 'STANDARD' | 'PREMIUM';
}

export interface ActiveAdminPlanResponse {
  id: number;
  name: 'BASIC' | 'STANDARD' | 'PREMIUM';
  price: number;
  description: string;
  duration?: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AdminAccountExistsResponse {
  exists: boolean;
}

export interface AccountProfileResponse {
  fullName: string;
  email: string;
  role: string;
  oauthProvider: 'LOCAL' | 'GOOGLE';
  localPasswordSet: boolean;
  token?: string | null;
}

export interface AccountProfileUpdateRequest {
  fullName: string;
  email: string;
}

export interface ChangePasswordRequest {
  oldPassword: string;
  newPassword: string;
  confirmNewPassword: string;
}

export interface SetPasswordRequest {
  newPassword: string;
  confirmNewPassword: string;
}

export interface CompanyAdminProfileResponse {
  companyName: string;
  email: string;
  plan: 'BASIC' | 'STANDARD' | 'PREMIUM';
  subscriptionActive: boolean;
  oauthProvider: 'LOCAL' | 'GOOGLE';
  localPasswordSet: boolean;
  token?: string | null;
}

export interface CompanyAdminProfileUpdateRequest {
  companyName: string;
  email: string;
}

export interface CompanySubscriptionUpdateRequest {
  plan: 'BASIC' | 'STANDARD' | 'PREMIUM';
}
