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
}
export interface AdminPlanResponse {
  id: number;
  code: 'BASIC' | 'STANDARD' | 'PREMIUM';
}

export interface AdminAccountExistsResponse {
  exists: boolean;
}

