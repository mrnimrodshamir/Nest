import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import * as AppleAuthentication from 'expo-apple-authentication';
import { supabase } from '@/lib/supabase';
import { uploadAvatar } from '@/lib/uploadAvatar';
import { clearPushRegistration } from '@/hooks/usePushNotifications';
import { track } from '@/lib/analytics';
import { mapAuthError } from '@/lib/authErrors';
import type { NotificationPreferences, Profile } from '@/types/profile';

/** Guards against ASAuthorizationController being presented twice at once
 *  (a real crash on-device: "already presenting a view controller"). React
 *  state (`appleLoading`) alone can't prevent this — a fast double-tap can
 *  fire both onPress handlers before the disabled-button re-render commits.
 *  Module-level (not per-hook-instance) since every screen that calls
 *  signInWithApple must share the same lock. */
let appleSignInInFlight = false;

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export type RegistrationStage = 'creating-account' | 'uploading-photo' | 'saving-profile';

export interface RegistrationChildInput {
  name: string;
  birthdate: string; // ISO date (YYYY-MM-DD)
}

export interface RegistrationInput {
  fullName: string;
  email: string;
  password: string;
  /** At least one required — the first entry becomes the default child. */
  children: RegistrationChildInput[];
  /** All optional — collected later from Edit Profile, never required to finish signup. */
  phone?: string;
  photoUri?: string | null;
}

export interface AppleProfileInput {
  children: RegistrationChildInput[];
  phone?: string;
  photoUri?: string | null;
  /** Only present on Apple's very first authorization for this account. */
  fallbackFullName: string | null;
  fallbackEmail: string | null;
}

export type RegisterResult =
  | { status: 'signed-in' }
  | { status: 'error'; message: string };

/** Shared by email registration and Apple profile completion — the single
 *  implementation of "finish setting up the account" for both. */
export interface OnboardingCompletionInput {
  children: RegistrationChildInput[];
  phone?: string;
  photoUri?: string | null;
  /** Only overwrites the stub profile's value when non-null/non-empty. */
  displayName?: string | null;
  email?: string | null;
}

interface UseAuthResult {
  session: Session | null;
  profile: Profile | null;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<string | null>;
  register: (
    input: RegistrationInput,
    onStage?: (stage: RegistrationStage) => void,
  ) => Promise<RegisterResult>;
  signInWithApple: () => Promise<
    { status: 'signed-in' } | { status: 'needs-profile'; input: AppleProfileInput } | { status: 'error'; message: string } | { status: 'cancelled' }
  >;
  completeAppleProfile: (
    input: AppleProfileInput,
    onStage?: (stage: RegistrationStage) => void,
  ) => Promise<string | null>;
  resetPassword: (email: string) => Promise<string | null>;
  signOut: () => Promise<void>;
  deleteAccount: () => Promise<string | null>;
  refreshProfile: () => Promise<void>;
  updateProfileDetails: (details: {
    displayName: string;
    phone: string | null;
    photoUri?: string | null;
  }) => Promise<string | null>;
  updateNotificationPreferences: (prefs: NotificationPreferences) => Promise<string | null>;
}

/** The actual implementation — called exactly once, inside AuthProvider.
 *  Every screen consumes the single resulting state via useAuth() (a
 *  context read) instead of calling this directly, which used to create
 *  a brand new independent session/profile state and a brand new
 *  supabase.auth.onAuthStateChange subscription per call site (App.tsx,
 *  AuthNavigator's Apple-sign-in containers, ActivityDetailScreen,
 *  EditProfileScreen, ProfileScreen, every auth screen — a dozen+
 *  places). Duplicate listeners aren't just wasteful: each one resolves
 *  its own loadProfile() fetch on its own timing, so two instances could
 *  (and did) observe "session exists, profile still a stub" at different
 *  moments and make different UI decisions from it — see the App.tsx
 *  history around the Apple sign-in profile-completion race. */
function useAuthState(): UseAuthResult {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadProfile = useCallback(async (userId: string) => {
    try {
      const { data } = await supabase
        .from('profiles')
        .select('id, display_name, email, phone, avatar_url, onboarding_completed, notification_preferences')
        .eq('id', userId)
        .maybeSingle();
      setProfile(data ? mapProfile(data) : null);
    } catch (err) {
      // A network blip here must not leave the app stuck mid-boot — fall
      // back to "no profile yet" rather than never resolving.
      console.log('[Auth] Failed to load profile', err instanceof Error ? err.message : err);
      setProfile(null);
    }
  }, []);

  // Shared by register() (email) and completeAppleProfile() (Apple) — the
  // ONE implementation of "finish setting up the account", used by both
  // instead of two separately-maintained finalization paths (previously
  // email went through a database trigger reading signup metadata while
  // Apple went through this client function directly — divergent code
  // for the same operation, which is exactly the kind of duplication
  // that makes "both flows break at the same shared point" hard to
  // reason about). Deliberately ordered and idempotent per spec:
  // profile fields, then children, then confirm at least one child
  // exists, then (only then) onboarding_completed = true, then refresh
  // the single shared AuthProvider state. Any failure returns a friendly
  // message and leaves onboarding_completed untouched (false) so the
  // user can safely retry or reopen the app later — never left with
  // onboarding_completed=true and zero children.
  const completeOnboarding = useCallback(
    async (
      userId: string,
      input: OnboardingCompletionInput,
      onStage?: (stage: RegistrationStage) => void,
    ): Promise<string | null> => {
      console.log('[ONBOARDING 01] submit started');

      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('id, onboarding_completed')
        .eq('id', userId)
        .maybeSingle();
      if (existingProfile?.onboarding_completed) {
        // Idempotent: re-entering this form after a completed signup
        // (e.g. a retried tap whose first attempt actually succeeded)
        // does no further writes, just refreshes and returns.
        console.log('[ONBOARDING 00] already complete — refreshing shared state only');
        await loadProfile(userId);
        return null;
      }

      onStage?.('creating-account');

      let avatarUrl: string | null = null;
      if (input.photoUri) {
        onStage?.('uploading-photo');
        try {
          avatarUrl = await uploadAvatar(userId, input.photoUri);
        } catch (err) {
          // Photo upload is optional — never block account creation on it.
          console.log('[Auth] Onboarding avatar upload failed, continuing without it', err instanceof Error ? err.message : err);
        }
      }

      onStage?.('saving-profile');
      const profileUpdate: Record<string, unknown> = { phone: input.phone || null };
      if (input.displayName) profileUpdate.display_name = input.displayName;
      if (input.email) profileUpdate.email = input.email;
      if (avatarUrl) profileUpdate.avatar_url = avatarUrl;

      const { error: profileError } = await supabase.from('profiles').update(profileUpdate).eq('id', userId);
      if (profileError) {
        console.log('[Auth] Onboarding profile update failed', profileError.message);
        return "Couldn't save your profile. Please try again.";
      }
      console.log('[ONBOARDING 02] profile update complete');

      // Idempotent: only insert children if none exist yet for this
      // profile — a retried tap after a prior attempt's child insert
      // already succeeded must not create duplicates.
      const { data: existingChildren } = await supabase
        .from('children')
        .select('id')
        .eq('profile_id', userId)
        .limit(1);

      if (!existingChildren?.length) {
        if (input.children.length === 0) {
          console.log('[Auth] Onboarding: no children provided and none exist yet');
          return "Add at least one child to finish setting up your account.";
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
          console.log('[Auth] Onboarding child insert failed', childError.message);
          return "Couldn't save your child's information. Please try again.";
        }
      }
      console.log('[ONBOARDING 03] children insert complete');

      // Confirm at least one child genuinely exists in the database
      // before ever setting onboarding_completed — this is the step
      // that was previously missing: onboarding_completed used to be
      // set in the same UPDATE as other profile fields, before children
      // were confirmed inserted, so a failed/slow child insert could
      // leave onboarding_completed=true with zero children.
      const { count: childCount, error: countError } = await supabase
        .from('children')
        .select('id', { count: 'exact', head: true })
        .eq('profile_id', userId);
      if (countError || !childCount) {
        console.log('[Auth] Onboarding: child confirmation found zero children', { countError: countError?.message ?? null });
        return "Couldn't confirm your child was saved. Please try again.";
      }

      const { error: completeError } = await supabase
        .from('profiles')
        .update({ onboarding_completed: true })
        .eq('id', userId);
      if (completeError) {
        console.log('[Auth] Onboarding completion flag update failed', completeError.message);
        return "Couldn't finish setting up your account. Please try again.";
      }
      console.log('[ONBOARDING 04] onboardingCompleted update complete');

      track('sign_up_completed');
      track('onboarding_completed');

      console.log('[ONBOARDING 05] shared profile refresh started');
      await loadProfile(userId);
      console.log('[ONBOARDING 06] shared profile refresh complete');

      return null;
    },
    [loadProfile],
  );

  useEffect(() => {
    track('app_opened');
    supabase.auth
      .getSession()
      .then(async ({ data }) => {
        setSession(data.session);
        if (data.session) await loadProfile(data.session.user.id);
      })
      .catch(async (err) => {
        // A corrupted/unreadable persisted session must never hang the app
        // on the launch screen forever or crash on every subsequent boot —
        // clear it and drop the user back to a clean sign-in screen.
        console.log('[Auth] Session restore failed, clearing local session', err instanceof Error ? err.message : err);
        try {
          await supabase.auth.signOut();
        } catch {
          // Best effort — proceed to the signed-out state regardless.
        }
        setSession(null);
        setProfile(null);
      })
      .finally(() => setIsLoading(false));

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      if (newSession) {
        loadProfile(newSession.user.id);
      } else {
        setProfile(null);
      }
    });

    return () => subscription.subscription.unsubscribe();
  }, [loadProfile]);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email: normalizeEmail(email),
      password,
    });
    if (error) {
      // Never log the password; error.message from Supabase Auth never
      // includes credential values, only a classification like "Invalid
      // login credentials".
      console.log('[Auth] Email sign-in failed', error.message);
      return mapAuthError(error.message);
    }
    console.log('[Auth] Email sign-in succeeded');
    return null;
  }, []);

  const register = useCallback(
    async (input: RegistrationInput, onStage?: (stage: RegistrationStage) => void): Promise<RegisterResult> => {
      track('sign_up_started');
      onStage?.('creating-account');

      // Email confirmation is disabled for this project (a manual
      // Supabase Dashboard setting — see the deliverable report for the
      // exact path), so signUp() is expected to return an active session
      // immediately. full_name still rides along as signup metadata so
      // the auth-user-creation trigger's stub profile starts with a
      // reasonable display name even before completeOnboarding runs.
      const { data, error } = await supabase.auth.signUp({
        email: normalizeEmail(input.email),
        password: input.password,
        options: {
          data: { full_name: input.fullName.trim() },
        },
      });
      if (error) {
        console.log('[Auth] Registration failed at signUp', error.message);
        return { status: 'error', message: mapAuthError(error.message) };
      }

      const userId = data.user?.id;
      if (!userId) return { status: 'error', message: 'Something went wrong. Please try again.' };

      // Supabase's anti-enumeration behavior: signUp() with an email that
      // already has an account never returns an error — it returns
      // success with a synthetic user object whose identities array is
      // empty, so a bad actor can't use signup to probe which emails are
      // registered. That's the only reliable signal. Verified directly
      // against the live Auth API.
      if (data.user?.identities?.length === 0) {
        console.log('[Auth] Registration attempted for an existing email', { userId });
        return {
          status: 'error',
          message: 'An account already exists with this email. Try logging in instead.',
        };
      }

      if (!data.session) {
        // With confirmation disabled this should not normally happen —
        // fail safely and recoverably rather than silently proceeding
        // with no session (completeOnboarding requires auth.uid() to
        // write profile/children, and would be rejected by RLS with no
        // session, same as the original "new row violates row-level
        // security policy" bug this whole area was built to avoid).
        console.log('[Auth] Registration: signUp returned no session unexpectedly', { userId });
        return {
          status: 'error',
          message: "Your account was created, but we couldn't sign you in automatically. Please log in.",
        };
      }

      const completionError = await completeOnboarding(
        userId,
        {
          children: input.children,
          phone: input.phone,
          photoUri: input.photoUri,
          displayName: input.fullName.trim(),
          email: normalizeEmail(input.email),
        },
        onStage,
      );
      if (completionError) return { status: 'error', message: completionError };

      console.log('[Auth] Registration succeeded', { userId });
      return { status: 'signed-in' };
    },
    [completeOnboarding],
  );

  const signInWithApple = useCallback(async () => {
    if (appleSignInInFlight) {
      // A fast double-tap can fire two onPress handlers before the
      // disabled-button re-render commits — React state can't prevent
      // that, only a synchronous lock can. Presenting a second native
      // ASAuthorizationController while one is already up is a real crash
      // on-device, not just a bad UX. Silently ignore the second call.
      console.log('[Auth] Apple sign-in: ignored duplicate concurrent request');
      return { status: 'cancelled' as const };
    }
    appleSignInInFlight = true;
    console.log('[Auth] Apple sign-in: requesting native credential');
    try {
      let credential: AppleAuthentication.AppleAuthenticationCredential;
      try {
        credential = await AppleAuthentication.signInAsync({
          requestedScopes: [
            AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
            AppleAuthentication.AppleAuthenticationScope.EMAIL,
          ],
        });
      } catch (err: any) {
        console.log('[Auth] Apple sign-in: native request failed', err?.code ?? err?.message);
        if (err?.code === 'ERR_REQUEST_CANCELED') return { status: 'cancelled' as const };
        if (err?.code === 'ERR_REQUEST_NOT_HANDLED' || err?.code === 'ERR_REQUEST_NOT_INTERACTIVE') {
          return {
            status: 'error' as const,
            message: 'Sign in with Apple is not available on this device right now.',
          };
        }
        return { status: 'error' as const, message: 'Sign in with Apple failed. Please try again.' };
      }

      console.log('[Auth] Apple sign-in: credential received', {
        hasIdentityToken: Boolean(credential.identityToken),
        hasEmail: Boolean(credential.email),
        hasFullName: Boolean(credential.fullName?.givenName),
      });

      if (!credential.identityToken) {
        return {
          status: 'error' as const,
          message: 'Apple did not return a valid credential. Please try again.',
        };
      }

      const { data, error } = await supabase.auth.signInWithIdToken({
        provider: 'apple',
        token: credential.identityToken,
      });
      if (error) {
        console.log('[Auth] Apple sign-in: Supabase error', error.message);
        return { status: 'error' as const, message: mapAuthError(error.message) };
      }

      const userId = data.user?.id;
      if (!userId) return { status: 'error' as const, message: 'Sign in with Apple failed. Please try again.' };
      console.log('[Auth] Apple sign-in: Supabase session established', { userId, hasSession: Boolean(data.session) });

      // The auth-user-creation trigger already created a profile row for
      // every account (Apple included) — a bare existence check would
      // wrongly treat a brand-new, still-incomplete stub row as "fully
      // signed in". `onboarding_completed` is the real signal.
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('id, onboarding_completed')
        .eq('id', userId)
        .maybeSingle();
      console.log('[Auth] Apple sign-in: profile lookup complete', {
        userId,
        profileExists: Boolean(existingProfile),
        onboardingCompleted: existingProfile?.onboarding_completed ?? null,
      });

      if (existingProfile?.onboarding_completed) {
        console.log('[Auth] Apple sign-in: returning user, loading profile', { userId });
        await loadProfile(userId);
        console.log('[Auth] Apple sign-in: returning user, profile loaded — signed-in');
        return { status: 'signed-in' as const };
      }

      // New account, or an interrupted signup that never finished
      // completeAppleProfile. Apple only ever sends fullName/email on the
      // very first authorization for this app+Apple ID — persist whatever
      // we got into the stub profile row *now*, since a retry won't
      // receive it again and no caller can be relied on to carry it
      // forward (see the App.tsx routing note on why the completion
      // screen is reached reactively, not via a passed navigation param).
      console.log('[Auth] Apple sign-in: needs profile completion', { userId });
      track('sign_up_started');
      const fullName = credential.fullName
        ? [credential.fullName.givenName, credential.fullName.familyName].filter(Boolean).join(' ')
        : null;

      if (fullName) {
        console.log('[Auth] Apple sign-in: persisting captured display name to stub profile', { userId });
        const { error: nameError } = await supabase
          .from('profiles')
          .update({ display_name: fullName })
          .eq('id', userId);
        if (nameError) console.log('[Auth] Apple sign-in: persisting display name failed', nameError.message);
      }

      // Update the shared context's profile state too, so anything
      // reading it (App.tsx's routing gate included) sees the real name
      // immediately rather than waiting on its own separate fetch.
      await loadProfile(userId);
      console.log('[Auth] Apple sign-in: needs-profile result ready, shared profile state refreshed', { userId });

      return {
        status: 'needs-profile' as const,
        input: {
          children: [],
          fallbackFullName: fullName || null,
          fallbackEmail: credential.email ?? data.user.email ?? null,
        },
      };
    } catch (err: any) {
      // Belt-and-braces: nothing above should throw uncaught (native
      // request and Supabase errors are already handled), but a crash-free
      // guarantee means even an unexpected exception here must resolve to
      // a value, never propagate.
      console.log('[Auth] Apple sign-in: unexpected exception', err?.message ?? err);
      return { status: 'error' as const, message: 'Sign in with Apple failed. Please try again.' };
    } finally {
      appleSignInInFlight = false;
    }
  }, [loadProfile]);

  const completeAppleProfile = useCallback(
    async (input: AppleProfileInput, onStage?: (stage: RegistrationStage) => void) => {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (!userId) return 'Not signed in.';

      // Apple only sends fullName/email on the very first authorization —
      // a retry after an interrupted signup won't have them again, so
      // don't overwrite the stub's existing (non-null) values with null.
      return completeOnboarding(
        userId,
        {
          children: input.children,
          phone: input.phone,
          photoUri: input.photoUri,
          displayName: input.fallbackFullName,
          email: input.fallbackEmail ?? userData.user?.email ?? null,
        },
        onStage,
      );
    },
    [completeOnboarding],
  );

  const resetPassword = useCallback(async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(normalizeEmail(email), {
      redirectTo: 'momzi://reset-password',
    });
    if (error) {
      console.log('[Auth] Password reset request failed', error.message);
      // Deliberately the same friendly message regardless of whether the
      // email exists — Supabase itself returns success either way by
      // default, so this only fires for real failures (rate limit,
      // network), never to confirm/deny an account's existence.
      return mapAuthError(error.message);
    }
    return null;
  }, []);

  const signOut = useCallback(async () => {
    if (session) {
      await clearPushRegistration(session.user.id);
    }
    await supabase.auth.signOut();
    console.log('[Auth] Signed out');
  }, [session]);

  const deleteAccount = useCallback(async () => {
    if (!session) return 'Not signed in.';
    track('account_deleted');
    const { data, error } = await supabase.functions.invoke('delete-account', { method: 'POST' });
    if (error) {
      console.log('[Auth] Account deletion failed', error.message);
      return 'Could not delete your account. Please try again.';
    }
    if (data?.error) return data.error as string;
    await supabase.auth.signOut();
    return null;
  }, [session]);

  const refreshProfile = useCallback(async () => {
    if (session) await loadProfile(session.user.id);
  }, [session, loadProfile]);

  const updateProfileDetails = useCallback(
    async (details: { displayName: string; phone: string | null; photoUri?: string | null }) => {
      if (!session) return 'Not signed in';
      let avatarUrl: string | undefined;
      if (details.photoUri) {
        try {
          avatarUrl = await uploadAvatar(session.user.id, details.photoUri);
        } catch (err) {
          console.log('[Auth] Avatar upload failed', err instanceof Error ? err.message : err);
          return "Couldn't upload your photo — please try again.";
        }
      }
      const { error } = await supabase
        .from('profiles')
        .update({
          display_name: details.displayName,
          phone: details.phone,
          ...(avatarUrl ? { avatar_url: avatarUrl } : {}),
        })
        .eq('id', session.user.id);
      if (error) {
        console.log('[Auth] Profile update failed', error.message);
        return "Couldn't save your changes. Please try again.";
      }
      await loadProfile(session.user.id);
      return null;
    },
    [session, loadProfile],
  );

  const updateNotificationPreferences = useCallback(
    async (prefs: NotificationPreferences) => {
      if (!session) return 'Not signed in';
      const { error } = await supabase
        .from('profiles')
        .update({ notification_preferences: prefs })
        .eq('id', session.user.id);
      if (error) {
        console.log('[Auth] Notification preferences update failed', error.message);
        return "Couldn't save your changes. Please try again.";
      }
      await loadProfile(session.user.id);
      return null;
    },
    [session, loadProfile],
  );

  return {
    session,
    profile,
    isLoading,
    signIn,
    register,
    signInWithApple,
    completeAppleProfile,
    resetPassword,
    signOut,
    deleteAccount,
    refreshProfile,
    updateProfileDetails,
    updateNotificationPreferences,
  };
}

const AuthContext = createContext<UseAuthResult | null>(null);

/** Wraps the whole app, once, in App.tsx. Owns the single session/profile
 *  state and the single onAuthStateChange subscription that every screen
 *  reads via useAuth(). */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const value = useAuthState();
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): UseAuthResult {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error('useAuth() must be called within <AuthProvider>');
  }
  return value;
}

function mapProfile(row: {
  id: string;
  display_name: string;
  email: string;
  phone: string | null;
  avatar_url: string | null;
  onboarding_completed: boolean;
  notification_preferences: NotificationPreferences;
}): Profile {
  return {
    id: row.id,
    displayName: row.display_name,
    email: row.email,
    phone: row.phone,
    avatarUrl: row.avatar_url,
    onboardingCompleted: row.onboarding_completed,
    notificationPreferences: row.notification_preferences,
  };
}
