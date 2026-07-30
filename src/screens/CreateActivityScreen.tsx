import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft } from 'phosphor-react-native';
import { theme, typography, spacing } from '@/theme';
import { ActivityForm } from '@/components/ActivityForm';
import { PrimaryButton } from '@/components/PrimaryButton';
import { useCreateActivity, type CreateActivityInput } from '@/hooks/useCreateActivity';

interface CreateActivityScreenProps {
  onBack: () => void;
  onCreated: (activityId: string, input: CreateActivityInput) => void;
  initialLatitude: number;
  initialLongitude: number;
}

export function CreateActivityScreen({
  onBack,
  onCreated,
  initialLatitude,
  initialLongitude,
}: CreateActivityScreenProps) {
  const { isSubmitting, stage, error, submit, retryHostJoin } = useCreateActivity();
  // Set only when the activity itself was created but the host's own
  // join failed — the activity is real and must never be silently
  // discarded or re-created; the user retries just the join step.
  const [pendingJoin, setPendingJoin] = useState<{ activityId: string; input: CreateActivityInput } | null>(null);

  const handleSubmit = async (input: CreateActivityInput) => {
    const result = await submit(input);
    if (result.status === 'success') {
      setPendingJoin(null);
      onCreated(result.activityId, input);
    } else if (result.status === 'partial') {
      setPendingJoin({ activityId: result.activityId, input });
    } else {
      setPendingJoin(null);
    }
  };

  const handleRetryJoin = async () => {
    if (!pendingJoin) return;
    const joined = await retryHostJoin(pendingJoin.activityId, pendingJoin.input.hostChildIds);
    if (joined) {
      const { activityId, input } = pendingJoin;
      setPendingJoin(null);
      onCreated(activityId, input);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.header}>
          <Pressable onPress={onBack} style={styles.backButton} accessibilityLabel="Back">
            <ArrowLeft size={20} color={theme.text.primary} />
          </Pressable>
          <Text style={styles.headerTitle}>Host an activity</Text>
          <View style={styles.backButton} />
        </View>

        <ActivityForm
          initialValues={{
            activityType: 'stroller_walk',
            title: '',
            description: '',
            startsAt: (() => {
              const d = new Date();
              d.setHours(d.getHours() + 2, 0, 0, 0);
              return d;
            })(),
            durationMinutes: 60,
            latitude: initialLatitude,
            longitude: initialLongitude,
            locationName: '',
            maxParticipants: 8,
            babyMinAgeMonths: null,
            babyMaxAgeMonths: null,
            notes: '',
          }}
          submitLabel="Create activity"
          // Also disabled while a host-join retry is pending — the activity
          // already exists at this point, so tapping "Create activity"
          // again would create a second one instead of finishing the first.
          // The retry footer button below is the only way forward here.
          isSubmitting={isSubmitting || Boolean(pendingJoin)}
          stage={stage}
          error={error}
          onSubmit={handleSubmit}
          footer={
            pendingJoin ? (
              <View style={styles.retryRow}>
                <PrimaryButton
                  label="Retry joining your activity"
                  onPress={handleRetryJoin}
                  loading={isSubmitting}
                  variant="outline"
                />
              </View>
            ) : undefined
          }
        />
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
  retryRow: { marginTop: spacing.sm },
});
