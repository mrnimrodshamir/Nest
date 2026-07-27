import React from 'react';
import { View, Text, Pressable, Modal, StyleSheet } from 'react-native';
import { BellRinging } from 'phosphor-react-native';
import { theme, typography, spacing, radius } from '@/theme';

interface NotificationPermissionSheetProps {
  visible: boolean;
  onEnable: () => void;
  onDismiss: () => void;
}

/** Branded explanation shown once, right before the system permission
 *  prompt — never the prompt itself as a surprise. Only ever triggered by
 *  a first join or turning on reminders in settings. */
export function NotificationPermissionSheet({ visible, onEnable, onDismiss }: NotificationPermissionSheetProps) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onDismiss}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.iconCircle}>
            <BellRinging size={26} color={theme.brand.primary} weight="fill" />
          </View>
          <Text style={styles.title}>Never miss a moment</Text>
          <Text style={styles.body}>
            We'll remind you before activities start, and let you know if a host changes the time,
            location, or cancels. You're always in control in Profile → Notifications.
          </Text>

          <Pressable style={styles.enableButton} onPress={onEnable}>
            <Text style={styles.enableLabel}>Enable notifications</Text>
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
    alignItems: 'center',
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: radius.pill,
    backgroundColor: theme.brand.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  title: { ...typography.title3, color: theme.text.primary, marginBottom: spacing.sm },
  body: {
    ...typography.subhead,
    color: theme.text.secondary,
    textAlign: 'center',
    lineHeight: 21,
    marginBottom: spacing.xl,
  },
  enableButton: {
    backgroundColor: theme.brand.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing['2xl'],
    width: '100%',
    alignItems: 'center',
  },
  enableLabel: { ...typography.bodyMedium, color: theme.text.inverse },
  notNow: { paddingVertical: spacing.md },
  notNowLabel: { ...typography.bodyMedium, color: theme.text.secondary },
});
