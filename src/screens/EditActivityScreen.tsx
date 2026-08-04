import React from 'react';
import { View, Text, Pressable, Alert, ActivityIndicator, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft } from 'phosphor-react-native';
import { theme, typography, spacing } from '@/theme';
import { ActivityForm } from '@/components/ActivityForm';
import { useEditActivity } from '@/hooks/useEditActivity';
import { useHostAttendance } from '@/hooks/useHostAttendance';
import type { ActivityDetail } from '@/types/activity';
import type { CreateActivityInput } from '@/hooks/useCreateActivity';

interface EditActivityScreenProps {
  activity: ActivityDetail;
  onBack: () => void;
  onSaved: () => void;
  onCancelled: () => void;
}

export function EditActivityScreen({ activity, onBack, onSaved, onCancelled }: EditActivityScreenProps) {
  const { isSubmitting, stage, error, update, cancelActivity } = useEditActivity(activity.id);
  // ActivityForm reads initialValues.hostChildIds into local state once, on
  // mount — so the form must not render until this resolves, or a host
  // editing any field (even just fixing a typo) would silently save their
  // attendance back to "alone".
  const { childIds: hostChildIds, isLoading: isLoadingAttendance } = useHostAttendance(activity.id);

  const handleSubmit = async (input: CreateActivityInput) => {
    const success = await update(input);
    if (success) onSaved();
  };

  const handleCancelActivity = () => {
    Alert.alert(
      'Cancel this activity?',
      'Everyone who joined will be notified. This can\'t be undone.',
      [
        { text: 'Keep activity', style: 'cancel' },
        {
          text: 'Cancel activity',
          style: 'destructive',
          onPress: async () => {
            const success = await cancelActivity();
            if (success) onCancelled();
          },
        },
      ],
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.header}>
          <Pressable onPress={onBack} style={styles.backButton} accessibilityLabel="Back">
            <ArrowLeft size={20} color={theme.text.primary} />
          </Pressable>
          <Text style={styles.headerTitle}>Edit activity</Text>
          <View style={styles.backButton} />
        </View>

        {isLoadingAttendance ? (
          <View style={styles.loadingState}>
            <ActivityIndicator color={theme.brand.primary} />
          </View>
        ) : (
          <ActivityForm
            mode="edit"
            initialValues={{
              activityType: activity.category,
              title: activity.title,
              description: activity.description,
              startsAt: new Date(activity.startTime),
              durationMinutes: activity.durationMinutes,
              latitude: activity.latitude,
              longitude: activity.longitude,
              locationName: activity.location.label,
              maxParticipants: activity.capacity,
              babyMinAgeMonths: activity.babyMinAgeMonths,
              babyMaxAgeMonths: activity.babyMaxAgeMonths,
              notes: activity.notes ?? '',
              coverImageUrl: activity.coverImageUrl,
              hostChildIds,
            }}
            submitLabel="Save changes"
            isSubmitting={isSubmitting}
            stage={stage}
            error={error}
            onSubmit={handleSubmit}
            footer={
              <Pressable style={styles.cancelButton} onPress={handleCancelActivity} disabled={isSubmitting}>
                <Text style={styles.cancelButtonLabel}>Cancel this activity</Text>
              </Pressable>
            }
          />
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background.app },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.background.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { ...typography.headline, color: theme.text.primary },
  loadingState: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  cancelButton: { alignItems: 'center', paddingVertical: spacing.md, marginTop: spacing.sm },
  cancelButtonLabel: { ...typography.bodyMedium, color: theme.semantic.danger },
});
