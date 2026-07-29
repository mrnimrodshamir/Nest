export type RouteDecision = 'auth-navigator' | 'complete-profile' | 'main-navigator';

/** The exact routing rule App.tsx uses to switch between the Auth
 *  navigator, the profile-completion screen, and the Main navigator.
 *  Pulled out to a pure function (no React/RN import) specifically so the
 *  transition harness can drive the real routing decision — not a
 *  reimplementation of it — the same way App.tsx does. */
export function computeRouteDecision(
  session: unknown,
  profile: { onboardingCompleted: boolean } | null,
): RouteDecision {
  if (!session) return 'auth-navigator';
  if (!profile || !profile.onboardingCompleted) return 'complete-profile';
  return 'main-navigator';
}
