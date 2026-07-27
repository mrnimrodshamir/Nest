const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Loose international phone check: optional +, 7-15 digits, spaces/dashes allowed.
const PHONE_RE = /^\+?[\d\s-]{7,15}$/;

export function isValidEmail(value: string): boolean {
  return EMAIL_RE.test(value.trim());
}

export function isValidPassword(value: string): boolean {
  return value.length >= 8;
}

export function isValidPhone(value: string): boolean {
  return PHONE_RE.test(value.trim());
}

export function isNonEmpty(value: string): boolean {
  return value.trim().length > 0;
}
