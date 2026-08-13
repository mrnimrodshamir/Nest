import type { SupabaseClient } from '@supabase/supabase-js';

/** Framework-independent core of "finish setting up the account" — no
 *  React, no hooks, no upload/analytics side effects. Pulled out of
 *  useAuth.tsx's completeOnboarding specifically so this exact database
 *  sequence (the part most likely to leave the account in a broken
 *  state if it's wrong) can be exercised directly against a real
 *  Supabase project from a plain Node script, not just called indirectly
 *  through a React component. useAuth.tsx's completeOnboarding is a thin
 *  wrapper around this function — same code runs in the app and in the
 *  test harness, not a parallel reimplementation. */

export interface OnboardingChildInput {
  name: string;
  birthdate: string; // ISO date (YYYY-MM-DD)
}

export interface OnboardingCoreInput {
  children: OnboardingChildInput[];
  phone?: string;
  /** Already-uploaded URL, if any — the upload itself is a React/Expo
   *  concern (expo-image-manipulator etc.) that stays in the hook. */
  avatarUrl?: string | null;
  /** Only overwrites the stub profile's value when non-null/non-empty. */
  displayName?: string | null;
  email?: string | null;
  parentRole?: 'mom' | 'dad' | 'parent' | null;
  birthdate?: string | null;
  neighborhood?: string | null;
  occupation?: string | null;
  bio?: string | null;
}

export type OnboardingCoreResult =
  | { status: 'already-complete' }
  | { status: 'completed' }
  | { status: 'error'; message: string };

type Logger = (message: string, meta?: Record<string, unknown>) => void;

/** Deliberately ordered and idempotent:
 *  1. Idempotency check — already complete? No writes, return immediately.
 *  2. Profile fields update.
 *  3. Children insert — only if none exist yet for this profile.
 *  4. Re-query and confirm at least one child genuinely exists.
 *  5. Only then: onboarding_completed = true.
 *  Any failure returns an error and leaves onboarding_completed
 *  untouched (false) — never true with zero children. */
export async function completeOnboardingCore(
  supabase: SupabaseClient,
  userId: string,
  input: OnboardingCoreInput,
  log: Logger = () => {},
): Promise<OnboardingCoreResult> {
  log('[ONBOARDING 01] submit started');

  const { data: existingProfile, error: fetchError } = await supabase
    .from('profiles')
    .select('id, onboarding_completed')
    .eq('id', userId)
    .maybeSingle();
  if (fetchError) {
    log('[ONBOARDING ERROR]', { stage: 1, category: 'profile-fetch' });
    return { status: 'error', message: "Couldn't load your profile. Please try again." };
  }
  if (existingProfile?.onboarding_completed) {
    log('[ONBOARDING 00] already complete — no writes');
    return { status: 'already-complete' };
  }

  const profileUpdate: Record<string, unknown> = { phone: input.phone || null };
  if (input.displayName) profileUpdate.display_name = input.displayName;
  if (input.email) profileUpdate.email = input.email;
  if (input.avatarUrl) profileUpdate.avatar_url = input.avatarUrl;
  if (input.parentRole !== undefined) profileUpdate.parent_role = input.parentRole;
  if (input.birthdate !== undefined) profileUpdate.birthdate = input.birthdate;
  if (input.neighborhood !== undefined) profileUpdate.neighborhood_label = input.neighborhood;
  if (input.occupation !== undefined) profileUpdate.occupation = input.occupation;
  if (input.bio !== undefined) profileUpdate.bio = input.bio;

  const { error: profileError } = await supabase.from('profiles').update(profileUpdate).eq('id', userId);
  if (profileError) {
    log('[ONBOARDING ERROR]', { stage: 2, category: 'profile-update' });
    return { status: 'error', message: "Couldn't save your profile. Please try again." };
  }
  log('[ONBOARDING 02] profile saved');

  // Idempotent: only insert children if none exist yet for this profile —
  // a retried tap after a prior attempt's child insert already succeeded
  // must not create duplicates.
  const { data: existingChildren, error: childFetchError } = await supabase
    .from('children')
    .select('id')
    .eq('profile_id', userId)
    .limit(1);
  if (childFetchError) {
    log('[ONBOARDING ERROR]', { stage: 3, category: 'children-fetch' });
    return { status: 'error', message: "Couldn't save your child's information. Please try again." };
  }

  if (!existingChildren?.length) {
    if (input.children.length === 0) {
      log('[ONBOARDING ERROR]', { stage: 3, category: 'no-children-provided' });
      return { status: 'error', message: 'Add at least one child to finish setting up your account.' };
    }
    const { error: childError } = await supabase.from('children').insert(
      input.children.map((child, index) => ({
        profile_id: userId,
        name: child.name,
        birthdate: child.birthdate,
        is_default: index === 0,
      })),
    );
    if (childError) {
      log('[ONBOARDING ERROR]', { stage: 3, category: 'children-insert' });
      return { status: 'error', message: "Couldn't save your child's information. Please try again." };
    }
  }
  log('[ONBOARDING 03] children saved');

  // Confirm at least one child genuinely exists in the database before
  // ever setting onboarding_completed — this is the step that was
  // previously missing (see the "onboardingCompleted before children"
  // defect this module exists to prevent from ever recurring).
  const { count: childCount, error: countError } = await supabase
    .from('children')
    .select('id', { count: 'exact', head: true })
    .eq('profile_id', userId);
  if (countError || !childCount) {
    log('[ONBOARDING ERROR]', { stage: 4, category: 'children-verify' });
    return { status: 'error', message: "Couldn't confirm your child was saved. Please try again." };
  }
  log('[ONBOARDING 04] children verified', { childCount });

  const { error: completeError } = await supabase
    .from('profiles')
    .update({ onboarding_completed: true })
    .eq('id', userId);
  if (completeError) {
    log('[ONBOARDING ERROR]', { stage: 5, category: 'completion-flag' });
    return { status: 'error', message: "Couldn't finish setting up your account. Please try again." };
  }
  log('[ONBOARDING 05] completion flag saved');

  return { status: 'completed' };
}
