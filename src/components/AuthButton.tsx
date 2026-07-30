import React from 'react';
import { PrimaryButton } from '@/components/PrimaryButton';
import { StaticPrimaryButton } from '@/components/StaticPrimaryButton';
import { DISABLE_AUTH_WORKLETS } from '@/diagnostics/diagnosticFlags';

/** Every auth/onboarding screen renders its primary action through this
 *  instead of importing PrimaryButton directly, so
 *  EXPO_PUBLIC_DISABLE_AUTH_WORKLETS governs all of them from one place.
 *  Picks which component to render before rendering it — never calls a
 *  Reanimated hook conditionally inside a single component body. */
export function AuthButton(props: React.ComponentProps<typeof PrimaryButton>) {
  return DISABLE_AUTH_WORKLETS ? <StaticPrimaryButton {...props} /> : <PrimaryButton {...props} />;
}
