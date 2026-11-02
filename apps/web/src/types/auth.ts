export interface TenantInfo {
  id: string;
  name: string;
  slug: string;
  currency: string;
}

export interface UserProfile {
  id: string;
  email: string;
  fullName: string;
  phoneNumber?: string | null;
  role: string;
  tenant: TenantInfo;
}

export interface AuthSession {
  user: UserProfile;
  permissions: string[];
  token: string;
}
