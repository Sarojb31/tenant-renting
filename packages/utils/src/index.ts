// Shared utilities
// Plan Section 15

export const NEPAL_PHONE_PREFIX = '+977';

export function isNepalPhone(phone: string): boolean {
  return phone.startsWith(NEPAL_PHONE_PREFIX);
}

export function formatCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat('en', { style: 'currency', currency }).format(amount);
}
