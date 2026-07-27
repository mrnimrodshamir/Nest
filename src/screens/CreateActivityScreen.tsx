import React from 'react';
import { View, Text, Pressable, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft } from 'phosphor-react-native';
import { theme, typography, spacing } from '@/theme';
import { ActivityForm } from '@/components/ActivityForm';
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
  const { isSubmitting, error, submit } = useCreateActivity();

  const handleSubmit = async (input: CreateActivityInput) => {
    const activityId = await submit(input);
    if (activityId) onCreated(activityId, input);
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
          isSubmitting={isSubmitting}
          error={error}
          onSubmit={handleSubmit}
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
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.background.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { ...typography.headline, color: theme.text.primary },
});
