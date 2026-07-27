import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft } from 'phosphor-react-native';
import { theme, typography, spacing, radius } from '@/theme';
import { CategoryChip } from '@/components/CategoryChip';
import { DateTimeField } from '@/components/DateTimeField';
import { LocationPicker } from '@/components/LocationPicker';
import { NumberStepper } from '@/components/NumberStepper';
import { YearsMonthsPicker } from '@/components/YearsMonthsPicker';
import { Checkbox } from '@/components/Checkbox';
import { PrimaryButton } from '@/components/PrimaryButton';
import { useCreateActivity, type CreateActivityInput } from '@/hooks/useCreateActivity';
import { useAuth } from '@/hooks/useAuth';
import { CATEGORY_LABELS, DURATION_OPTIONS_MINUTES } from '@/types/activity';
import type { ActivityCategory } from '@/types/activity';
import { formatDuration } from '@/utils/formatDuration';

const ACTIVITY_TYPES = Object.keys(CATEGORY_LABELS) as ActivityCategory[];

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
  const { profile } = useAuth();
  const { isSubmitting, error, submit } = useCreateActivity();

  const [activityType, setActivityType] = useState<ActivityCategory>('stroller_walk');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [startsAt, setStartsAt] = useState(() => {
    const d = new Date();
    d.setHours(d.getHours() + 2, 0, 0, 0);
    return d;
  });
  const [durationMinutes, setDurationMinutes] = useState<number>(60);
  const [customDuration, setCustomDuration] = useState(false);
  const [latitude, setLatitude] = useState(initialLatitude);
  const [longitude, setLongitude] = useState(initialLongitude);
  const [locationName, setLocationName] = useState('');
  const [maxParticipants, setMaxParticipants] = useState(8);
  const [noLimit, setNoLimit] = useState(false);
  const [anyAge, setAnyAge] = useState(true);
  const [minYears, setMinYears] = useState(0);
  const [minMonths, setMinMonths] = useState(0);
  const [maxYears, setMaxYears] = useState(1);
  const [maxMonths, setMaxMonths] = useState(0);
  const [notes, setNotes] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!title.trim()) return setValidationError('Give your activity a title');
    if (!description.trim()) return setValidationError('Add a short description');
    if (!locationName.trim()) return setValidationError('Name the public place you picked');
    setValidationError(null);

    const input: CreateActivityInput = {
      activityType,
      title: title.trim(),
      description: description.trim(),
      startsAt,
      durationMinutes,
      latitude,
      longitude,
      locationName: locationName.trim(),
      maxParticipants: noLimit ? null : maxParticipants,
      babyMinAgeMonths: anyAge ? null : minYears * 12 + minMonths,
      babyMaxAgeMonths: anyAge ? null : maxYears * 12 + maxMonths,
      notes: notes.trim(),
    };
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

        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.sectionLabel}>Activity type</Text>
          <View style={styles.chipWrap}>
            {ACTIVITY_TYPES.map((type) => (
              <CategoryChip
                key={type}
                label={CATEGORY_LABELS[type]}
                selected={activityType === type}
                onPress={() => setActivityType(type)}
              />
            ))}
          </View>

          <Field label="Title">
            <TextInput
              style={styles.input}
              placeholder="Stroller walk along the park"
              placeholderTextColor={theme.text.muted}
              value={title}
              onChangeText={setTitle}
            />
          </Field>

          <DateTimeField
            label="Date and start time"
            value={startsAt}
            onChange={setStartsAt}
            minimumDate={new Date()}
          />

          <Text style={styles.sectionLabel}>Duration</Text>
          <View style={styles.chipWrap}>
            {DURATION_OPTIONS_MINUTES.map((minutes) => (
              <CategoryChip
                key={minutes}
                label={formatDuration(minutes)}
                selected={!customDuration && durationMinutes === minutes}
                onPress={() => {
                  setCustomDuration(false);
                  setDurationMinutes(minutes);
                }}
              />
            ))}
            <CategoryChip
              label="Custom"
              selected={customDuration}
              onPress={() => setCustomDuration(true)}
            />
          </View>
          {customDuration && (
            <NumberStepper
              value={durationMinutes}
              min={15}
              max={480}
              onChange={setDurationMinutes}
            />
          )}

          <Text style={styles.sectionLabel}>Location</Text>
          <LocationPicker
            latitude={latitude}
            longitude={longitude}
            onChangeCoordinates={(lat, lng) => {
              setLatitude(lat);
              setLongitude(lng);
            }}
          />
          <Field label="Location name">
            <TextInput
              style={styles.input}
              placeholder="e.g. HaYarkon Park, main entrance"
              placeholderTextColor={theme.text.muted}
              value={locationName}
              onChangeText={setLocationName}
            />
          </Field>

          <Text style={styles.sectionLabel}>Max participants</Text>
          <View style={styles.row}>
            {!noLimit && (
              <NumberStepper value={maxParticipants} min={2} max={100} onChange={setMaxParticipants} />
            )}
            <Pressable
              style={styles.inlineCheckbox}
              onPress={() => setNoLimit((v) => !v)}
            >
              <Checkbox checked={noLimit} onToggle={() => setNoLimit((v) => !v)}>
                No limit
              </Checkbox>
            </Pressable>
          </View>

          <Text style={styles.sectionLabel}>Baby age range</Text>
          <Checkbox checked={anyAge} onToggle={() => setAnyAge((v) => !v)}>
            Any age welcome
          </Checkbox>
          {!anyAge && (
            <View style={styles.ageRangeGroup}>
              <View>
                <Text style={styles.ageRangeLabel}>Minimum age</Text>
                <YearsMonthsPicker years={minYears} months={minMonths} onChange={(y, m) => {
                  setMinYears(y);
                  setMinMonths(m);
                }} />
              </View>
              <View>
                <Text style={styles.ageRangeLabel}>Maximum age</Text>
                <YearsMonthsPicker years={maxYears} months={maxMonths} onChange={(y, m) => {
                  setMaxYears(y);
                  setMaxMonths(m);
                }} />
              </View>
            </View>
          )}

          <Field label="Notes / what to bring">
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="e.g. Bring water, stroller-friendly, shade available"
              placeholderTextColor={theme.text.muted}
              value={notes}
              onChangeText={setNotes}
              multiline
            />
          </Field>

          <Field label="Description">
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Tell people what to expect"
              placeholderTextColor={theme.text.muted}
              value={description}
              onChangeText={setDescription}
              multiline
            />
          </Field>

          <View style={styles.hostRow}>
            <View style={styles.hostAvatar}>
              {profile?.avatarUrl && (
                <View style={StyleSheet.absoluteFill}>
                  {/* Image kept simple here — full profile photo rendering lives in ProfileScreen */}
                </View>
              )}
            </View>
            <Text style={styles.hostLabel}>Hosted by {profile?.displayName ?? 'you'}</Text>
          </View>

          {(validationError || error) && (
            <Text style={styles.formError}>{validationError ?? error}</Text>
          )}

          <PrimaryButton label="Create activity" onPress={handleSubmit} loading={isSubmitting} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
    </View>
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
  content: { paddingHorizontal: spacing.lg, paddingBottom: spacing['4xl'], gap: spacing.lg },
  sectionLabel: { ...typography.bodyMedium, color: theme.text.primary, marginTop: spacing.sm },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  field: { gap: spacing.xs },
  fieldLabel: { ...typography.footnote, color: theme.text.secondary },
  input: {
    ...typography.body,
    backgroundColor: theme.background.surface,
    borderWidth: 1,
    borderColor: theme.border.default,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    color: theme.text.primary,
  },
  textArea: { minHeight: 88, textAlignVertical: 'top' },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  inlineCheckbox: { flex: 1 },
  ageRangeGroup: { gap: spacing.lg },
  ageRangeLabel: { ...typography.footnote, color: theme.text.secondary, marginBottom: spacing.xs },
  hostRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm },
  hostAvatar: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    backgroundColor: theme.brand.primaryTint,
    overflow: 'hidden',
  },
  hostLabel: { ...typography.subhead, color: theme.text.secondary },
  formError: { ...typography.footnote, color: theme.semantic.danger, textAlign: 'center' },
});
