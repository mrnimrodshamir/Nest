import React from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { theme } from '@/theme';
import { NestUpLogo } from '@/components/NestUpLogo';

/**
 * Shown while fonts/session are resolving. App.tsx swaps this screen out
 * the instant auth/fonts are ready. Fully static — no Reanimated, no
 * shared values, no entrance animation, nothing to be mid-flight when
 * this screen is unmounted (see NestUpLogo.tsx for why that mattered).
 */
export function LaunchScreen() {
  return (
    <View style={styles.container}>
      <NestUpLogo size={140} />
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
