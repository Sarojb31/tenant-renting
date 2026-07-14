// Auth DTOs — mirrors backend auth module contracts
// Extend as backend auth module is implemented (Phase 1 Step 1)

export interface OtpRequestDto {
  phone: string;
}

export interface OtpVerifyDto {
  phone: string;
  otp: string;
}

export interface LoginDto {
  email: string;
  password: string;
}

export interface AuthTokensResponse {
  accessToken: string;
}
