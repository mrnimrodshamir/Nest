import { useCallback, useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import * as AppleAuthentication from 'expo-apple-authentication';
import { supabase } from '@/lib/supabase';
import { uploadAvatar } from '@/lib/uploadAvatar';
import type { NotificationPreferences, Profile } from '@/types/profile';

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
  register: (input: RegistrationInput) => Promise<string | null>;
  signInWithApple: () => Promise<
    { status: 'signed-in' } | { status: 'needs-profile'; input: AppleProfileInput } | { status: 'error'; message: string } | { status: 'cancelled' }
  >;
  completeAppleProfile: (input: AppleProfileInput) => Promise<string | null>;
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
    const { data } = await supabase
      .from('profiles')
      .select(
        'id, display_name, email, phone, avatar_url, baby_name, baby_birthdate, onboarding_completed, notification_preferences',
      )
      .eq('id', userId)
      .maybeSingle();
    setProfile(data ? mapProfile(data) : null);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session);
      if (data.session) await loadProfile(data.session.user.id);
      setIsLoading(false);
    });

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
    return error?.message ?? null;
  }, []);

  const register = useCallback(async (input: RegistrationInput) => {
    const { data, error } = await supabase.auth.signUp({
      email: input.email,
      password: input.password,
    });
    if (error) return error.message;

    const userId = data.user?.id;
    if (!userId) return 'Could not create account — please try again.';

    let avatarUrl: string | null = null;
    if (input.photoUri) {
      try {
        avatarUrl = await uploadAvatar(userId, input.photoUri);
      } catch {
        // Photo upload is optional — never block account creation on it.
        avatarUrl = null;
      }
    }

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

    await loadProfile(userId);
    return null;
  }, [loadProfile]);

  const signInWithApple = useCallback(async () => {
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });

      if (!credential.identityToken) {
        return { status: 'error' as const, message: 'Apple did not return an identity token.' };
      }

      const { data, error } = await supabase.auth.signInWithIdToken({
        provider: 'apple',
        token: credential.identityToken,
      });
      if (error) return { status: 'error' as const, message: error.message };

      const userId = data.user?.id;
      if (!userId) return { status: 'error' as const, message: 'Sign in with Apple failed.' };

      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', userId)
        .maybeSingle();

      if (existingProfile) {
        await loadProfile(userId);
        return { status: 'signed-in' as const };
      }

      // First-ever authorization for this account — Apple gives us name/email
      // exactly once, right now. Carry it forward for the profile-completion
      // step since it won't be sent again on future logins.
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
      if (err?.code === 'ERR_REQUEST_CANCELED') return { status: 'cancelled' as const };
      return { status: 'error' as const, message: err?.message ?? 'Sign in with Apple failed.' };
    }
  }, [loadProfile]);

  const completeAppleProfile = useCallback(
    async (input: AppleProfileInput) => {
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
        try {
          avatarUrl = await uploadAvatar(userId, input.photoUri);
        } catch {
          avatarUrl = null;
        }
      }

      const { error } = await supabase.from('profiles').insert({
        id: userId,
        display_name: input.fallbackFullName ?? 'Monzy member',
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
    await supabase.auth.signOut();
  }, []);

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
