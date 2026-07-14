// Customer DTOs — mirrors Plan Section 12 (customers + customer_preferences tables)
// Extend as customers module is implemented (Phase 1 Step 3)

export interface CustomerResponse {
  id: string;
  tenantId: string;
  name: string;
  phone: string;
  email: string | null;
  phoneVerified: boolean;
  smsOptIn: boolean;
  preferredLanguage: string;
}

export interface CustomerPreferencesDto {
  locations: string[];
  budgetMin: number;
  budgetMax: number;
  roomType: string;
  moveInDate: string | null;
  amenitiesWanted: string[];
  active: boolean;
}
