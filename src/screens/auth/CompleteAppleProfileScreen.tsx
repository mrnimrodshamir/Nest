import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft } from 'phosphor-react-native';
import { theme, typography, spacing } from '@/theme';
import { FormField } from '@/components/FormField';
import { PrimaryButton } from '@/components/PrimaryButton';
import { AvatarPicker } from '@/components/AvatarPicker';
import { Checkbox } from '@/components/Checkbox';
import { YearsMonthsPicker } from '@/components/YearsMonthsPicker';
import { StepProgress } from '@/components/StepProgress';
import { isValidPhone, isNonEmpty } from '@/utils/validation';
import { yearsMonthsToBirthdate } from '@/utils/babyAge';
import { useAuth, type AppleProfileInput, type RegistrationStage } from '@/hooks/useAuth';
import { useFormDraft } from '@/hooks/useFormDraft';

interface CompleteAppleProfileScreenProps {
  input: AppleProfileInput;
}

interface DraftFields {
  phone: string;
  babyName: string;
  babyYears: number;
  babyMonths: number;
}

const STAGE_LABELS: Record<RegistrationStage, string> = {
  'creating-account': 'Setting up your account…',
  'uploading-photo': 'Uploading your photo…',
  'saving-profile': 'Almost done…',
};

const TOTAL_STEPS = 2;

export function CompleteAppleProfileScreen({ input }: CompleteAppleProfileScreenProps) {
  const { completeAppleProfile } = useAuth();
  const { initialDraft, save, clear } = useFormDraft<DraftFields>('apple-profile');

  const [step, setStep] = useState(0);
  const [phone, setPhone] = useState('');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [babyName, setBabyName] = useState('');
  const [babyYears, setBabyYears] = useState(0);
  const [babyMonths, setBabyMonths] = useState(3);
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [stage, setStage] = useState<RegistrationStage | null>(null);

  useEffect(() => {
    if (!initialDraft) return;
    setPhone(initialDraft.phone);
    setBabyName(initialDraft.babyName);
    setBabyYears(initialDraft.babyYears);
    setBabyMonths(initialDraft.babyMonths);
  }, [initialDraft]);

  useEffect(() => {
    save({ phone, babyName, babyYears, babyMonths });
  }, [phone, babyName, babyYears, babyMonths, save]);

  const goNext = () => {
    const errors: Record<string, string> = {};
    if (!isValidPhone(phone)) errors.phone = 'Enter a valid phone number';
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;
    setStep(1);
  };

  const handleSubmit = async () => {
    const errors: Record<string, string> = {};
    if (!isNonEmpty(babyName)) errors.babyName = "Enter your baby's name";
    if (!acceptedTerms) errors.terms = 'Please accept the Terms and Privacy Policy to continue';
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setFormError(null);
    setIsSubmitting(true);
    const result = await completeAppleProfile(
      {
        ...input,
        phone: phone.trim(),
        babyName: babyName.trim(),
        babyBirthdate: yearsMonthsToBirthdate(babyYears, babyMonths),
        photoUri,
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
          {step === 1 && (
            <Pressable onPress={() => setStep(0)} style={styles.backButton} accessibilityLabel="Back">
              <ArrowLeft size={20} color={theme.text.primary} />
            </Pressable>
          )}

          <StepProgress step={step} total={TOTAL_STEPS} />

          {step === 0 && (
            <>
              <Text style={styles.title}>Almost there</Text>
              <Text style={styles.subtitle}>
                {input.fallbackFullName ? `Welcome, ${input.fallbackFullName}. ` : ''}
                Just a couple more details to finish setting up your account.
              </Text>

              <AvatarPicker uri={photoUri} onChange={setPhotoUri} />

              <View style={styles.form}>
                <FormField
                  label="Phone number"
                  placeholder="Private — only you can see this"
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
                  error={fieldErrors.phone}
                />
                <PrimaryButton label="Continue" onPress={goNext} />
              </View>
            </>
          )}

          {step === 1 && (
            <>
              <Text style={styles.title}>Tell us about your baby</Text>
              <Text style={styles.subtitle}>Helps you find the right activities</Text>

              <View style={styles.form}>
                <FormField
                  label="Baby's name"
                  placeholder="Baby's name"
                  value={babyName}
                  onChangeText={setBabyName}
                  autoCapitalize="words"
                  error={fieldErrors.babyName}
                />

                <View style={styles.ageField}>
                  <Text style={styles.ageLabel}>Baby's age</Text>
                  <YearsMonthsPicker years={babyYears} months={babyMonths} onChange={(y, m) => {
                    setBabyYears(y);
                    setBabyMonths(m);
                  }} />
                </View>

                <Checkbox checked={acceptedTerms} onToggle={() => setAcceptedTerms((v) => !v)}>
                  I agree to Momzi's Terms of Service and Privacy Policy
                </Checkbox>
                {fieldErrors.terms && <Text style={styles.termsError}>{fieldErrors.terms}</Text>}

                {formError && <Text style={styles.formError}>{formError}</Text>}

                <PrimaryButton
                  label={isSubmitting ? (stage ? STAGE_LABELS[stage] : 'Please wait…') : 'Finish'}
                  onPress={handleSubmit}
                  loading={isSubmitting}
                />
              </View>
            </>
          )}
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
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.background.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  title: { ...typography.title1, color: theme.text.primary, marginTop: spacing.lg },
  subtitle: { ...typography.body, color: theme.text.secondary, marginBottom: spacing.xl },
  form: { gap: spacing.lg, marginTop: spacing.xl },
  ageField: { gap: spacing.sm },
  ageLabel: { ...typography.footnote, color: theme.text.secondary },
  termsError: { ...typography.caption, color: theme.semantic.danger },
  formError: { ...typography.footnote, color: theme.semantic.danger, textAlign: 'center' },
});
