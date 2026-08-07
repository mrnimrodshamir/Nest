import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Check, Translate } from 'phosphor-react-native';
import { theme, typography, spacing, radius } from '@/theme';
import { useI18n } from '@/i18n';
import type { LocalePreference } from '@/i18n';

/** Language choice, shown in Profile. Each option is labelled in its OWN
 *  script -- someone who has landed in the wrong language has to be able to
 *  find their way out without reading the language they can't read. */
export function LanguageSelector() {
  const { t, preference, setPreference, needsRestart } = useI18n();

  const options: Array<{ key: LocalePreference; label: string; hint?: string }> = [
    { key: 'system', label: t('language.system'), hint: t('language.systemHint') },
    { key: 'en', label: t('language.english') },
    { key: 'he', label: t('language.hebrew') },
  ];

  return (
    <View>
      <View style={styles.sectionHeader}>
        <Translate size={16} color={theme.text.secondary} />
        <Text style={styles.sectionHeaderLabel}>{t('language.title')}</Text>
      </View>

      <View style={styles.card} accessibilityRole="radiogroup">
        {options.map((option, index) => {
          const selected = preference === option.key;
          return (
            <Pressable
              key={option.key}
              style={[styles.row, index < options.length - 1 && styles.rowDivider]}
              onPress={() => setPreference(option.key)}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
              accessibilityLabel={option.label}
              accessibilityHint={option.hint}
            >
              <View style={styles.labels}>
                {/* Language names are content, not UI chrome: they keep their
                    own script's direction regardless of the active locale. */}
                <Text style={styles.label}>{option.label}</Text>
                {option.hint ? <Text style={styles.hint}>{option.hint}</Text> : null}
              </View>
              {selected ? <Check size={18} color={theme.brand.primary} weight="bold" /> : null}
            </Pressable>
          );
        })}
      </View>

      {needsRestart ? (
        // forceRTL only takes effect on the next launch, so say so rather than
        // leaving the user with a half-mirrored screen and no explanation.
        <Text style={styles.restartNote}>{t('language.restartHint')}</Text>
      ) : null}
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
  card: {
    backgroundColor: theme.background.surface,
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    // 48 keeps every option comfortably above the 44pt minimum target.
    minHeight: 48,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    gap: spacing.md,
  },
  rowDivider: { borderBottomWidth: StyleSheet.hairlineWidth, borderColor: theme.border.default },
  labels: { flex: 1 },
  label: { ...typography.bodyMedium, color: theme.text.primary },
  hint: { ...typography.caption, color: theme.text.muted, marginTop: 2 },
  restartNote: {
    ...typography.caption,
    color: theme.text.muted,
    marginTop: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
});
