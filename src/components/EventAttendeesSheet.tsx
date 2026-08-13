import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { X } from 'phosphor-react-native';
import { PersonCard } from '@/components/PersonCard';
import { useI18n } from '@/i18n';
import type { EventAttendee } from '@/hooks/useEventRsvp';
import { radius, spacing, theme, typography } from '@/theme';
import { parentRoleKey } from '@/utils/parentRole';

export function EventAttendeesSheet({
  visible,
  attendees,
  onDismiss,
  onOpenProfile,
}: {
  visible: boolean;
  attendees: readonly EventAttendee[];
  onDismiss: () => void;
  onOpenProfile?: (userId: string) => void;
}) {
  const { t } = useI18n();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onDismiss}>
      <Pressable style={styles.overlay} onPress={onDismiss}>
        <Pressable style={styles.sheet} onPress={(event) => event.stopPropagation()}>
          <View style={styles.header}>
            <Text style={styles.title}>{t('event.attendance.title')}</Text>
            <Pressable
              onPress={onDismiss}
              accessibilityRole="button"
              accessibilityLabel={t('common.close', { what: t('event.attendance.title') })}
              hitSlop={10}
              style={styles.close}
            >
              <X size={20} color={theme.text.primary} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.list} keyboardShouldPersistTaps="handled">
            {attendees.map((attendee) => (
              <PersonCard
                key={attendee.userId}
                size="row"
                name={attendee.ageYears == null ? attendee.displayName : `${attendee.displayName}, ${attendee.ageYears}`}
                avatarUrl={attendee.avatarUrl}
                subtitle={attendeeContext(attendee, t)}
                onPress={onOpenProfile ? () => { onDismiss(); onOpenProfile(attendee.userId); } : undefined}
                accessibilityLabel={t('event.attendance.openProfile', { name: attendee.displayName })}
              />
            ))}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function attendeeContext(attendee: EventAttendee, t: ReturnType<typeof useI18n>['t']): string | undefined {
  const parts: string[] = [];
  if (attendee.childCount > 0) {
    parts.push(t('profile.roleOfCount', { role: t(parentRoleKey(attendee.parentRole)), count: attendee.childCount }));
  } else {
    parts.push(t(parentRoleKey(attendee.parentRole)));
  }
  const neighborhood = attendee.neighborhood?.trim();
  if (neighborhood) parts.push(neighborhood);
  return parts.join(' · ') || undefined;
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.35)' },
  sheet: {
    maxHeight: '72%',
    minHeight: 220,
    backgroundColor: theme.background.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingBottom: spacing.xl,
  },
  header: { minHeight: 58, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.border.default },
  title: { ...typography.headline, color: theme.text.primary },
  close: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  list: { padding: spacing.lg, gap: spacing.md },
});
