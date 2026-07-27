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
import { isValidEmail, isValidPassword, isValidPhone, isNonEmpty } from '@/utils/validation';
import { yearsMonthsToBirthdate } from '@/utils/babyAge';
import { useAuth, type RegistrationStage } from '@/hooks/useAuth';
import { useFormDraft } from '@/hooks/useFormDraft';

interface SignUpScreenProps {
  onBack: () => void;
}

interface DraftFields {
  fullName: string;
  email: string;
  phone: string;
  babyName: string;
  babyYears: number;
  babyMonths: number;
}

const STAGE_LABELS: Record<RegistrationStage, string> = {
  'creating-account': 'Creating your account…',
  'uploading-photo': 'Uploading your photo…',
  'saving-profile': 'Almost done…',
};

const TOTAL_STEPS = 3;

export function SignUpScreen({ onBack }: SignUpScreenProps) {
  const { register } = useAuth();
  const { initialDraft, save, clear } = useFormDraft<DraftFields>('signup');

  const [step, setStep] = useState(0);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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

  // Restore a draft left behind by a closed app or dropped connection.
  useEffect(() => {
    if (!initialDraft) return;
    setFullName(initialDraft.fullName);
    setEmail(initialDraft.email);
    setPhone(initialDraft.phone);
    setBabyName(initialDraft.babyName);
    setBabyYears(initialDraft.babyYears);
    setBabyMonths(initialDraft.babyMonths);
  }, [initialDraft]);

  useEffect(() => {
    save({ fullName, email, phone, babyName, babyYears, babyMonths });
  }, [fullName, email, phone, babyName, babyYears, babyMonths, save]);

  const goNext = () => {
    const errors: Record<string, string> = {};
    if (step === 0) {
      if (!isNonEmpty(fullName)) errors.fullName = 'Enter your full name';
      if (!isValidEmail(email)) errors.email = 'Enter a valid email address';
      if (!isValidPassword(password)) errors.password = 'Password must be at least 8 characters';
    } else if (step === 1) {
      if (!isValidPhone(phone)) errors.phone = 'Enter a valid phone number';
    }
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;
    setStep((s) => Math.min(s + 1, TOTAL_STEPS - 1));
  };

  const goBack = () => {
    if (step === 0) onBack();
    else setStep((s) => s - 1);
  };

  const handleSubmit = async () => {
    const errors: Record<string, string> = {};
    if (!isNonEmpty(babyName)) errors.babyName = "Enter your baby's name";
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
          <Pressable onPress={goBack} style={styles.backButton} accessibilityLabel="Back">
            <ArrowLeft size={20} color={theme.text.primary} />
          </Pressable>

          <StepProgress step={step} total={TOTAL_STEPS} />

          {step === 0 && (
            <>
              <Text style={styles.title}>Create your account</Text>
              <Text style={styles.subtitle}>Let's start with the basics</Text>

              <AvatarPicker uri={photoUri} onChange={setPhotoUri} />

              <View style={styles.form}>
                <FormField
                  label="Full name"
                  placeholder="Your name"
                  value={fullName}
                  onChangeText={setFullName}
                  autoCapitalize="words"
                  error={fieldErrors.fullName}
                />
                <FormField
                  label="Email"
                  placeholder="you@example.com"
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                  error={fieldErrors.email}
                />
                <FormField
                  label="Password"
                  placeholder="At least 8 characters"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  error={fieldErrors.password}
                />
                <PrimaryButton label="Continue" onPress={goNext} />
              </View>
            </>
          )}

          {step === 1 && (
            <>
              <Text style={styles.title}>Your phone number</Text>
              <Text style={styles.subtitle}>Private — only you can see this</Text>

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

          {step === 2 && (
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
                  label={isSubmitting ? (stage ? STAGE_LABELS[stage] : 'Please wait…') : 'Create account'}
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
    marginBottom: spacing.xl,
  },
  title: { ...typography.title1, color: theme.text.primary, marginTop: spacing.xl },
  subtitle: { ...typography.body, color: theme.text.secondary, marginBottom: spacing.xl },
  form: { gap: spacing.lg, marginTop: spacing.xl },
  ageField: { gap: spacing.sm },
  ageLabel: { ...typography.footnote, color: theme.text.secondary },
  termsError: { ...typography.caption, color: theme.semantic.danger },
  formError: { ...typography.footnote, color: theme.semantic.danger, textAlign: 'center' },
});
