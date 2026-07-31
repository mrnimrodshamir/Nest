import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet, Share, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CheckCircle, WhatsappLogo, ShareNetwork, CalendarPlus } from 'phosphor-react-native';
import { theme, typography, spacing, radius } from '@/theme';
import { buildShareMessage, type ShareableActivity } from '@/utils/buildShareMessage';
import { AddToCalendarSheet } from '@/components/AddToCalendarSheet';

interface ShareActivityScreenProps {
  activity: ShareableActivity;
  onViewActivity: () => void;
}

export function ShareActivityScreen({ activity, onViewActivity }: ShareActivityScreenProps) {
  const message = buildShareMessage(activity);
  const [showCalendarSheet, setShowCalendarSheet] = useState(false);

  const handleWhatsAppShare = async () => {
    const url = `whatsapp://send?text=${encodeURIComponent(message)}`;
    const canOpen = await Linking.canOpenURL(url);
    if (canOpen) {
      await Linking.openURL(url);
    } else {
      // WhatsApp isn't installed — the native share sheet is always the fallback.
      await Share.share({ message });
    }
  };

  const handleNativeShare = async () => {
    await Share.share({ message });
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.content}>
        <View style={styles.iconCircle}>
          <CheckCircle size={40} color={theme.brand.primary} weight="fill" />
        </View>
        <Text style={styles.title}>You're all set!</Text>
        <Text style={styles.subtitle}>
          "{activity.title}" is live. Invite moms nearby to join you.
        </Text>

        <Pressable style={styles.whatsappButton} onPress={handleWhatsAppShare}>
          <WhatsappLogo size={20} color={theme.text.inverse} weight="fill" />
          <Text style={styles.whatsappLabel}>Share on WhatsApp</Text>
        </Pressable>

        <Pressable style={styles.shareButton} onPress={handleNativeShare}>
          <ShareNetwork size={18} color={theme.text.primary} />
          <Text style={styles.shareLabel}>More sharing options</Text>
        </Pressable>

        <Pressable style={styles.shareButton} onPress={() => setShowCalendarSheet(true)}>
          <CalendarPlus size={18} color={theme.text.primary} />
          <Text style={styles.shareLabel}>Add to calendar</Text>
        </Pressable>

        <Pressable style={styles.viewButton} onPress={onViewActivity}>
          <Text style={styles.viewLabel}>View activity</Text>
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
  subtitle: {
    ...typography.body,
    color: theme.text.secondary,
    textAlign: 'center',
    marginBottom: spacing.xl,
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
