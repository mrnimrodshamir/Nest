import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, StyleSheet } from 'react-native';
import { theme, typography, spacing, radius } from '@/theme';
import { CategoryChip } from '@/components/CategoryChip';
import { DateTimeField } from '@/components/DateTimeField';
import { LocationPicker } from '@/components/LocationPicker';
import { NumberStepper } from '@/components/NumberStepper';
import { YearsMonthsPicker } from '@/components/YearsMonthsPicker';
import { Checkbox } from '@/components/Checkbox';
import { PrimaryButton } from '@/components/PrimaryButton';
import { useAuth } from '@/hooks/useAuth';
import { CATEGORY_LABELS, DURATION_OPTIONS_MINUTES } from '@/types/activity';
import type { ActivityCategory } from '@/types/activity';
import { formatDuration } from '@/utils/formatDuration';
import type { CreateActivityInput } from '@/hooks/useCreateActivity';

const ACTIVITY_TYPES = Object.keys(CATEGORY_LABELS) as ActivityCategory[];

export interface ActivityFormInitialValues {
  activityType: ActivityCategory;
  title: string;
  description: string;
  startsAt: Date;
  durationMinutes: number;
  latitude: number;
  longitude: number;
  locationName: string;
  maxParticipants: number | null;
  babyMinAgeMonths: number | null;
  babyMaxAgeMonths: number | null;
  notes: string;
}

interface ActivityFormProps {
  initialValues?: ActivityFormInitialValues;
  submitLabel: string;
  isSubmitting: boolean;
  error: string | null;
  onSubmit: (input: CreateActivityInput) => void;
  /** Extra actions rendered below the submit button (e.g. Cancel activity) */
  footer?: React.ReactNode;
}

export function ActivityForm({
  initialValues,
  submitLabel,
  isSubmitting,
  error,
  onSubmit,
  footer,
}: ActivityFormProps) {
  const { profile } = useAuth();

  const [activityType, setActivityType] = useState<ActivityCategory>(
    initialValues?.activityType ?? 'stroller_walk',
  );
  const [title, setTitle] = useState(initialValues?.title ?? '');
  const [description, setDescription] = useState(initialValues?.description ?? '');
  const [startsAt, setStartsAt] = useState(() => {
    if (initialValues) return initialValues.startsAt;
    const d = new Date();
    d.setHours(d.getHours() + 2, 0, 0, 0);
    return d;
  });
  const initialDuration = initialValues?.durationMinutes ?? 60;
  const [durationMinutes, setDurationMinutes] = useState<number>(initialDuration);
  const [customDuration, setCustomDuration] = useState(
    !(DURATION_OPTIONS_MINUTES as readonly number[]).includes(initialDuration),
  );
  const [latitude, setLatitude] = useState(initialValues?.latitude ?? 32.0853);
  const [longitude, setLongitude] = useState(initialValues?.longitude ?? 34.7818);
  const [locationName, setLocationName] = useState(initialValues?.locationName ?? '');
  const [maxParticipants, setMaxParticipants] = useState(initialValues?.maxParticipants ?? 8);
  const [noLimit, setNoLimit] = useState(initialValues ? initialValues.maxParticipants === null : false);
  const [anyAge, setAnyAge] = useState(
    initialValues ? initialValues.babyMinAgeMonths === null && initialValues.babyMaxAgeMonths === null : true,
  );
  const initialMin = initialValues?.babyMinAgeMonths
    ? birthdateToYearsMonthsFromTotal(initialValues.babyMinAgeMonths)
    : { years: 0, months: 0 };
  const initialMax = initialValues?.babyMaxAgeMonths
    ? birthdateToYearsMonthsFromTotal(initialValues.babyMaxAgeMonths)
    : { years: 1, months: 0 };
  const [minYears, setMinYears] = useState(initialMin.years);
  const [minMonths, setMinMonths] = useState(initialMin.months);
  const [maxYears, setMaxYears] = useState(initialMax.years);
  const [maxMonths, setMaxMonths] = useState(initialMax.months);
  const [notes, setNotes] = useState(initialValues?.notes ?? '');
  const [validationError, setValidationError] = useState<string | null>(null);

  const handleSubmit = () => {
    if (!title.trim()) return setValidationError('Give your activity a title');
    if (!description.trim()) return setValidationError('Add a short description');
    if (!locationName.trim()) return setValidationError('Name the public place you picked');
    setValidationError(null);

    onSubmit({
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
    });
  };

  return (
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
        <CategoryChip label="Custom" selected={customDuration} onPress={() => setCustomDuration(true)} />
      </View>
      {customDuration && (
        <NumberStepper value={durationMinutes} min={15} max={480} onChange={setDurationMinutes} />
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
        {!noLimit && <NumberStepper value={maxParticipants} min={2} max={100} onChange={setMaxParticipants} />}
        <View style={styles.inlineCheckbox}>
          <Checkbox checked={noLimit} onToggle={() => setNoLimit((v) => !v)}>
            No limit
          </Checkbox>
        </View>
      </View>

      <Text style={styles.sectionLabel}>Baby age range</Text>
      <Checkbox checked={anyAge} onToggle={() => setAnyAge((v) => !v)}>
        Any age welcome
      </Checkbox>
      {!anyAge && (
        <View style={styles.ageRangeGroup}>
          <View>
            <Text style={styles.ageRangeLabel}>Minimum age</Text>
            <YearsMonthsPicker
              years={minYears}
              months={minMonths}
              onChange={(y, m) => {
                setMinYears(y);
                setMinMonths(m);
              }}
            />
          </View>
          <View>
            <Text style={styles.ageRangeLabel}>Maximum age</Text>
            <YearsMonthsPicker
              years={maxYears}
              months={maxMonths}
              onChange={(y, m) => {
                setMaxYears(y);
                setMaxMonths(m);
              }}
            />
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
        <View style={styles.hostAvatar} />
        <Text style={styles.hostLabel}>Hosted by {profile?.displayName ?? 'you'}</Text>
      </View>

      {(validationError || error) && <Text style={styles.formError}>{validationError ?? error}</Text>}

      <PrimaryButton label={submitLabel} onPress={handleSubmit} loading={isSubmitting} />
      {footer}
    </ScrollView>
  );
}

function birthdateToYearsMonthsFromTotal(totalMonths: number) {
  return { years: Math.floor(totalMonths / 12), months: totalMonths % 12 };
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
