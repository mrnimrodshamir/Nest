const LEGACY_DEFAULT_NAMES = new Set([
  'momzi member',
  'momzy member',
  'nest member',
  'nestup member',
]);

/** Legacy trigger-generated names are setup placeholders, not identities.
 * They must never be rendered as if a caregiver chose them. */
export function isLegacyDefaultDisplayName(value: string | null | undefined): boolean {
  if (!value) return false;
  return LEGACY_DEFAULT_NAMES.has(value.trim().replace(/\s+/g, ' ').toLocaleLowerCase('en-US'));
}

export function hasUsableDisplayName(value: string | null | undefined): boolean {
  return Boolean(value?.trim()) && !isLegacyDefaultDisplayName(value);
}

export function safeDisplayName(value: string | null | undefined, fallback: string): string {
  return hasUsableDisplayName(value) ? value!.trim() : fallback;
}

/** A neutral, localized emergency label for corrupt/legacy rows. Apple users
 * are routed through setup before Main, but list queries still fail closed
 * without ever surfacing an old product-branded placeholder. */
export function safeCaregiverDisplayName(value: string | null | undefined): string {
  return safeDisplayName(value, translate(currentAppLocale(), 'profile.role.parent'));
}
import { currentAppLocale, translate } from '@/i18n/core';
