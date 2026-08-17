import React from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { Check } from 'phosphor-react-native';
import { theme, typography, spacing, radius } from '@/theme';
import { CategoryArtwork } from '@/components/CategoryArtwork';
import { CoverFrame } from '@/components/CoverFrame';
import { CATEGORY_LABELS } from '@/types/activity';
import type { ActivityCategory } from '@/types/activity';
import { activityCategoryLabel, useI18n } from '@/i18n';

const ACTIVITY_TYPES = Object.keys(CATEGORY_LABELS) as ActivityCategory[];

interface CategoryPickerProps {
  selected: ActivityCategory;
  onSelect: (category: ActivityCategory) => void;
}

/** The activity-type selector — a horizontally scrollable row of
 *  illustrated image+label cards, not a long plain-text chip grid. Uses
 *  the same CategoryArtwork every other surface renders (Discovery cards,
 *  Activity Detail, Chats, this preview), so a category's visual identity
 *  is consistent everywhere the moment it's chosen. */
export function CategoryPicker({ selected, onSelect }: CategoryPickerProps) {
  const { t } = useI18n();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
    >
      {ACTIVITY_TYPES.map((category) => {
        const isSelected = category === selected;
        return (
          <Pressable
            key={category}
            onPress={() => onSelect(category)}
            style={styles.item}
            accessibilityRole="button"
            accessibilityState={{ selected: isSelected }}
            accessibilityLabel={activityCategoryLabel(category, t)}
          >
            <CoverFrame
              variant="thumb"
              radius={radius.lg}
              style={[styles.thumb, isSelected && styles.thumbSelected]}
            >
              <CategoryArtwork category={category} variant="thumb" surface="CategoryPicker" style={styles.thumbFill} />
              {isSelected && (
                <View style={styles.checkBadge}>
                  <Check size={12} color={theme.text.inverse} weight="bold" />
                </View>
              )}
            </CoverFrame>
            <Text style={[styles.label, isSelected && styles.labelSelected]} numberOfLines={2}>
              {activityCategoryLabel(category, t)}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { gap: spacing.md, paddingEnd: spacing.lg },
  item: { width: 76, alignItems: 'center', gap: spacing.xs },
  // Fixed width + selection border only; CoverFrame owns the 4:3 height
  // and clipping.
  thumb: {
    width: 76,
    borderWidth: 2,
    borderColor: 'transparent',
    backgroundColor: theme.background.surface,
  },
  thumbSelected: { borderColor: theme.brand.primary },
  thumbFill: { flex: 1 },
  checkBadge: {
    position: 'absolute',
    top: 4,
    end: 4,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: theme.brand.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    ...typography.caption,
    color: theme.text.secondary,
    textAlign: 'center',
  },
  labelSelected: { color: theme.text.primary, fontFamily: typography.bodyMedium.fontFamily },
});
