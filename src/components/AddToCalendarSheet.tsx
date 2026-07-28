import React, { useState } from 'react';
import { View, Text, Pressable, Modal, StyleSheet, Linking } from 'react-native';
import { CalendarPlus, GoogleLogo, X } from 'phosphor-react-native';
import { theme, typography, spacing, radius } from '@/theme';
import { addActivityToAppleCalendar, buildGoogleCalendarUrl } from '@/lib/activityCalendar';

export interface CalendarActivityInfo {
  id: string;
  title: string;
  description: string;
  startsAt: Date;
  durationMinutes: number;
  locationName: string;
}

interface AddToCalendarSheetProps {
  visible: boolean;
  activity: CalendarActivityInfo;
  onDismiss: () => void;
}

export function AddToCalendarSheet({ visible, activity, onDismiss }: AddToCalendarSheetProps) {
  const [status, setStatus] = useState<string | null>(null);

  const handleApple = async () => {
    const result = await addActivityToAppleCalendar(activity);
    setStatus(result.success ? 'Added to your calendar ✓' : result.error ?? 'Could not add to calendar');
    if (result.success) setTimeout(onDismiss, 900);
  };

  const handleGoogle = async () => {
    await Linking.openURL(buildGoogleCalendarUrl(activity));
    onDismiss();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onDismiss}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>Add to your calendar?</Text>
            <Pressable onPress={onDismiss} style={styles.closeButton} hitSlop={8} accessibilityLabel="Close">
              <X size={16} color={theme.text.secondary} />
            </Pressable>
          </View>

          {status && <Text style={styles.status}>{status}</Text>}

          <Pressable style={styles.option} onPress={handleApple}>
            <CalendarPlus size={20} color={theme.brand.primary} weight="fill" />
            <Text style={styles.optionLabel}>Add to Apple Calendar</Text>
          </Pressable>

          <Pressable style={styles.option} onPress={handleGoogle}>
            <GoogleLogo size={20} color={theme.brand.accent} weight="fill" />
            <Text style={styles.optionLabel}>Add to Google Calendar</Text>
          </Pressable>

          <Pressable style={styles.notNow} onPress={onDismiss}>
            <Text style={styles.notNowLabel}>Not now</Text>
          </Pressable>
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
    gap: spacing.sm,
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md },
  title: { ...typography.title3, color: theme.text.primary },
  closeButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: theme.background.app,
    alignItems: 'center',
    justifyContent: 'center',
  },
  status: { ...typography.footnote, color: theme.text.accent, marginBottom: spacing.sm },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: theme.background.app,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  optionLabel: { ...typography.bodyMedium, color: theme.text.primary },
  notNow: { alignItems: 'center', paddingVertical: spacing.md, marginTop: spacing.xs },
  notNowLabel: { ...typography.bodyMedium, color: theme.text.secondary },
});
