import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { theme, typography, spacing } from '@/theme';
import { StaticPrimaryButton } from '@/components/StaticPrimaryButton';
import { Checkbox } from '@/components/Checkbox';
import { OnboardingChildrenEditor, type OnboardingChild } from '@/components/OnboardingChildrenEditor';
import { isNonEmpty } from '@/utils/validation';
import { LEGAL_URLS } from '@/constants/legal';
import { useAuth, type AppleProfileInput, type RegistrationStage } from '@/hooks/useAuth';
import { useFormDraft } from '@/hooks/useFormDraft';
import { APP_NAME } from '@/constants/brand';
import { AvatarPicker } from '@/components/AvatarPicker';
import { FamilyProfileFields, type FamilyProfileDraft } from '@/components/FamilyProfileFields';
import { useI18n } from '@/i18n';
import { track } from '@/lib/analytics';

interface CompleteAppleProfileScreenProps {
  input: AppleProfileInput;
}

interface DraftFields {
  familyProfile: FamilyProfileDraft;
  children: OnboardingChild[];
}

const EMPTY_CHILD: OnboardingChild = { name: '', birthdate: null };

/** Apple establishes authentication only. This shared setup collects the same
 * family profile as email signup; Apple-supplied name/email are initial values,
 * never permanent truth. */
export function CompleteAppleProfileScreen({ input }: CompleteAppleProfileScreenProps) {
  const { completeAppleProfile, profile } = useAuth();
  const { initialDraft, save, clear } = useFormDraft<DraftFields>('apple-profile');
  const { t } = useI18n();

  const [familyProfile, setFamilyProfile] = useState<FamilyProfileDraft>({
    displayName: input.displayName ?? input.fallbackFullName ?? profile?.displayName ?? '',
    parentRole: input.parentRole ?? null,
    birthdate: input.birthdate ?? null,
    neighborhood: input.neighborhood ?? '',
    occupation: input.occupation ?? '',
    bio: input.bio ?? '',
  });
  const [children, setChildren] = useState<OnboardingChild[]>([EMPTY_CHILD]);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [childErrors, setChildErrors] = useState<Array<{ name?: string; birthdate?: string }>>([]);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [stage, setStage] = useState<RegistrationStage | null>(null);
  const inFlightRef = useRef(false);

  useEffect(() => {
    track('onboarding_started', { onboarding_method: 'apple' });
  }, []);

  useEffect(() => {
    if (!initialDraft) return;
    if (initialDraft.familyProfile) setFamilyProfile(initialDraft.familyProfile);
    if (initialDraft.children?.length) setChildren(initialDraft.children);
  }, [initialDraft]);

  useEffect(() => {
    save({ familyProfile, children });
  }, [familyProfile, children, save]);

  const handleSubmit = async () => {
    if (inFlightRef.current) return; // synchronous — checked before any state/render
    const errors: Record<string, string> = {};
    if (!isNonEmpty(familyProfile.displayName)) errors.displayName = t('onboarding.nameRequired');
    if (!familyProfile.parentRole) errors.parentRole = t('onboarding.roleRequired');
    if (!familyProfile.birthdate) errors.birthdate = t('onboarding.birthdateRequired');
    if (!isNonEmpty(familyProfile.neighborhood)) errors.neighborhood = t('onboarding.areaRequired');
    const perChild = children.map((child) => {
      const e: { name?: string; birthdate?: string } = {};
      if (!isNonEmpty(child.name)) e.name = t('onboarding.childNameRequired');
      if (!child.birthdate) e.birthdate = t('onboarding.childBirthdateRequired');
      return e;
    });
    if (!acceptedTerms) errors.terms = t('onboarding.acceptTermsRequired');
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
          displayName: familyProfile.displayName.trim(),
          photoUri,
          parentRole: familyProfile.parentRole,
          birthdate: familyProfile.birthdate,
          neighborhood: familyProfile.neighborhood.trim(),
          occupation: familyProfile.occupation,
          bio: familyProfile.bio,
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
          <Text style={styles.title}>{t('onboarding.profileTitle')}</Text>
          <Text style={styles.subtitle}>{t('onboarding.profileSubtitle')}</Text>

          <View style={styles.form}>
            <AvatarPicker uri={photoUri} onChange={setPhotoUri} />
            <FamilyProfileFields value={familyProfile} onChange={setFamilyProfile} errors={fieldErrors} />
            <OnboardingChildrenEditor children={children} onChange={setChildren} errors={childErrors} />

            <Checkbox checked={acceptedTerms} onToggle={() => setAcceptedTerms((v) => !v)}>
              {t('onboarding.agreePrefix', { appName: APP_NAME })}{' '}
              <Text style={styles.legalLink} onPress={() => Linking.openURL(LEGAL_URLS.terms)}>
                {t('profile.terms')}
              </Text>{' '}
              {t('onboarding.and')}{' '}
              <Text style={styles.legalLink} onPress={() => Linking.openURL(LEGAL_URLS.privacy)}>
                {t('profile.privacy')}
              </Text>
            </Checkbox>
            {fieldErrors.terms && <Text style={styles.termsError}>{fieldErrors.terms}</Text>}

            {formError && <Text style={styles.formError}>{formError}</Text>}

            <StaticPrimaryButton
              label={isSubmitting ? stageLabel(stage, t) : t('onboarding.continue')}
              onPress={handleSubmit}
              loading={isSubmitting}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function stageLabel(stage: RegistrationStage | null, t: ReturnType<typeof useI18n>['t']): string {
  if (stage === 'creating-account') return t('onboarding.stage.setup');
  if (stage === 'uploading-photo') return t('onboarding.stage.photo');
  if (stage === 'saving-profile') return t('onboarding.stage.save');
  return t('onboarding.wait');
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
