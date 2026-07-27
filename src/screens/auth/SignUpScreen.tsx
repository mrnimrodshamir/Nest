import React, { useState } from 'react';
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
import { isValidEmail, isValidPassword, isValidPhone, isNonEmpty } from '@/utils/validation';
import { yearsMonthsToBirthdate } from '@/utils/babyAge';
import { useAuth } from '@/hooks/useAuth';

interface SignUpScreenProps {
  onBack: () => void;
}

interface FieldErrors {
  fullName?: string;
  email?: string;
  password?: string;
  phone?: string;
  babyName?: string;
  terms?: string;
}

export function SignUpScreen({ onBack }: SignUpScreenProps) {
  const { register } = useAuth();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [babyName, setBabyName] = useState('');
  const [babyYears, setBabyYears] = useState(0);
  const [babyMonths, setBabyMonths] = useState(3);
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    const errors: FieldErrors = {};
    if (!isNonEmpty(fullName)) errors.fullName = 'Enter your full name';
    if (!isValidEmail(email)) errors.email = 'Enter a valid email address';
    if (!isValidPassword(password)) errors.password = 'Password must be at least 8 characters';
    if (!isValidPhone(phone)) errors.phone = 'Enter a valid phone number';
    if (!isNonEmpty(babyName)) errors.babyName = "Enter your baby's name";
    if (!acceptedTerms) errors.terms = 'Please accept the Terms and Privacy Policy to continue';
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setFormError(null);
    setIsSubmitting(true);
    const result = await register({
      fullName: fullName.trim(),
      email: email.trim(),
      password,
      phone: phone.trim(),
      babyName: babyName.trim(),
      babyBirthdate: yearsMonthsToBirthdate(babyYears, babyMonths),
      photoUri,
    });
    setIsSubmitting(false);
    if (result) setFormError(result);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Pressable onPress={onBack} style={styles.backButton} accessibilityLabel="Back">
            <ArrowLeft size={20} color={theme.text.primary} />
          </Pressable>

          <Text style={styles.title}>Create your account</Text>
          <Text style={styles.subtitle}>Takes about a minute</Text>

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
            <FormField
              label="Phone number"
              placeholder="Private — only you can see this"
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              error={fieldErrors.phone}
            />

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

            <PrimaryButton label="Create account" onPress={handleSubmit} loading={isSubmitting} />
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
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.background.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xl,
  },
  title: { ...typography.title1, color: theme.text.primary },
  subtitle: { ...typography.body, color: theme.text.secondary, marginBottom: spacing.xl },
  form: { gap: spacing.lg, marginTop: spacing.xl },
  ageField: { gap: spacing.sm },
  ageLabel: { ...typography.footnote, color: theme.text.secondary },
  termsError: { ...typography.caption, color: theme.semantic.danger },
  formError: { ...typography.footnote, color: theme.semantic.danger, textAlign: 'center' },
});
