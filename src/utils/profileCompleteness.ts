import { hasUsableDisplayName } from '@/utils/profileIdentity';

export type ProfileCompleteness =
  | 'requires-initial-setup'
  | 'established-with-optional-gaps'
  | 'complete';

interface CompletenessProfile {
  onboardingCompleted: boolean;
  displayName?: string | null;
  parentRole?: 'mom' | 'dad' | 'parent' | null;
  birthdate?: string | null;
  neighborhood?: string | null;
  occupation?: string | null;
  bio?: string | null;
  avatarUrl?: string | null;
}

/** `onboardingCompleted` remains the compatibility boundary for established
 * accounts: new optional profile fields never lock an existing caregiver out. */
export function profileCompleteness(profile: CompletenessProfile | null): ProfileCompleteness {
  if (!profile || !profile.onboardingCompleted) {
    return 'requires-initial-setup';
  }
  // Legacy callers/tests may still provide only the historical completion
  // flag. The real app profile always has displayName; when it is present it
  // must be a caregiver-chosen identity, never an old brand placeholder.
  if ('displayName' in profile && !hasUsableDisplayName(profile.displayName)) return 'requires-initial-setup';

  const optionalFields = [
    profile.displayName?.trim(),
    profile.parentRole,
    profile.birthdate,
    profile.neighborhood?.trim(),
    profile.occupation?.trim(),
    profile.bio?.trim(),
    profile.avatarUrl,
  ];
  return optionalFields.every(Boolean) ? 'complete' : 'established-with-optional-gaps';
}

export function needsInitialProfileSetup(profile: CompletenessProfile | null): boolean {
  return profileCompleteness(profile) === 'requires-initial-setup';
}

/** Apple authentication supplies credentials, not a NestUp family profile.
 * New and legacy Apple accounts must complete the MVP identity fields before
 * entering Main. Email-era established accounts keep the historical optional-
 * gaps compatibility rule. */
export function needsAppleProfileSetup(profile: CompletenessProfile | null): boolean {
  if (profileCompleteness(profile) === 'requires-initial-setup') return true;
  return !profile?.parentRole || !profile.birthdate || !profile.neighborhood?.trim();
}
