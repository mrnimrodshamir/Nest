import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Minus, Plus } from 'phosphor-react-native';
import { theme, typography, spacing, radius } from '@/theme';
import { useI18n } from '@/i18n';

interface YearsMonthsPickerProps {
  years: number;
  months: number;
  onChange: (years: number, months: number) => void;
  maxYears?: number;
}

export function YearsMonthsPicker({
  years,
  months,
  onChange,
  maxYears = 6,
}: YearsMonthsPickerProps) {
  const { t } = useI18n();
  return (
    <View style={styles.row}>
      <Stepper
        label={t('activityForm.years')}
        value={years}
        min={0}
        max={maxYears}
        onChange={(next) => onChange(next, months)}
      />
      <Stepper
        label={t('activityForm.months')}
        value={months}
        min={0}
        max={11}
        onChange={(next) => onChange(years, next)}
      />
    </View>
  );
}

function Stepper({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (next: number) => void;
}) {
  const { t } = useI18n();
  return (
    <View style={styles.stepper}>
      <Text style={styles.stepperLabel}>{label}</Text>
      <View style={styles.stepperControls}>
        <Pressable
          style={styles.stepperButton}
          hitSlop={6}
          onPress={() => onChange(Math.max(min, value - 1))}
          accessibilityLabel={t('activityForm.decrease', { label })}
        >
          <Minus size={16} color={theme.text.primary} weight="bold" />
        </Pressable>
        <Text style={styles.stepperValue}>{value}</Text>
        <Pressable
          style={styles.stepperButton}
          hitSlop={6}
          onPress={() => onChange(Math.min(max, value + 1))}
          accessibilityLabel={t('activityForm.increase', { label })}
        >
          <Plus size={16} color={theme.text.primary} weight="bold" />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.lg },
  stepper: { flex: 1, alignItems: 'center', gap: spacing.xs },
  stepperLabel: { ...typography.footnote, color: theme.text.secondary },
  stepperControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.background.surface,
    borderWidth: 1,
    borderColor: theme.border.default,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    width: '100%',
  },
  stepperButton: {
    width: 32,
    height: 32,
    borderRadius: radius.pill,
    backgroundColor: theme.background.app,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperValue: { ...typography.headline, color: theme.text.primary, minWidth: 28, textAlign: 'center' },
});
