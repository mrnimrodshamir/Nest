import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TextInput,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft } from 'phosphor-react-native';
import { theme, typography, spacing } from '@/theme';
import { FormField } from '@/components/FormField';
import { PrimaryButton } from '@/components/PrimaryButton';
import { Checkbox } from '@/components/Checkbox';
import { OnboardingChildrenEditor, type OnboardingChild } from '@/components/OnboardingChildrenEditor';
import { LEGAL_URLS } from '@/constants/legal';
import { isValidEmail, isValidPassword, isNonEmpty } from '@/utils/validation';
import { useAuth, type RegistrationStage } from '@/hooks/useAuth';
import { useFormDraft } from '@/hooks/useFormDraft';

interface SignUpScreenProps {
  onBack: () => void;
}

interface DraftFields {
  fullName: string;
  email: string;
  children: OnboardingChild[];
}

const EMPTY_CHILD: OnboardingChild = { name: '', birthdate: null };

const STAGE_LABELS: Record<RegistrationStage, string> = {
  'creating-account': 'Creating your account…',
  'uploading-photo': 'Uploading your photo…',
  'saving-profile': 'Almost done…',
};

/** One continuous screen — the minimum needed to start discovering: name,
 *  email/password, and the first child's name + age. Photo and phone are
 *  optional and collected later from Edit Profile, never here. */
export function SignUpScreen({ onBack }: SignUpScreenProps) {
  const { register } = useAuth();
  const { initialDraft, save, clear } = useFormDraft<DraftFields>('signup');

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [children, setChildren] = useState<OnboardingChild[]>([EMPTY_CHILD]);
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [childErrors, setChildErrors] = useState<Array<{ name?: string; birthdate?: string }>>([]);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [stage, setStage] = useState<RegistrationStage | null>(null);

  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);
  // Synchronous guard alongside isSubmitting (state) — a fast double-tap
  // can fire two onPress handlers before the disabled-button re-render
  // commits, same class of gap as the Apple sign-in double-tap issue.
  const inFlightRef = useRef(false);

  // Restore a draft left behind by a closed app or dropped connection.
  useEffect(() => {
    if (!initialDraft) return;
    setFullName(initialDraft.fullName);
    setEmail(initialDraft.email);
    if (initialDraft.children?.length) setChildren(initialDraft.children);
  }, [initialDraft]);

  useEffect(() => {
    save({ fullName, email, children });
  }, [fullName, email, children, save]);

  const handleSubmit = async () => {
    if (inFlightRef.current) return; // synchronous — checked before any state/render
    const errors: Record<string, string> = {};
    if (!isNonEmpty(fullName)) errors.fullName = 'Enter your name';
    if (!isValidEmail(email)) errors.email = 'Enter a valid email address';
    if (!isValidPassword(password)) errors.password = 'Password must be at least 8 characters';
    const perChild = children.map((child) => {
      const e: { name?: string; birthdate?: string } = {};
      if (!isNonEmpty(child.name)) e.name = "Enter your child's name";
      if (!child.birthdate) e.birthdate = "Select your child's date of birth";
      return e;
    });
    if (!acceptedTerms) errors.terms = 'Please accept the Terms and Privacy Policy to continue';
    setFieldErrors(errors);
    setChildErrors(perChild);
    if (Object.keys(errors).length > 0 || perChild.some((e) => e.name || e.birthdate)) return;

    inFlightRef.current = true;
    setFormError(null);
    setIsSubmitting(true);
    try {
      const result = await register(
        {
          fullName: fullName.trim(),
          email: email.trim(),
          password,
          children: children.map((child) => ({ name: child.name.trim(), birthdate: child.birthdate! })),
        },
        setStage,
      );

      if (result.status === 'error') {
        setFormError(result.message); // form data preserved — nothing is cleared here
      } else {
        clear();
        // 'signed-in' — the root navigator swaps to the main app automatically
        // once useAuth's shared session/profile state updates. No email
        // confirmation step: registration goes straight into the app.
      }
    } finally {
      setIsSubmitting(false);
      setStage(null);
      inFlightRef.current = false;
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Pressable onPress={onBack} style={styles.backButton} accessibilityLabel="Back">
            <ArrowLeft size={20} color={theme.text.primary} />
          </Pressable>

          <Text style={styles.title}>Create your account</Text>
          <Text style={styles.subtitle}>Just enough to get you discovering activities nearby.</Text>

          <View style={styles.form}>
            <FormField
              label="Your name"
              placeholder="Your name"
              value={fullName}
              onChangeText={setFullName}
              autoCapitalize="words"
              textContentType="name"
              autoComplete="name"
              returnKeyType="next"
              onSubmitEditing={() => emailRef.current?.focus()}
              error={fieldErrors.fullName}
            />
            <FormField
              ref={emailRef}
              label="Email"
              placeholder="you@example.com"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              textContentType="username"
              autoComplete="email"
              returnKeyType="next"
              onSubmitEditing={() => passwordRef.current?.focus()}
              error={fieldErrors.email}
            />
            <FormField
              ref={passwordRef}
              label="Password"
              placeholder="At least 8 characters"
              value={password}
              onChangeText={setPassword}
              isPassword
              textContentType="newPassword"
              autoComplete="password-new"
              returnKeyType="done"
              error={fieldErrors.password}
            />

            <OnboardingChildrenEditor children={children} onChange={setChildren} errors={childErrors} />

            <Checkbox checked={acceptedTerms} onToggle={() => setAcceptedTerms((v) => !v)}>
              I agree to Momzi's{' '}
              <Text style={styles.legalLink} onPress={() => Linking.openURL(LEGAL_URLS.terms)}>
                Terms of Service
              </Text>{' '}
              and{' '}
              <Text style={styles.legalLink} onPress={() => Linking.openURL(LEGAL_URLS.privacy)}>
                Privacy Policy
              </Text>
            </Checkbox>
            {fieldErrors.terms && <Text style={styles.termsError}>{fieldErrors.terms}</Text>}

            {formError && <Text style={styles.formError}>{formError}</Text>}

            <PrimaryButton
              label={isSubmitting ? (stage ? STAGE_LABELS[stage] : 'Please wait…') : 'Create account'}
              onPress={handleSubmit}
              loading={isSubmitting}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background.app },
  flex: { flex: 1 },
  content: { flexGrow: 1, paddingHorizontal: spacing['2xl'], paddingTop: spacing.md, paddingBottom: spacing['3xl'] },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.background.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xl,
  },
  title: { ...typography.title1, color: theme.text.primary, marginTop: spacing.xl },
  subtitle: { ...typography.body, color: theme.text.secondary, marginBottom: spacing.xl },
  form: { gap: spacing.lg },
  legalLink: { color: theme.text.accent, fontFamily: typography.bodyMedium.fontFamily },
  termsError: { ...typography.caption, color: theme.semantic.danger },
  formError: { ...typography.footnote, color: theme.semantic.danger, textAlign: 'center' },
});
