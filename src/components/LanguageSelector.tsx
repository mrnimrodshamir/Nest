import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Check, Translate } from 'phosphor-react-native';
import { theme, typography, spacing, radius } from '@/theme';
import { useI18n } from '@/i18n';
import type { AppLocale } from '@/i18n';

/** Language choice, shown in Profile.
 *
 *  A two-option segmented control. Each option is labelled in its OWN script —
 *  someone who has landed in the wrong language must be able to find their way
 *  out without reading the language they can't read.
 *
 *  LAYOUT: each option is `flex: 1` inside a fixed-width row, and every label is
 *  `numberOfLines={1}`. The previous version nested a `flex: 1` column inside a
 *  row that could collapse to zero width, which made Text wrap at every
 *  character — the "C / h / d / ev / ic / e" column seen on device. A single
 *  flex level plus a hard line cap makes that impossible.
 *
 *  There is deliberately no "Match device" option. English is the default for
 *  everyone; Hebrew is an explicit choice. Exposing device-locale mechanics is
 *  developer-facing and was the source of the broken label. */
export function LanguageSelector() {
  const { t, locale, setPreference, needsRestart } = useI18n();

  const options: Array<{ key: AppLocale; label: string }> = [
    { key: 'en', label: t('language.english') },
    { key: 'he', label: t('language.hebrew') },
  ];

  return (
    <View>
      <View style={styles.sectionHeader}>
        <Translate size={16} color={theme.text.secondary} />
        <Text style={styles.sectionHeaderLabel}>{t('language.title')}</Text>
      </View>

      <View style={styles.segmented} accessibilityRole="radiogroup">
        {options.map((option) => {
          const selected = locale === option.key;
          return (
            <Pressable
              key={option.key}
              style={[styles.segment, selected && styles.segmentSelected]}
              onPress={() => setPreference(option.key)}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
              accessibilityLabel={option.label}
            >
              {selected ? <Check size={15} color={theme.brand.primary} weight="bold" /> : null}
              <Text
                style={[styles.segmentLabel, selected && styles.segmentLabelSelected]}
                numberOfLines={1}
              >
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {needsRestart ? <Text style={styles.restartNote}>{t('language.restartHint')}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  sectionHeaderLabel: { ...typography.footnote, color: theme.text.secondary },
  segmented: {
    flexDirection: 'row',
    // Full width so the two flex children always have real space to divide.
    alignSelf: 'stretch',
    padding: 3,
    borderRadius: radius.md,
    backgroundColor: theme.background.app,
    gap: 3,
  },
  segment: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    // Comfortably above the 44pt minimum target.
    minHeight: 46,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.sm,
  },
  segmentSelected: {
    backgroundColor: theme.background.surface,
    borderWidth: 1,
    borderColor: theme.brand.primary,
  },
  segmentLabel: { ...typography.bodyMedium, color: theme.text.secondary },
  segmentLabelSelected: { color: theme.text.primary, fontWeight: '700' },
  restartNote: {
    ...typography.caption,
    color: theme.text.muted,
    marginTop: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
});
