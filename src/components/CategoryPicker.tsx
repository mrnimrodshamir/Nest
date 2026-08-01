import React from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { Check } from 'phosphor-react-native';
import { theme, typography, spacing, radius } from '@/theme';
import { CategoryArtwork } from '@/components/CategoryArtwork';
import { CATEGORY_LABELS } from '@/types/activity';
import type { ActivityCategory } from '@/types/activity';

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
            accessibilityLabel={CATEGORY_LABELS[category]}
          >
            <View style={[styles.thumb, isSelected && styles.thumbSelected]}>
              <CategoryArtwork category={category} variant="thumb" style={styles.thumbFill} />
              {isSelected && (
                <View style={styles.checkBadge}>
                  <Check size={12} color={theme.text.inverse} weight="bold" />
                </View>
              )}
            </View>
            <Text style={[styles.label, isSelected && styles.labelSelected]} numberOfLines={2}>
              {CATEGORY_LABELS[category]}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { gap: spacing.md, paddingRight: spacing.lg },
  item: { width: 76, alignItems: 'center', gap: spacing.xs },
  thumb: {
    // 4:3, matching the source art, instead of a square crop that throws
    // away a quarter of the image's width for no reason.
    width: 76,
    aspectRatio: 4 / 3,
    borderRadius: radius.lg,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'transparent',
    backgroundColor: theme.background.surface,
  },
  thumbSelected: { borderColor: theme.brand.primary },
  thumbFill: { flex: 1 },
  checkBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
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
