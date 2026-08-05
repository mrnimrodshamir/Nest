import React, { useEffect, useState } from 'react';
import { Linking, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { CalendarPlus, GoogleLogo, X } from 'phosphor-react-native';
import { addEventToAppleCalendar } from '@/lib/eventCalendar';
import { buildGoogleEventCalendarUrl, validateCalendarEvent, type CalendarEventInfo } from '@/utils/eventCalendar';
import { radius, spacing, theme, typography } from '@/theme';

export function AddEventToCalendarSheet({ visible, event, onDismiss }: {
  visible: boolean;
  event: CalendarEventInfo;
  onDismiss: () => void;
}) {
  const [status, setStatus] = useState<string | null>(null);
  useEffect(() => { if (visible) setStatus(validateCalendarEvent(event)); }, [visible, event]);

  const handleApple = async () => {
    const result = await addEventToAppleCalendar(event);
    setStatus(result.success ? 'Added to your calendar' : result.error ?? 'Could not add to calendar');
    if (result.success) setTimeout(onDismiss, 900);
  };
  const handleGoogle = async () => {
    const url = buildGoogleEventCalendarUrl(event);
    if (!url) { setStatus(validateCalendarEvent(event)); return; }
    try { await Linking.openURL(url); onDismiss(); } catch { setStatus('Could not open Google Calendar'); }
  };
  const disabled = Boolean(validateCalendarEvent(event));

  return <Modal visible={visible} transparent animationType="slide" onRequestClose={onDismiss}>
    <View style={styles.overlay}><View style={styles.sheet}>
      <View style={styles.header}><Text style={styles.title}>Add to your calendar?</Text><Pressable onPress={onDismiss} style={styles.close} accessibilityLabel="Close"><X size={16} color={theme.text.secondary} /></Pressable></View>
      {status ? <Text style={styles.status}>{status}</Text> : null}
      <Pressable disabled={disabled} style={[styles.option, disabled && styles.disabled]} onPress={handleApple}><CalendarPlus size={20} color={theme.brand.primary} weight="fill" /><Text style={styles.label}>Add to Apple Calendar</Text></Pressable>
      <Pressable disabled={disabled} style={[styles.option, disabled && styles.disabled]} onPress={handleGoogle}><GoogleLogo size={20} color={theme.brand.accent} weight="fill" /><Text style={styles.label}>Add to Google Calendar</Text></Pressable>
      <Pressable style={styles.notNow} onPress={onDismiss}><Text style={styles.notNowLabel}>Not now</Text></Pressable>
    </View></View>
  </Modal>;
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(43,43,40,0.4)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: theme.background.surface, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: spacing.xl, paddingBottom: spacing['3xl'], gap: spacing.sm },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md },
  title: { ...typography.title3, color: theme.text.primary },
  close: { width: 28, height: 28, borderRadius: 14, backgroundColor: theme.background.app, alignItems: 'center', justifyContent: 'center' },
  status: { ...typography.footnote, color: theme.text.secondary, marginBottom: spacing.sm },
  option: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: theme.background.app, borderRadius: radius.md, paddingVertical: spacing.md, paddingHorizontal: spacing.lg },
  disabled: { opacity: 0.45 },
  label: { ...typography.bodyMedium, color: theme.text.primary },
  notNow: { alignItems: 'center', paddingVertical: spacing.md, marginTop: spacing.xs },
  notNowLabel: { ...typography.bodyMedium, color: theme.text.secondary },
});
