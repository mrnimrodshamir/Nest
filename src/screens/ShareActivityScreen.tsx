import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CheckCircle, WhatsappLogo, ShareNetwork, CalendarPlus } from 'phosphor-react-native';
import { theme, typography, spacing, radius } from '@/theme';
import { buildShareMessage, type ShareableActivity } from '@/utils/buildShareMessage';
import { AddToCalendarSheet } from '@/components/AddToCalendarSheet';
import { formatExactStartTime } from '@/utils/formatExactStartTime';
import { openNativeShare, openWhatsAppShare } from '@/lib/contentShare';
import { useI18n, textAlignForContent } from '@/i18n';

interface ShareActivityScreenProps {
  activity: ShareableActivity;
  onViewActivity: () => void;
}

export function ShareActivityScreen({ activity, onViewActivity }: ShareActivityScreenProps) {
  const message = buildShareMessage(activity);
  const { t, locale } = useI18n();
  const [showCalendarSheet, setShowCalendarSheet] = useState(false);

  const handleWhatsAppShare = async () => {
    await openWhatsAppShare(message);
  };

  const handleNativeShare = async () => {
    await openNativeShare(message);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.content}>
        <View style={styles.iconCircle}>
          <CheckCircle size={40} color={theme.brand.primary} weight="fill" />
        </View>
        <Text style={styles.title}>{t('share.live')}</Text>
        <Text style={styles.eyebrow}>{t('share.meetingAt')}</Text>
        {/* The venue name is user-chosen content, so it keeps its own script. */}
        <Text style={[styles.venue, textAlignForContent(activity.locationName, locale)]}>{['selected meeting point', 'meeting point'].includes(activity.locationName.trim().toLocaleLowerCase()) ? t('share.chosenPoint') : activity.locationName.trim()}</Text>
        <Text style={styles.timeLabel}>{formatExactStartTime(activity.startsAt.toISOString())}</Text>
        <Text style={styles.subtitle}>{t('share.invite')}</Text>

        <Pressable style={styles.whatsappButton} onPress={handleWhatsAppShare} accessibilityRole="button" accessibilityLabel={t('share.onWhatsApp')}>
          <WhatsappLogo size={20} color={theme.text.inverse} weight="fill" />
          <Text style={styles.whatsappLabel}>{t('share.onWhatsApp')}</Text>
        </Pressable>

        <Pressable style={styles.shareButton} onPress={handleNativeShare} accessibilityRole="button" accessibilityLabel={t('share.moreOptions')}>
          <ShareNetwork size={18} color={theme.text.primary} />
          <Text style={styles.shareLabel}>{t('share.moreOptions')}</Text>
        </Pressable>

        <Pressable style={styles.shareButton} onPress={() => setShowCalendarSheet(true)} accessibilityRole="button" accessibilityLabel={t('common.addToCalendar')}>
          <CalendarPlus size={18} color={theme.text.primary} />
          <Text style={styles.shareLabel}>{t('common.addToCalendar')}</Text>
        </Pressable>

        <Pressable style={styles.viewButton} onPress={onViewActivity} accessibilityRole="button" accessibilityLabel={t('share.viewActivity')}>
          <Text style={styles.viewLabel}>{t('share.viewActivity')}</Text>
        </Pressable>
      </View>

      <AddToCalendarSheet
        visible={showCalendarSheet}
        activity={{
          id: activity.id,
          title: activity.title,
          description: '',
          startsAt: activity.startsAt,
          durationMinutes: activity.durationMinutes,
          locationName: activity.locationName,
        }}
        onDismiss={() => setShowCalendarSheet(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background.app },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing['2xl'],
    gap: spacing.md,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: radius.pill,
    backgroundColor: theme.brand.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  title: { ...typography.title1, color: theme.text.primary, textAlign: 'center' },
  eyebrow: { ...typography.footnote, color: theme.text.muted, textAlign: 'center', textTransform: 'uppercase' },
  venue: { ...typography.title3, color: theme.text.primary, textAlign: 'center' },
  subtitle: {
    ...typography.body,
    color: theme.text.secondary,
    textAlign: 'center',
  },
  timeLabel: {
    ...typography.footnote,
    color: theme.text.secondary,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  whatsappButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: '#25D366', // WhatsApp's own brand green — intentionally off-palette
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    width: '100%',
    minHeight: 52,
  },
  whatsappLabel: { ...typography.bodyMedium, color: theme.text.inverse },
  shareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: theme.background.surface,
    borderWidth: 1,
    borderColor: theme.border.default,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    width: '100%',
    minHeight: 52,
  },
  shareLabel: { ...typography.bodyMedium, color: theme.text.primary },
  viewButton: { marginTop: spacing.lg, paddingVertical: spacing.sm },
  viewLabel: { ...typography.bodyMedium, color: theme.text.accent },
});
