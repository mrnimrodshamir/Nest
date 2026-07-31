import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Pressable, Modal, StyleSheet } from 'react-native';
import { X } from 'phosphor-react-native';
import { theme, typography, spacing, radius } from '@/theme';
import { PrimaryButton } from '@/components/PrimaryButton';
import { ComingWithSelector } from '@/components/ComingWithSelector';
import type { Child } from '@/types/child';

interface JoinActivitySheetProps {
  visible: boolean;
  activityTitle: string;
  ageHint: string | null;
  children: Child[];
  isSubmitting: boolean;
  onConfirm: (childIds: string[]) => void;
  onDismiss: () => void;
}

/** Shown before joining — "who are you coming with" is asked once, up
 *  front, rather than as a separate step after the fact. Also doubles as
 *  the age-eligibility nudge that used to be a plain Alert. */
export function JoinActivitySheet({
  visible,
  activityTitle,
  ageHint,
  children,
  isSubmitting,
  onConfirm,
  onDismiss,
}: JoinActivitySheetProps) {
  const [selectedChildIds, setSelectedChildIds] = useState<string[]>([]);
  // Auto-select the default (or only) child each time the sheet opens —
  // never default to "coming alone" when a default child exists. Guarded
  // by a ref so it fires once per open (handles children still loading
  // when the sheet first appears) without overriding a manual change the
  // mother makes afterward.
  const didAutoSelect = useRef(false);
  useEffect(() => {
    if (!visible) {
      didAutoSelect.current = false;
      return;
    }
    if (didAutoSelect.current) return;
    if (children.length === 0) return;
    didAutoSelect.current = true;
    const defaultChild = children.find((c) => c.isDefault) ?? children[0];
    setSelectedChildIds([defaultChild.id]);
  }, [visible, children]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onDismiss}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title} numberOfLines={1}>{activityTitle}</Text>
            <Pressable onPress={onDismiss} style={styles.closeButton} hitSlop={8} accessibilityLabel="Close">
              <X size={16} color={theme.text.secondary} />
            </Pressable>
          </View>
          {ageHint && <Text style={styles.ageHint}>{ageHint}</Text>}

          <ComingWithSelector children={children} selectedChildIds={selectedChildIds} onChange={setSelectedChildIds} />

          <View style={styles.actions}>
            <PrimaryButton
              label="Join activity"
              onPress={() => onConfirm(selectedChildIds)}
              loading={isSubmitting}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(43,43,40,0.4)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: theme.background.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.xl,
    paddingBottom: spacing['3xl'],
    gap: spacing.lg,
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  title: { ...typography.title3, color: theme.text.primary, flex: 1 },
  closeButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: theme.background.app,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ageHint: { ...typography.footnote, color: theme.text.secondary },
  actions: { marginTop: spacing.xs },
});
