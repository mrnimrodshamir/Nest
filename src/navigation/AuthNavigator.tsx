import React, { useCallback, useRef, useState } from 'react';
import { Alert } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { WelcomeScreen } from '@/screens/auth/WelcomeScreen';
import { SignInScreen } from '@/screens/auth/SignInScreen';
import { SignUpScreen } from '@/screens/auth/SignUpScreen';
import { ForgotPasswordScreen } from '@/screens/auth/ForgotPasswordScreen';
import { useAuth } from '@/hooks/useAuth';
import { useI18n } from '@/i18n';

export type AuthStackParamList = {
  Welcome: undefined;
  SignIn: undefined;
  SignUp: undefined;
  ForgotPassword: undefined;
};

const Stack = createNativeStackNavigator<AuthStackParamList>();

/** Shared by every screen that offers "Continue with Apple" (Welcome and
 *  Sign In) so the loading/guard state and result handling stay identical
 *  regardless of where the button was tapped.
 *
 *  Deliberately does NOT navigate anywhere for a 'needs-profile' result.
 *  It used to call navigation.navigate('CompleteAppleProfile', ...) on
 *  this screen's own stack — but App.tsx's top-level session/profile gate
 *  reacts to the exact same auth state (now shared via AuthProvider) and
 *  independently decides to swap the whole navigator tree away from
 *  AuthNavigator the moment the profile look-up resolves. Those two
 *  things racing — an imperative .navigate() call against a navigator
 *  that App.tsx can unmount out from under it at any moment — is exactly
 *  the kind of concurrent-tree-mutation React Navigation does not handle
 *  safely, and was found to be the real crash mechanism (not just the
 *  double-tap re-entrancy issue fixed earlier). App.tsx's reactive gate
 *  is now the ONLY thing that ever decides to show the profile-completion
 *  screen — this handler only has to react to a real, final error. */
function useAppleSignIn() {
  const { signInWithApple } = useAuth();
  const { t } = useI18n();
  const [appleLoading, setAppleLoading] = useState(false);
  // Belt-and-braces UI-level guard alongside the hook's own re-entrancy
  // lock — a ref (not state) so it's checked synchronously, before the
  // first tap's setAppleLoading(true) has even committed a re-render.
  const inFlightRef = useRef(false);

  const onContinueWithApple = useCallback(async () => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    setAppleLoading(true);
    try {
      const result = await signInWithApple();
      console.log('[AuthNavigator] signInWithApple resolved', { status: result.status });
      if (result.status === 'error' && result.message) {
        Alert.alert(t('error.signInTitle'), result.message);
      }
      // 'signed-in' / 'needs-profile' -> the shared session/profile state
      // (already updated by signInWithApple itself before it returned)
      // drives App.tsx's routing reactively. 'cancelled' -> stay put.
    } finally {
      // Always release, on every path — success, cancel, or error.
      setAppleLoading(false);
      inFlightRef.current = false;
    }
  }, [signInWithApple, t]);

  return { appleLoading, onContinueWithApple };
}

function WelcomeContainer({ navigation }: { navigation: { navigate: (screen: 'SignUp' | 'SignIn') => void } }) {
  const { appleLoading, onContinueWithApple } = useAppleSignIn();
  return (
    <WelcomeScreen
      appleLoading={appleLoading}
      onSignUpWithEmail={() => navigation.navigate('SignUp')}
      onLogIn={() => navigation.navigate('SignIn')}
      onContinueWithApple={onContinueWithApple}
    />
  );
}

function SignInContainer({
  navigation,
}: {
  navigation: { navigate: (screen: 'ForgotPassword') => void; goBack: () => void };
}) {
  const { appleLoading, onContinueWithApple } = useAppleSignIn();
  return (
    <SignInScreen
      onBack={() => navigation.goBack()}
      onForgotPassword={() => navigation.navigate('ForgotPassword')}
      appleLoading={appleLoading}
      onContinueWithApple={onContinueWithApple}
    />
  );
}

export function AuthNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Welcome">
        {({ navigation }) => <WelcomeContainer navigation={navigation} />}
      </Stack.Screen>
      <Stack.Screen name="SignIn">
        {({ navigation }) => <SignInContainer navigation={navigation} />}
      </Stack.Screen>
      <Stack.Screen name="SignUp">
        {({ navigation }) => <SignUpScreen onBack={() => navigation.goBack()} />}
      </Stack.Screen>
      <Stack.Screen name="ForgotPassword">
        {({ navigation }) => <ForgotPasswordScreen onBack={() => navigation.goBack()} />}
      </Stack.Screen>
    </Stack.Navigator>
  );
}
