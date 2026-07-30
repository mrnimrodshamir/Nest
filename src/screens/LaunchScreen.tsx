import React, { useState } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { theme } from '@/theme';
import { AnimatedMomziLogo, MomziLogo } from '@/components/MomziLogo';
import { DISABLE_AUTH_WORKLETS } from '@/diagnostics/diagnosticFlags';

/**
 * Shown while fonts/session are resolving. App.tsx swaps this screen out
 * the instant auth/fonts are ready, whatever it's doing — never gates
 * navigation on anything finishing. Picks between the animated and fully
 * static implementation before rendering (see DISABLE_AUTH_WORKLETS);
 * never calls a Reanimated hook conditionally within one component.
 */
export function LaunchScreen() {
  return DISABLE_AUTH_WORKLETS ? <StaticLaunchScreen /> : <AnimatedLaunchScreen />;
}

/** The entrance animation plays once; if resolution takes longer than the
 *  ~1s settle, a small indicator fades in beneath the logo rather than
 *  looping the entrance again. */
function AnimatedLaunchScreen() {
  const [settled, setSettled] = useState(false);

  return (
    <View style={styles.container}>
      <AnimatedMomziLogo size={140} onSettled={() => setSettled(true)} />
      {settled && (
        <View style={styles.indicator}>
          <ActivityIndicator color={theme.text.muted} />
        </View>
      )}
    </View>
  );
}

/** Diagnostic-mode counterpart — no shared values, no useAnimatedStyle,
 *  no withSpring/withTiming, no settle-tracking state or completion
 *  callback. Must be safe to unmount immediately, at any point. */
function StaticLaunchScreen() {
  return (
    <View style={styles.container}>
      <MomziLogo size={140} />
      <View style={styles.indicator}>
        <ActivityIndicator color={theme.text.muted} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.background.app,
  },
  indicator: { marginTop: 32 },
});
