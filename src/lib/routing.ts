import { needsAppleProfileSetup, needsInitialProfileSetup } from '@/utils/profileCompleteness';

export type RouteDecision = 'auth-navigator' | 'complete-profile' | 'main-navigator';

/** The exact routing rule App.tsx uses to switch between the Auth
 *  navigator, the profile-completion screen, and the Main navigator.
 *  Pulled out to a pure function (no React/RN import) specifically so the
 *  transition harness can drive the real routing decision — not a
 *  reimplementation of it — the same way App.tsx does. */
export function computeRouteDecision(
  session: unknown,
  profile: { onboardingCompleted: boolean; displayName?: string | null; parentRole?: 'mom' | 'dad' | 'parent' | null; birthdate?: string | null; neighborhood?: string | null } | null,
): RouteDecision {
  if (!session) return 'auth-navigator';
  if (isAppleSession(session) ? needsAppleProfileSetup(profile) : needsInitialProfileSetup(profile)) return 'complete-profile';
  return 'main-navigator';
}

function isAppleSession(session: unknown): boolean {
  if (!session || typeof session !== 'object') return false;
  const user = (session as { user?: { app_metadata?: { provider?: unknown; providers?: unknown } } }).user;
  const provider = user?.app_metadata?.provider;
  const providers = user?.app_metadata?.providers;
  return provider === 'apple' || (Array.isArray(providers) && providers.includes('apple'));
}
