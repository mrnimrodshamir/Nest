import React, { useEffect, useState } from 'react';
import { Linking, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { CalendarPlus, GoogleLogo, X } from 'phosphor-react-native';
import { addEventToAppleCalendar } from '@/lib/eventCalendar';
import { buildGoogleEventCalendarUrl, validateCalendarEvent, type CalendarEventInfo } from '@/utils/eventCalendar';
import { radius, spacing, theme, typography } from '@/theme';
import { useI18n } from '@/i18n';

export function AddEventToCalendarSheet({ visible, event, onDismiss }: {
  visible: boolean;
  event: CalendarEventInfo;
  onDismiss: () => void;
}) {
  const { t, isRTL } = useI18n();
  const [status, setStatus] = useState<string | null>(null);
  useEffect(() => { if (visible) setStatus(validateCalendarEvent(event)); }, [visible, event]);

  const handleApple = async () => {
    const result = await addEventToAppleCalendar(event);
    setStatus(result.success ? t('calendar.added') : result.error ?? t('calendar.addError'));
    if (result.success) setTimeout(onDismiss, 900);
  };
  const handleGoogle = async () => {
    const url = buildGoogleEventCalendarUrl(event);
    if (!url) { setStatus(validateCalendarEvent(event)); return; }
    try { await Linking.openURL(url); onDismiss(); } catch { setStatus(t('calendar.googleError')); }
  };
  const disabled = Boolean(validateCalendarEvent(event));

  return <Modal visible={visible} transparent animationType="slide" onRequestClose={onDismiss}>
    <View style={styles.overlay}><View style={styles.sheet}>
      <View style={styles.header}><Text style={[styles.title, isRTL && styles.rtlText]}>{t('calendar.title')}</Text><Pressable onPress={onDismiss} style={styles.close} accessibilityLabel={t('common.close', { what: t('calendar.title') })}><X size={16} color={theme.text.secondary} /></Pressable></View>
      {status ? <Text style={styles.status}>{status}</Text> : null}
      <Pressable disabled={disabled} style={[styles.option, disabled && styles.disabled]} onPress={handleApple}><CalendarPlus size={20} color={theme.brand.primary} weight="fill" /><Text style={styles.label}>{t('calendar.addApple')}</Text></Pressable>
      <Pressable disabled={disabled} style={[styles.option, disabled && styles.disabled]} onPress={handleGoogle}><GoogleLogo size={20} color={theme.brand.accent} weight="fill" /><Text style={styles.label}>{t('calendar.addGoogle')}</Text></Pressable>
      <Pressable style={styles.notNow} onPress={onDismiss}><Text style={styles.notNowLabel}>{t('calendar.notNow')}</Text></Pressable>
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
  rtlText: { textAlign: 'right', writingDirection: 'rtl' },
});
