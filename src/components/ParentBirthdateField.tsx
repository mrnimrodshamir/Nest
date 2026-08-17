import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet, Platform } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { theme, typography, spacing, radius } from '@/theme';
import { activeDateLocale } from '@/i18n/core';
import { useI18n } from '@/i18n';
import { parentAgeYears } from '@/utils/parentAge';

/** Youngest and oldest ages an account may plausibly claim. Mirrors the bounds
 *  parentAgeYears() enforces, so the picker cannot produce a value the display
 *  layer would then refuse to show. */
const MIN_AGE = 13;
const MAX_AGE = 120;

interface ParentBirthdateFieldProps {
  /** ISO date (YYYY-MM-DD), or null when the parent has not set one. */
  value: string | null;
  onChange: (isoDate: string | null) => void;
  optional?: boolean;
}

function toIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** The parent's own date of birth: optional, private, and never shown to
 *  anyone else.
 *
 *  This is deliberately NOT the child DateOfBirthField. That one is bounded to
 *  the last six years and renders a baby age ("14 months"), both wrong for an
 *  adult. Only the derived whole-year age is ever published — see parentAge.ts
 *  for why the date itself stays private.
 */
export function ParentBirthdateField({ value, onChange, optional = true }: ParentBirthdateFieldProps) {
  const { t } = useI18n();
  const [showPicker, setShowPicker] = useState(false);

  const today = new Date();
  // maximumDate/minimumDate make an impossible date unpickable in the first
  // place; parentAgeYears still validates, because stored data can predate
  // this screen or arrive from elsewhere.
  const maximumDate = new Date(today.getFullYear() - MIN_AGE, today.getMonth(), today.getDate());
  const minimumDate = new Date(today.getFullYear() - MAX_AGE, today.getMonth(), today.getDate());
  const selectedDate = value ? new Date(value) : maximumDate;

  const age = parentAgeYears(value, today);
  const formatted = value
    ? selectedDate.toLocaleDateString(activeDateLocale(), { year: 'numeric', month: 'long', day: 'numeric' })
    : t('profile.birthdate.placeholder');

  return (
    <View style={styles.container}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>{t('profile.birthdate.label')}</Text>
        {optional ? <Text style={styles.optional}>{t('common.optional')}</Text> : null}
      </View>

      <Pressable
        style={styles.field}
        onPress={() => setShowPicker((open) => !open)}
        accessibilityRole="button"
        accessibilityLabel={t('profile.birthdate.label')}
      >
        <Text style={value ? styles.value : styles.placeholder} numberOfLines={1}>
          {formatted}
        </Text>
      </Pressable>

      <Text style={styles.hint}>
        {age === null ? t('profile.birthdate.hint') : t('profile.birthdate.shows', { age })}
      </Text>

      {showPicker && (
        <>
          <DateTimePicker
            value={selectedDate}
            mode="date"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            minimumDate={minimumDate}
            maximumDate={maximumDate}
            onChange={(event, selected) => {
              if (Platform.OS !== 'ios') setShowPicker(false);
              if (event.type === 'dismissed') return;
              if (selected) onChange(toIsoDate(selected));
            }}
          />
          <View style={styles.pickerActions}>
            {value ? (
              <Pressable onPress={() => { onChange(null); setShowPicker(false); }} hitSlop={8} style={styles.action}>
                <Text style={styles.clearLabel}>{t('common.clear')}</Text>
              </Pressable>
            ) : null}
            <Pressable onPress={() => setShowPicker(false)} hitSlop={8} style={styles.action}>
              <Text style={styles.doneLabel}>{t('common.done')}</Text>
            </Pressable>
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.xs },
  // Wraps rather than truncating: Hebrew labels run longer than English and
  // must stay readable on a 375pt screen.
  labelRow: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.xs, flexWrap: 'wrap' },
  label: { ...typography.footnote, color: theme.text.secondary },
  optional: { ...typography.caption, color: theme.text.muted },
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
  hint: { ...typography.caption, color: theme.text.muted },
  pickerActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.md },
  action: { paddingVertical: spacing.sm, paddingHorizontal: spacing.md, minHeight: 44, justifyContent: 'center' },
  clearLabel: { ...typography.bodyMedium, color: theme.text.secondary },
  doneLabel: { ...typography.bodyMedium, color: theme.text.accent },
});
