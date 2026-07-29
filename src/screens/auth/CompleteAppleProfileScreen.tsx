import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { theme, typography, spacing } from '@/theme';
import { PrimaryButton } from '@/components/PrimaryButton';
import { Checkbox } from '@/components/Checkbox';
import { OnboardingChildrenEditor, type OnboardingChild } from '@/components/OnboardingChildrenEditor';
import { isNonEmpty } from '@/utils/validation';
import { LEGAL_URLS } from '@/constants/legal';
import { useAuth, type AppleProfileInput, type RegistrationStage } from '@/hooks/useAuth';
import { useFormDraft } from '@/hooks/useFormDraft';

interface CompleteAppleProfileScreenProps {
  input: AppleProfileInput;
}

interface DraftFields {
  children: OnboardingChild[];
}

const STAGE_LABELS: Record<RegistrationStage, string> = {
  'creating-account': 'Setting up your account…',
  'uploading-photo': 'Uploading your photo…',
  'saving-profile': 'Almost done…',
};

const EMPTY_CHILD: OnboardingChild = { name: '', birthdate: null };

/** One continuous screen — the only thing still needed after Apple already
 *  handled identity is who Momzi matches activities against: one or more
 *  children. Phone and photo are optional and collected later from Edit
 *  Profile. */
export function CompleteAppleProfileScreen({ input }: CompleteAppleProfileScreenProps) {
  const { completeAppleProfile } = useAuth();
  const { initialDraft, save, clear } = useFormDraft<DraftFields>('apple-profile');

  const [children, setChildren] = useState<OnboardingChild[]>([EMPTY_CHILD]);
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [childErrors, setChildErrors] = useState<Array<{ name?: string; birthdate?: string }>>([]);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [stage, setStage] = useState<RegistrationStage | null>(null);
  const inFlightRef = useRef(false);

  useEffect(() => {
    if (!initialDraft?.children?.length) return;
    setChildren(initialDraft.children);
  }, [initialDraft]);

  useEffect(() => {
    save({ children });
  }, [children, save]);

  const handleSubmit = async () => {
    if (inFlightRef.current) return; // synchronous — checked before any state/render
    const errors: Record<string, string> = {};
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
      const result = await completeAppleProfile(
        {
          ...input,
          children: children.map((child) => ({ name: child.name.trim(), birthdate: child.birthdate! })),
        },
        setStage,
      );
      if (result) setFormError(result);
      else clear();
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
          <Text style={styles.title}>
            {input.fallbackFullName ? `Welcome, ${input.fallbackFullName}` : 'Almost there'}
          </Text>
          <Text style={styles.subtitle}>One last thing — who are you meeting other moms for?</Text>

          <View style={styles.form}>
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
              label={isSubmitting ? (stage ? STAGE_LABELS[stage] : 'Please wait…') : 'Start discovering'}
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
  title: { ...typography.title1, color: theme.text.primary, marginTop: spacing.lg },
  subtitle: { ...typography.body, color: theme.text.secondary, marginBottom: spacing.xl },
  form: { gap: spacing.lg, marginTop: spacing.xl },
  legalLink: { color: theme.text.accent, fontFamily: typography.bodyMedium.fontFamily },
  termsError: { ...typography.caption, color: theme.semantic.danger },
  formError: { ...typography.footnote, color: theme.semantic.danger, textAlign: 'center' },
});
