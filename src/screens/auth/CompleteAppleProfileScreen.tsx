import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { theme, typography, spacing } from '@/theme';
import { FormField } from '@/components/FormField';
import { PrimaryButton } from '@/components/PrimaryButton';
import { Checkbox } from '@/components/Checkbox';
import { YearsMonthsPicker } from '@/components/YearsMonthsPicker';
import { isNonEmpty } from '@/utils/validation';
import { yearsMonthsToBirthdate } from '@/utils/babyAge';
import { LEGAL_URLS } from '@/constants/legal';
import { useAuth, type AppleProfileInput, type RegistrationStage } from '@/hooks/useAuth';
import { useFormDraft } from '@/hooks/useFormDraft';

interface CompleteAppleProfileScreenProps {
  input: AppleProfileInput;
}

interface DraftFields {
  childName: string;
  childYears: number;
  childMonths: number;
}

const STAGE_LABELS: Record<RegistrationStage, string> = {
  'creating-account': 'Setting up your account…',
  'uploading-photo': 'Uploading your photo…',
  'saving-profile': 'Almost done…',
};

/** One continuous screen — the only thing still needed after Apple already
 *  handled identity is the child Momzi matches activities against. Phone
 *  and photo are optional and collected later from Edit Profile. */
export function CompleteAppleProfileScreen({ input }: CompleteAppleProfileScreenProps) {
  const { completeAppleProfile } = useAuth();
  const { initialDraft, save, clear } = useFormDraft<DraftFields>('apple-profile');

  const [childName, setChildName] = useState('');
  const [childYears, setChildYears] = useState(0);
  const [childMonths, setChildMonths] = useState(3);
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [stage, setStage] = useState<RegistrationStage | null>(null);

  useEffect(() => {
    if (!initialDraft) return;
    setChildName(initialDraft.childName);
    setChildYears(initialDraft.childYears);
    setChildMonths(initialDraft.childMonths);
  }, [initialDraft]);

  useEffect(() => {
    save({ childName, childYears, childMonths });
  }, [childName, childYears, childMonths, save]);

  const handleSubmit = async () => {
    if (isSubmitting) return; // debounce duplicate submissions
    const errors: Record<string, string> = {};
    if (!isNonEmpty(childName)) errors.childName = "Enter your child's name";
    if (!acceptedTerms) errors.terms = 'Please accept the Terms and Privacy Policy to continue';
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setFormError(null);
    setIsSubmitting(true);
    const result = await completeAppleProfile(
      {
        ...input,
        childName: childName.trim(),
        childBirthdate: yearsMonthsToBirthdate(childYears, childMonths),
      },
      setStage,
    );
    setIsSubmitting(false);
    setStage(null);
    if (result) setFormError(result);
    else clear();
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
            <FormField
              label="Child's name"
              placeholder="Child's name"
              value={childName}
              onChangeText={setChildName}
              autoCapitalize="words"
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
  ageField: { gap: spacing.sm },
  ageLabel: { ...typography.footnote, color: theme.text.secondary },
  legalLink: { color: theme.text.accent, fontFamily: typography.bodyMedium.fontFamily },
  termsError: { ...typography.caption, color: theme.semantic.danger },
  formError: { ...typography.footnote, color: theme.semantic.danger, textAlign: 'center' },
});
