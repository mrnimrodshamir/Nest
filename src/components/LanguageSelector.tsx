import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Check, Translate } from 'phosphor-react-native';
import { theme, typography, spacing, radius } from '@/theme';
import { useI18n } from '@/i18n';
import type { AppLocale } from '@/i18n';

/** Language choice, shown in Profile.
 *
 *  A 2x2 GRID, not a four-across row. "Français" and "Русский" are long enough
 *  that four segments on a 375pt screen leave roughly 80pt each, which either
 *  truncates the label or — worse, and seen on device before — wraps it one
 *  character per line. Two columns give every label ~160pt, which fits all four
 *  comfortably in every language.
 *
 *  Each option is labelled in its OWN script. Someone who has landed in a
 *  language they cannot read must be able to find their way out without reading
 *  it, so 'Русский' is never rendered as 'Russian'.
 *
 *  LAYOUT RULES that keep the earlier bug dead: every cell is a fixed 48%
 *  width — not a nested flex that can collapse to zero — and every label is
 *  `numberOfLines={1}`. Vertical letter-stacking is structurally impossible.
 *
 *  There is deliberately no "Match device" option. English is the default for
 *  everyone; every other language is an explicit choice. */
export function LanguageSelector() {
  const { t, locale, setPreference, needsRestart } = useI18n();

  const options: Array<{ key: AppLocale; label: string }> = [
    { key: 'en', label: t('language.english') },
    { key: 'he', label: t('language.hebrew') },
    { key: 'fr', label: t('language.french') },
    { key: 'ru', label: t('language.russian') },
  ];

  return (
    <View>
      <View style={styles.sectionHeader}>
        <Translate size={16} color={theme.text.secondary} />
        <Text style={styles.sectionHeaderLabel}>{t('language.title')}</Text>
      </View>

      <View style={styles.grid} accessibilityRole="radiogroup">
        {options.map((option) => {
          const selected = locale === option.key;
          return (
            <Pressable
              key={option.key}
              style={[styles.cell, selected && styles.cellSelected]}
              onPress={() => setPreference(option.key)}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
              accessibilityLabel={option.label}
            >
              {selected ? <Check size={15} color={theme.brand.primary} weight="bold" /> : null}
              <Text
                style={[styles.cellLabel, selected && styles.cellLabelSelected]}
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
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    // Full width so the percentage-width cells resolve against real space.
    alignSelf: 'stretch',
    padding: 3,
    borderRadius: radius.md,
    backgroundColor: theme.background.app,
    gap: 3,
  },
  cell: {
    // A fixed share of the row rather than `flex: 1`: a percentage cannot
    // collapse to zero width the way a nested flex child can, and zero width is
    // what made labels wrap one character per line.
    width: '48%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    // Comfortably above the 44pt minimum target.
    minHeight: 46,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.sm,
  },
  cellSelected: {
    backgroundColor: theme.background.surface,
    borderWidth: 1,
    borderColor: theme.brand.primary,
  },
  cellLabel: { ...typography.bodyMedium, color: theme.text.secondary },
  cellLabelSelected: { color: theme.text.primary, fontWeight: '700' },
  restartNote: {
    ...typography.caption,
    color: theme.text.muted,
    marginTop: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
});
