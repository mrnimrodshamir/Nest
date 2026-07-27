import React, { useState } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { theme } from '@/theme';
import { AnimatedMomziLogo } from '@/components/MomziLogo';

/**
 * Shown while fonts/session are resolving. The entrance animation plays
 * once; if resolution takes longer than the ~1s settle, a small indicator
 * fades in beneath the logo rather than looping the entrance again. Never
 * gates navigation on the animation finishing — App.tsx swaps this screen
 * out the instant auth/fonts are ready, whatever this component is doing.
 */
export function LaunchScreen() {
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.background.app,
  },
  indicator: { marginTop: 32 },
});
