import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Check } from 'phosphor-react-native';
import { theme, typography, spacing, radius } from '@/theme';
import { formatBabyAge, birthdateToMonths } from '@/utils/babyAge';
import type { Child } from '@/types/child';

interface ComingWithSelectorProps {
  label?: string;
  children: Child[];
  /** Empty array means "coming alone". */
  selectedChildIds: string[];
  onChange: (childIds: string[]) => void;
}

/** "Who are you coming with?" — shared by activity creation (the host's
 *  own attendance) and joining (a participant's attendance). Alone is
 *  always an explicit, single-tap choice, never just "nothing selected". */
export function ComingWithSelector({ label = 'Who are you coming with?', children, selectedChildIds, onChange }: ComingWithSelectorProps) {
  const comingAlone = selectedChildIds.length === 0;

  const toggleChild = (childId: string) => {
    onChange(
      selectedChildIds.includes(childId)
        ? selectedChildIds.filter((id) => id !== childId)
        : [...selectedChildIds, childId],
    );
  };

  if (children.length === 0) {
    // No children on the profile yet — attendance is unambiguously alone,
    // nothing to choose. (Onboarding requires at least one child, so this
    // only happens for accounts created before that was enforced.)
    return null;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.options}>
        <Pressable
          style={[styles.option, comingAlone && styles.optionSelected]}
          onPress={() => onChange([])}
          accessibilityRole="radio"
          accessibilityState={{ checked: comingAlone }}
          accessibilityLabel="Coming alone"
        >
          <View style={[styles.checkbox, comingAlone && styles.checkboxSelected]}>
            {comingAlone && <Check size={12} color={theme.text.inverse} weight="bold" />}
          </View>
          <Text style={[styles.optionLabel, comingAlone && styles.optionLabelSelected]}>Coming alone</Text>
        </Pressable>

        {children.map((child) => {
          const selected = selectedChildIds.includes(child.id);
          const age = child.birthdate ? formatBabyAge(birthdateToMonths(child.birthdate)) : null;
          return (
            <Pressable
              key={child.id}
              style={[styles.option, selected && styles.optionSelected]}
              onPress={() => toggleChild(child.id)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: selected }}
              accessibilityLabel={age ? `${child.name}, ${age}` : child.name}
            >
              <View style={[styles.checkbox, selected && styles.checkboxSelected]}>
                {selected && <Check size={12} color={theme.text.inverse} weight="bold" />}
              </View>
              <Text style={[styles.optionLabel, selected && styles.optionLabelSelected]} numberOfLines={1}>
                {child.name}
                {age ? `, ${age}` : ''}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.sm },
  label: { ...typography.footnote, color: theme.text.secondary },
  options: { gap: spacing.sm },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: theme.background.surface,
    borderWidth: 1,
    borderColor: theme.border.default,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    minHeight: 48,
  },
  optionSelected: { borderColor: theme.brand.primary, backgroundColor: theme.brand.primaryTint },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: radius.sm,
    borderWidth: 1.5,
    borderColor: theme.border.strong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxSelected: { backgroundColor: theme.brand.primary, borderColor: theme.brand.primary },
  optionLabel: { ...typography.body, color: theme.text.primary, flexShrink: 1 },
  optionLabelSelected: { fontFamily: typography.bodyMedium.fontFamily },
});
