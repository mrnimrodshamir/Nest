import { useCallback, useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import * as AppleAuthentication from 'expo-apple-authentication';
import { supabase } from '@/lib/supabase';
import { uploadAvatar } from '@/lib/uploadAvatar';
import { clearPushRegistration } from '@/hooks/usePushNotifications';
import type { NotificationPreferences, Profile } from '@/types/profile';

function isNetworkError(message: string): boolean {
  return /network|fetch failed|timed? ?out|offline/i.test(message);
}

export type RegistrationStage = 'creating-account' | 'uploading-photo' | 'saving-profile';

export interface RegistrationInput {
  fullName: string;
  email: string;
  password: string;
  phone: string;
  babyName: string;
  babyBirthdate: string; // ISO date, already converted from the years/months picker
  photoUri: string | null;
}

export interface AppleProfileInput {
  phone: string;
  babyName: string;
  babyBirthdate: string;
  photoUri: string | null;
  /** Only present on Apple's very first authorization for this account. */
  fallbackFullName: string | null;
  fallbackEmail: string | null;
}

interface UseAuthResult {
  session: Session | null;
  profile: Profile | null;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<string | null>;
  register: (input: RegistrationInput, onStage?: (stage: RegistrationStage) => void) => Promise<string | null>;
  signInWithApple: () => Promise<
    { status: 'signed-in' } | { status: 'needs-profile'; input: AppleProfileInput } | { status: 'error'; message: string } | { status: 'cancelled' }
  >;
  completeAppleProfile: (
    input: AppleProfileInput,
    onStage?: (stage: RegistrationStage) => void,
  ) => Promise<string | null>;
  resetPassword: (email: string) => Promise<string | null>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  updateNotificationPreferences: (prefs: NotificationPreferences) => Promise<string | null>;
}

export function useAuth(): UseAuthResult {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadProfile = useCallback(async (userId: string) => {
    try {
      const { data } = await supabase
        .from('profiles')
        .select(
          'id, display_name, email, phone, avatar_url, baby_name, baby_birthdate, onboarding_completed, notification_preferences',
        )
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

  useEffect(() => {
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
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      console.log('[Auth] Email sign-in failed', error.message);
      return isNetworkError(error.message) ? 'No internet connection — please try again.' : error.message;
    }
    console.log('[Auth] Email sign-in succeeded');
    return null;
  }, []);

  const register = useCallback(async (input: RegistrationInput, onStage?: (stage: RegistrationStage) => void) => {
    onStage?.('creating-account');
    const { data, error } = await supabase.auth.signUp({
      email: input.email,
      password: input.password,
    });
    if (error) {
      console.log('[Auth] Registration failed at signUp', error.message);
      return isNetworkError(error.message) ? 'No internet connection — please try again.' : error.message;
    }

    const userId = data.user?.id;
    if (!userId) return 'Could not create account — please try again.';

    let avatarUrl: string | null = null;
    if (input.photoUri) {
      onStage?.('uploading-photo');
      try {
        avatarUrl = await uploadAvatar(userId, input.photoUri);
      } catch (err) {
        // Photo upload is optional — never block account creation on it.
        console.log('[Auth] Avatar upload failed, continuing without it', err instanceof Error ? err.message : err);
        avatarUrl = null;
      }
    }

    onStage?.('saving-profile');
    const { error: profileError } = await supabase.from('profiles').insert({
      id: userId,
      display_name: input.fullName,
      email: input.email,
      phone: input.phone,
      baby_name: input.babyName,
      baby_birthdate: input.babyBirthdate,
      avatar_url: avatarUrl,
      onboarding_completed: true,
    });
    if (profileError) return profileError.message;

    console.log('[Auth] Registration succeeded', { userId });
    await loadProfile(userId);
    return null;
  }, [loadProfile]);

  const signInWithApple = useCallback(async () => {
    console.log('[Auth] Apple sign-in: requesting native credential');
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });
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
        if (isNetworkError(error.message)) {
          return { status: 'error' as const, message: 'No internet connection — please try again.' };
        }
        if (/already registered|already exists|user_already_exists/i.test(error.message)) {
          return {
            status: 'error' as const,
            message:
              'An account already exists with this email. Try logging in with email and password instead.',
          };
        }
        return { status: 'error' as const, message: error.message };
      }

      const userId = data.user?.id;
      if (!userId) return { status: 'error' as const, message: 'Sign in with Apple failed.' };

      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', userId)
        .maybeSingle();

      if (existingProfile) {
        console.log('[Auth] Apple sign-in: returning user', { userId });
        await loadProfile(userId);
        return { status: 'signed-in' as const };
      }

      // First-ever authorization for this account — Apple gives us name/email
      // exactly once, right now. Carry it forward for the profile-completion
      // step since it won't be sent again on future logins.
      console.log('[Auth] Apple sign-in: first-time user, needs profile completion', { userId });
      const fullName = credential.fullName
        ? [credential.fullName.givenName, credential.fullName.familyName].filter(Boolean).join(' ')
        : null;

      return {
        status: 'needs-profile' as const,
        input: {
          phone: '',
          babyName: '',
          babyBirthdate: '',
          photoUri: null,
          fallbackFullName: fullName || null,
          fallbackEmail: credential.email ?? data.user.email ?? null,
        },
      };
    } catch (err: any) {
      console.log('[Auth] Apple sign-in: exception', err?.code ?? err?.message);
      if (err?.code === 'ERR_REQUEST_CANCELED') return { status: 'cancelled' as const };
      if (err?.code === 'ERR_REQUEST_NOT_HANDLED' || err?.code === 'ERR_REQUEST_NOT_INTERACTIVE') {
        return {
          status: 'error' as const,
          message: 'Sign in with Apple is not available on this device right now.',
        };
      }
      if (isNetworkError(err?.message ?? '')) {
        return { status: 'error' as const, message: 'No internet connection — please try again.' };
      }
      return { status: 'error' as const, message: err?.message ?? 'Sign in with Apple failed.' };
    }
  }, [loadProfile]);

  const completeAppleProfile = useCallback(
    async (input: AppleProfileInput, onStage?: (stage: RegistrationStage) => void) => {
      onStage?.('creating-account');
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (!userId) return 'Not signed in.';

      // Do not create duplicate profiles for the same account.
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', userId)
        .maybeSingle();
      if (existingProfile) {
        await loadProfile(userId);
        return null;
      }

      let avatarUrl: string | null = null;
      if (input.photoUri) {
        onStage?.('uploading-photo');
        try {
          avatarUrl = await uploadAvatar(userId, input.photoUri);
        } catch (err) {
          console.log('[Auth] Avatar upload failed, continuing without it', err instanceof Error ? err.message : err);
          avatarUrl = null;
        }
      }

      onStage?.('saving-profile');
      const { error } = await supabase.from('profiles').insert({
        id: userId,
        display_name: input.fallbackFullName ?? 'Momzi member',
        email: input.fallbackEmail ?? userData.user?.email ?? '',
        phone: input.phone,
        baby_name: input.babyName,
        baby_birthdate: input.babyBirthdate,
        avatar_url: avatarUrl,
        onboarding_completed: true,
      });
      if (error) return error.message;

      await loadProfile(userId);
      return null;
    },
    [loadProfile],
  );

  const resetPassword = useCallback(async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    return error?.message ?? null;
  }, []);

  const signOut = useCallback(async () => {
    if (session) {
      await clearPushRegistration(session.user.id);
    }
    await supabase.auth.signOut();
    console.log('[Auth] Signed out');
  }, [session]);

  const refreshProfile = useCallback(async () => {
    if (session) await loadProfile(session.user.id);
  }, [session, loadProfile]);

  const updateNotificationPreferences = useCallback(
    async (prefs: NotificationPreferences) => {
      if (!session) return 'Not signed in';
      const { error } = await supabase
        .from('profiles')
        .update({ notification_preferences: prefs })
        .eq('id', session.user.id);
      if (error) return error.message;
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
    refreshProfile,
    updateNotificationPreferences,
  };
}

function mapProfile(row: {
  id: string;
  display_name: string;
  email: string;
  phone: string | null;
  avatar_url: string | null;
  baby_name: string | null;
  baby_birthdate: string | null;
  onboarding_completed: boolean;
  notification_preferences: NotificationPreferences;
}): Profile {
  return {
    id: row.id,
    displayName: row.display_name,
    email: row.email,
    phone: row.phone,
    avatarUrl: row.avatar_url,
    babyName: row.baby_name,
    babyBirthdate: row.baby_birthdate,
    onboardingCompleted: row.onboarding_completed,
    notificationPreferences: row.notification_preferences,
  };
}
