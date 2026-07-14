// Tenant DTOs — mirrors Plan Section 12 (tenants table)
// Extend as tenants module is implemented (Phase 1 Step 1)

export type TenantStatus = 'trial' | 'active' | 'suspended' | 'cancelled';

export interface TenantResponse {
  id: string;
  name: string;
  subdomain: string;
  customDomain: string | null;
  logoUrl: string | null;
  themeColor: string | null;
  country: string;
  defaultCurrency: string;
  status: TenantStatus;
  createdAt: string;
}

export interface CreateTenantDto {
  name: string;
  subdomain: string;
  country: string;
  defaultCurrency: string;
}
