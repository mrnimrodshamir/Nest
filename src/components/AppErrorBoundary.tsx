import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/lib/supabase';
import { PrimaryButton } from '@/components/PrimaryButton';
import { theme, typography, spacing } from '@/theme';
import { APP_NAME } from '@/constants/brand';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  isRecovering: boolean;
}

/** Last line of defense: a single bad render anywhere in the tree used to take
 *  down the whole app, and since a live session sends users straight back to
 *  the same screen on relaunch, one bad render became a permanent boot loop.
 *  This catches it, clears local session/auth state (the most likely cause of
 *  a state-dependent crash), and lets the user recover into a clean sign-in
 *  screen instead of a bricked app. */
export class AppErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false, isRecovering: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: unknown, info: React.ErrorInfo) {
    console.log('[AppErrorBoundary] Caught render error', error, info.componentStack);
  }

  handleRecover = async () => {
    this.setState({ isRecovering: true });
    try {
      await supabase.auth.signOut();
    } catch {
      // Fall through to a hard local clear below regardless.
    }
    try {
      await AsyncStorage.clear();
    } catch {
      // Nothing more we can do locally — restarting into the error screen
      // again is still better than a native crash.
    }
    this.setState({ hasError: false, isRecovering: false });
  };

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.container}>
          <Text style={styles.title}>We hit a snag</Text>
          <Text style={styles.body}>
            {APP_NAME} needs to reset your session to keep going. Your account is safe — you'll
            just need to sign in again.
          </Text>
          <PrimaryButton
            label="Reset and continue"
            onPress={this.handleRecover}
            loading={this.state.isRecovering}
          />
        </View>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background.app,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    gap: spacing.md,
  },
  title: { ...typography.headline, color: theme.text.primary, textAlign: 'center' },
  body: { ...typography.bodyMedium, color: theme.text.secondary, textAlign: 'center' },
});
