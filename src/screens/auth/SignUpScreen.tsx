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
import { ArrowLeft, EnvelopeSimple } from 'phosphor-react-native';
import { theme, typography, spacing, radius } from '@/theme';
import { FormField } from '@/components/FormField';
import { PrimaryButton } from '@/components/PrimaryButton';
import { Checkbox } from '@/components/Checkbox';
import { YearsMonthsPicker } from '@/components/YearsMonthsPicker';
import { LEGAL_URLS } from '@/constants/legal';
import { isValidEmail, isValidPassword, isNonEmpty } from '@/utils/validation';
import { yearsMonthsToBirthdate } from '@/utils/babyAge';
import { useAuth, type RegistrationStage } from '@/hooks/useAuth';
import { useFormDraft } from '@/hooks/useFormDraft';

interface SignUpScreenProps {
  onBack: () => void;
}

interface DraftFields {
  fullName: string;
  email: string;
  childName: string;
  childYears: number;
  childMonths: number;
}

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
  const [childName, setChildName] = useState('');
  const [childYears, setChildYears] = useState(0);
  const [childMonths, setChildMonths] = useState(3);
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [stage, setStage] = useState<RegistrationStage | null>(null);
  const [pendingConfirmationEmail, setPendingConfirmationEmail] = useState<string | null>(null);

  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);
  const childNameRef = useRef<TextInput>(null);

  // Restore a draft left behind by a closed app or dropped connection.
  useEffect(() => {
    if (!initialDraft) return;
    setFullName(initialDraft.fullName);
    setEmail(initialDraft.email);
    setChildName(initialDraft.childName);
    setChildYears(initialDraft.childYears);
    setChildMonths(initialDraft.childMonths);
  }, [initialDraft]);

  useEffect(() => {
    save({ fullName, email, childName, childYears, childMonths });
  }, [fullName, email, childName, childYears, childMonths, save]);

  const handleSubmit = async () => {
    if (isSubmitting) return; // debounce duplicate submissions
    const errors: Record<string, string> = {};
    if (!isNonEmpty(fullName)) errors.fullName = 'Enter your name';
    if (!isValidEmail(email)) errors.email = 'Enter a valid email address';
    if (!isValidPassword(password)) errors.password = 'Password must be at least 8 characters';
    if (!isNonEmpty(childName)) errors.childName = "Enter your child's name";
    if (!acceptedTerms) errors.terms = 'Please accept the Terms and Privacy Policy to continue';
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setFormError(null);
    setIsSubmitting(true);
    const result = await register(
      {
        fullName: fullName.trim(),
        email: email.trim(),
        password,
        childName: childName.trim(),
        childBirthdate: yearsMonthsToBirthdate(childYears, childMonths),
      },
      setStage,
    );
    setIsSubmitting(false);
    setStage(null);

    if (result.status === 'error') {
      setFormError(result.message); // form data preserved — nothing is cleared here
    } else if (result.status === 'needs-email-confirmation') {
      clear();
      setPendingConfirmationEmail(email.trim());
    } else {
      clear();
      // 'signed-in' — the root navigator swaps to the main app automatically
      // once useAuth's session/profile state updates.
    }
  };

  if (pendingConfirmationEmail) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.confirmContent}>
          <View style={styles.confirmIcon}>
            <EnvelopeSimple size={32} color={theme.brand.primary} weight="duotone" />
          </View>
          <Text style={styles.title}>Check your inbox</Text>
          <Text style={styles.subtitle}>
            We sent a confirmation link to{'\n'}
            <Text style={styles.confirmEmail}>{pendingConfirmationEmail}</Text>
            {'\n'}Tap it to finish setting up your account.
          </Text>
          <Pressable onPress={onBack} style={styles.backToLoginLink} hitSlop={8}>
            <Text style={styles.backToLoginLabel}>Back to login</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

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
              returnKeyType="next"
              onSubmitEditing={() => childNameRef.current?.focus()}
              error={fieldErrors.password}
            />

            <FormField
              ref={childNameRef}
              label="Child's name"
              placeholder="Child's name"
              value={childName}
              onChangeText={setChildName}
              autoCapitalize="words"
              returnKeyType="done"
              error={fieldErrors.childName}
            />
            <View style={styles.ageField}>
              <Text style={styles.ageLabel}>Child's age</Text>
              <YearsMonthsPicker
                years={childYears}
                months={childMonths}
                onChange={(y, m) => {
                  setChildYears(y);
                  setChildMonths(m);
                }}
              />
            </View>

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
  ageField: { gap: spacing.sm },
  ageLabel: { ...typography.footnote, color: theme.text.secondary },
  legalLink: { color: theme.text.accent, fontFamily: typography.bodyMedium.fontFamily },
  termsError: { ...typography.caption, color: theme.semantic.danger },
  formError: { ...typography.footnote, color: theme.semantic.danger, textAlign: 'center' },
  confirmContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing['3xl'],
  },
  confirmIcon: {
    width: 72,
    height: 72,
    borderRadius: radius.pill,
    backgroundColor: theme.brand.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xl,
  },
  confirmEmail: { fontFamily: typography.bodyMedium.fontFamily, color: theme.text.primary },
  backToLoginLink: { marginTop: spacing['2xl'], minHeight: 44, justifyContent: 'center' },
  backToLoginLabel: { ...typography.bodyMedium, color: theme.text.accent },
});
