import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { FormField } from '@/components/FormField';
import { ParentBirthdateField } from '@/components/ParentBirthdateField';
import { useI18n } from '@/i18n';
import { radius, spacing, theme, typography } from '@/theme';
import { parentRoleKey, type ParentRole } from '@/utils/parentRole';
import { PROFILE_BIO_MAX_LENGTH } from '@/utils/publicFamilyProfile';

export interface FamilyProfileDraft {
  displayName: string;
  parentRole: ParentRole;
  birthdate: string | null;
  neighborhood: string;
  occupation: string;
  bio: string;
}

interface FamilyProfileFieldsProps {
  value: FamilyProfileDraft;
  onChange: (value: FamilyProfileDraft) => void;
  errors?: Partial<Record<'displayName' | 'parentRole' | 'birthdate' | 'neighborhood', string>>;
}

/** Shared profile setup used by email signup, Apple completion and compatible
 * profile forms. Role is always a caregiver's explicit selection. */
export function FamilyProfileFields({ value, onChange, errors = {} }: FamilyProfileFieldsProps) {
  const { t } = useI18n();
  const set = <K extends keyof FamilyProfileDraft>(key: K, next: FamilyProfileDraft[K]) =>
    onChange({ ...value, [key]: next });

  return (
    <View style={styles.container}>
      <FormField
        label={t('profile.yourName')}
        value={value.displayName}
        onChangeText={(text) => set('displayName', text)}
        autoCapitalize="words"
        textContentType="name"
        autoComplete="name"
        error={errors.displayName}
      />

      <View style={styles.fieldGroup}>
        <Text style={styles.label}>{t('profile.role.label')}</Text>
        <View style={styles.roleRow}>
          {(['mom', 'dad', 'parent'] as const).map((role) => {
            const selected = value.parentRole === role;
            return (
              <Pressable
                key={role}
                onPress={() => set('parentRole', role)}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                accessibilityLabel={t(parentRoleKey(role))}
                style={[styles.roleChip, selected && styles.roleChipSelected]}
              >
                <Text style={[styles.roleText, selected && styles.roleTextSelected]}>{t(parentRoleKey(role))}</Text>
              </Pressable>
            );
          })}
        </View>
        {errors.parentRole ? <Text style={styles.error}>{errors.parentRole}</Text> : null}
      </View>

      <View>
        <ParentBirthdateField value={value.birthdate} onChange={(date) => set('birthdate', date)} optional={false} />
        {errors.birthdate ? <Text style={styles.error}>{errors.birthdate}</Text> : null}
      </View>

      <FormField
        label={t('profile.neighborhood')}
        placeholder={t('onboarding.areaPlaceholder')}
        value={value.neighborhood}
        onChangeText={(text) => set('neighborhood', text)}
        autoCapitalize="words"
        error={errors.neighborhood}
      />

      <Text style={styles.optionalHeading}>{t('onboarding.optionalDetails')}</Text>
      <FormField
        label={t('profile.occupation')}
        value={value.occupation}
        onChangeText={(text) => set('occupation', text)}
        autoCapitalize="sentences"
      />
      <FormField
        label={t('profile.bio')}
        value={value.bio}
        onChangeText={(text) => set('bio', text)}
        multiline
        maxLength={PROFILE_BIO_MAX_LENGTH}
        style={styles.bioInput}
        textAlignVertical="top"
      />
      <View style={styles.bioMeta}>
        <Text style={styles.hint}>{t('profile.bioHint')}</Text>
        <Text style={styles.counter}>{t('profile.bioCount', { count: value.bio.length })}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.lg },
  fieldGroup: { gap: spacing.xs },
  label: { ...typography.footnote, color: theme.text.secondary },
  roleRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  roleChip: {
    minHeight: 44,
    minWidth: 76,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: theme.border.default,
    backgroundColor: theme.background.surface,
  },
  roleChipSelected: { borderColor: theme.brand.primary, backgroundColor: theme.brand.primaryTint },
  roleText: { ...typography.subhead, color: theme.text.secondary },
  roleTextSelected: { color: theme.brand.primary, fontWeight: '600' },
  optionalHeading: { ...typography.headline, color: theme.text.primary, marginTop: spacing.xs },
  bioInput: { minHeight: 104 },
  bioMeta: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm },
  hint: { ...typography.caption, color: theme.text.muted, flex: 1 },
  counter: { ...typography.caption, color: theme.text.muted },
  error: { ...typography.caption, color: theme.semantic.danger, marginTop: spacing.xs },
});
