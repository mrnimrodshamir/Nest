import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet, Platform } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { theme, typography, spacing, radius } from '@/theme';
import { birthdateToMonths, formatBabyAge } from '@/utils/babyAge';

interface DateOfBirthFieldProps {
  label?: string;
  /** ISO date (YYYY-MM-DD), or null before the mother has picked one. */
  value: string | null;
  onChange: (isoDate: string) => void;
  /** Oldest supported child age — defaults to 6 years back, matching the
   *  app's existing YearsMonthsPicker maxYears default. */
  maxYearsAgo?: number;
}

function toIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Birthdate picker with the resulting age shown immediately underneath —
 *  the source of truth is always date_of_birth, never a manually
 *  maintained years/months pair, so the displayed age stays correct
 *  automatically as time passes. */
export function DateOfBirthField({ label = "Child's date of birth", value, onChange, maxYearsAgo = 6 }: DateOfBirthFieldProps) {
  const [showPicker, setShowPicker] = useState(false);
  const today = new Date();
  const minimumDate = new Date(today.getFullYear() - maxYearsAgo, today.getMonth(), today.getDate());
  const selectedDate = value ? new Date(value) : today;

  const formatted = value
    ? selectedDate.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })
    : 'Select date of birth';

  const ageLabel = value ? formatBabyAge(birthdateToMonths(value)) : null;

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <Pressable style={styles.field} onPress={() => setShowPicker(true)} accessibilityRole="button">
        <Text style={value ? styles.value : styles.placeholder}>{formatted}</Text>
      </Pressable>
      {ageLabel && (
        <Text style={styles.ageLabel}>
          Age: <Text style={styles.ageValue}>{ageLabel}</Text>
        </Text>
      )}

      {showPicker && (
        <DateTimePicker
          value={selectedDate}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          minimumDate={minimumDate}
          maximumDate={today}
          onChange={(event, selected) => {
            if (Platform.OS !== 'ios') setShowPicker(false);
            if (event.type === 'dismissed') return;
            if (selected) onChange(toIsoDate(selected));
          }}
        />
      )}

      {showPicker && Platform.OS === 'ios' && (
        <Pressable style={styles.doneButton} onPress={() => setShowPicker(false)} hitSlop={8}>
          <Text style={styles.doneLabel}>Done</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.xs },
  label: { ...typography.footnote, color: theme.text.secondary },
  field: {
    backgroundColor: theme.background.surface,
    borderWidth: 1,
    borderColor: theme.border.default,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    minHeight: 48,
    justifyContent: 'center',
  },
  value: { ...typography.body, color: theme.text.primary },
  placeholder: { ...typography.body, color: theme.text.muted },
  ageLabel: { ...typography.footnote, color: theme.text.secondary },
  ageValue: { fontFamily: typography.bodyMedium.fontFamily, color: theme.text.accent },
  doneButton: { alignSelf: 'flex-end', paddingVertical: spacing.sm, paddingHorizontal: spacing.md, minHeight: 44, justifyContent: 'center' },
  doneLabel: { ...typography.bodyMedium, color: theme.text.accent },
});
