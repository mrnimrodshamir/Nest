import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Plus, Trash } from 'phosphor-react-native';
import { theme, typography, spacing, radius } from '@/theme';
import { FormField } from '@/components/FormField';
import { DateOfBirthField } from '@/components/DateOfBirthField';
import { useI18n } from '@/i18n';

export interface OnboardingChild {
  name: string;
  birthdate: string | null;
}

export interface OnboardingChildErrors {
  name?: string;
  birthdate?: string;
}

interface OnboardingChildrenEditorProps {
  children: OnboardingChild[];
  onChange: (children: OnboardingChild[]) => void;
  errors?: OnboardingChildErrors[];
}

/** Add-one-or-more-children editor shared by every signup path (email,
 *  Apple) — compact per-child cards, never several huge repeated forms.
 *  At least one child is always required; the last remaining card can't be
 *  removed. Adding/removing never touches sibling cards' already-entered
 *  data. */
export function OnboardingChildrenEditor({ children, onChange, errors }: OnboardingChildrenEditorProps) {
  const { t } = useI18n();
  const updateChild = (index: number, patch: Partial<OnboardingChild>) => {
    onChange(children.map((child, i) => (i === index ? { ...child, ...patch } : child)));
  };

  const addChild = () => {
    onChange([...children, { name: '', birthdate: null }]);
  };

  const removeChild = (index: number) => {
    if (children.length <= 1) return; // the last child can never be removed
    onChange(children.filter((_, i) => i !== index));
  };

  return (
    <View style={styles.container}>
      {children.map((child, index) => (
        <View key={index} style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>{t('onboarding.childNumber', { count: index + 1 })}</Text>
            {children.length > 1 && (
              <Pressable
                onPress={() => removeChild(index)}
                accessibilityLabel={t('onboarding.removeChild', { count: index + 1 })}
                hitSlop={10}
                style={styles.removeButton}
              >
                <Trash size={16} color={theme.semantic.danger} />
                <Text style={styles.removeLabel}>{t('onboarding.remove')}</Text>
              </Pressable>
            )}
          </View>

          <FormField
            label={t('onboarding.childName')}
            placeholder={t('onboarding.childNamePlaceholder')}
            value={child.name}
            onChangeText={(name) => updateChild(index, { name })}
            autoCapitalize="words"
            error={errors?.[index]?.name}
          />
          <DateOfBirthField
            label={t('onboarding.childBirthdate')}
            value={child.birthdate}
            onChange={(birthdate) => updateChild(index, { birthdate })}
          />
          {errors?.[index]?.birthdate && <Text style={styles.dobError}>{errors[index].birthdate}</Text>}
        </View>
      ))}

      <Pressable onPress={addChild} style={styles.addButton} accessibilityRole="button">
        <Plus size={16} color={theme.text.accent} weight="bold" />
        <Text style={styles.addLabel}>{t('onboarding.addChild')}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.md },
  card: {
    backgroundColor: theme.background.surfaceAlt,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardTitle: { ...typography.footnote, color: theme.text.secondary, fontFamily: typography.bodyMedium.fontFamily },
  removeButton: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 32 },
  removeLabel: { ...typography.caption, color: theme.semantic.danger },
  dobError: { ...typography.caption, color: theme.semantic.danger },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: theme.border.strong,
    borderStyle: 'dashed',
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    minHeight: 48,
  },
  addLabel: { ...typography.bodyMedium, color: theme.text.accent },
});
