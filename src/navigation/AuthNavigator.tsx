import React, { useCallback, useRef, useState } from 'react';
import { Alert } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { WelcomeScreen } from '@/screens/auth/WelcomeScreen';
import { SignInScreen } from '@/screens/auth/SignInScreen';
import { SignUpScreen } from '@/screens/auth/SignUpScreen';
import { ForgotPasswordScreen } from '@/screens/auth/ForgotPasswordScreen';
import { CompleteAppleProfileScreen } from '@/screens/auth/CompleteAppleProfileScreen';
import { useAuth, type AppleProfileInput } from '@/hooks/useAuth';

export type AuthStackParamList = {
  Welcome: undefined;
  SignIn: undefined;
  SignUp: undefined;
  ForgotPassword: undefined;
  CompleteAppleProfile: { input: AppleProfileInput };
};

const Stack = createNativeStackNavigator<AuthStackParamList>();

type AppleNavTarget = { navigate: (screen: 'CompleteAppleProfile', params: { input: AppleProfileInput }) => void };

/** Shared by every screen that offers "Continue with Apple" (Welcome and
 *  Sign In) so the loading/guard state and result handling stay identical
 *  regardless of where the button was tapped. */
function useAppleSignIn(navigation: AppleNavTarget) {
  const { signInWithApple } = useAuth();
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
      if (result.status === 'needs-profile') {
        navigation.navigate('CompleteAppleProfile', { input: result.input });
      } else if (result.status === 'error' && result.message) {
        Alert.alert("Couldn't sign in", result.message);
      }
      // 'signed-in' -> session updates and the root navigator swaps to the
      // main app automatically. 'cancelled' -> quietly stay put.
    } finally {
      // Always release, on every path — success, cancel, or error.
      setAppleLoading(false);
      inFlightRef.current = false;
    }
  }, [navigation, signInWithApple]);

  return { appleLoading, onContinueWithApple };
}

function WelcomeContainer({ navigation }: { navigation: AppleNavTarget & { navigate: (screen: 'SignUp' | 'SignIn') => void } }) {
  const { appleLoading, onContinueWithApple } = useAppleSignIn(navigation);
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
  navigation: AppleNavTarget & { navigate: (screen: 'ForgotPassword') => void; goBack: () => void };
}) {
  const { appleLoading, onContinueWithApple } = useAppleSignIn(navigation);
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
      <Stack.Screen name="CompleteAppleProfile">
        {({ route }) => <CompleteAppleProfileScreen input={route.params.input} />}
      </Stack.Screen>
    </Stack.Navigator>
  );
}
