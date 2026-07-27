import React, { useState } from 'react';
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

export function AuthNavigator() {
  const { signInWithApple } = useAuth();
  const [appleLoading, setAppleLoading] = useState(false);

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Welcome">
        {({ navigation }) => (
          <WelcomeScreen
            appleLoading={appleLoading}
            onSignUpWithEmail={() => navigation.navigate('SignUp')}
            onLogIn={() => navigation.navigate('SignIn')}
            onContinueWithApple={async () => {
              setAppleLoading(true);
              const result = await signInWithApple();
              setAppleLoading(false);

              if (result.status === 'needs-profile') {
                navigation.navigate('CompleteAppleProfile', { input: result.input });
              }
              // 'signed-in' -> session updates and the root navigator swaps
              // to the main app automatically. 'cancelled'/'error' -> stay
              // on Welcome; a toast-level error surface can come later.
            }}
          />
        )}
      </Stack.Screen>
      <Stack.Screen name="SignIn">
        {({ navigation }) => (
          <SignInScreen
            onBack={() => navigation.goBack()}
            onForgotPassword={() => navigation.navigate('ForgotPassword')}
          />
        )}
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
