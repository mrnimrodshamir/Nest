import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, StyleSheet } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Camera } from 'phosphor-react-native';
import { theme, typography, spacing, radius } from '@/theme';
import { CategoryChip } from '@/components/CategoryChip';
import { DateTimeField } from '@/components/DateTimeField';
import { LocationPicker } from '@/components/LocationPicker';
import { NumberStepper } from '@/components/NumberStepper';
import { YearsMonthsPicker } from '@/components/YearsMonthsPicker';
import { Checkbox } from '@/components/Checkbox';
import { PrimaryButton } from '@/components/PrimaryButton';
import { CoverImage } from '@/components/CoverImage';
import { CuratedCover, parseCuratedCover } from '@/components/CuratedCover';
import { ComingWithSelector } from '@/components/ComingWithSelector';
import { useAuth } from '@/hooks/useAuth';
import { useChildren } from '@/hooks/useChildren';
import { CATEGORY_LABELS, DURATION_OPTIONS_MINUTES } from '@/types/activity';
import type { ActivityCategory } from '@/types/activity';
import { formatDuration } from '@/utils/formatDuration';
import type { CreateActivityInput, CreateActivityStage } from '@/hooks/useCreateActivity';

const ACTIVITY_TYPES = Object.keys(CATEGORY_LABELS) as ActivityCategory[];

const STAGE_LABELS: Record<CreateActivityStage, string> = {
  saving: 'Saving…',
  compressing: 'Preparing your photo…',
  uploading: 'Uploading your photo…',
};

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
  coverImageUrl?: string | null;
  /** Empty means "coming alone". Omit entirely to default to alone (used
   *  by the Edit Activity form, which doesn't currently pre-load the
   *  activity's existing selection — see useEditActivity). */
  hostChildIds?: string[];
}

interface ActivityFormProps {
  initialValues?: ActivityFormInitialValues;
  submitLabel: string;
  isSubmitting: boolean;
  stage?: CreateActivityStage | 'saving' | null;
  error: string | null;
  onSubmit: (input: CreateActivityInput) => void;
  /** Extra actions rendered below the submit button (e.g. Cancel activity) */
  footer?: React.ReactNode;
}

export function ActivityForm({
  initialValues,
  submitLabel,
  isSubmitting,
  stage,
  error,
  onSubmit,
  footer,
}: ActivityFormProps) {
  const { profile, session } = useAuth();
  const { children } = useChildren(session?.user.id ?? null);
  const [hostChildIds, setHostChildIds] = useState<string[]>(initialValues?.hostChildIds ?? []);

  const [activityType, setActivityType] = useState<ActivityCategory>(
    initialValues?.activityType ?? 'stroller_walk',
  );
  const [coverUri, setCoverUri] = useState<string | null>(null);
  const [curatedCover, setCuratedCover] = useState<ActivityCategory | null>(
    parseCuratedCover(initialValues?.coverImageUrl ?? null),
  );
  const [title, setTitle] = useState(initialValues?.title ?? '');
  // "Details" is the one optional free-text field — for an existing
  // activity being edited, fall back to its legacy `notes` value if
  // `description` is empty, so pre-merge activities don't appear to have
  // silently lost that text. New activities only ever write to
  // `description` going forward (see useCreateActivity.ts).
  const [description, setDescription] = useState(
    initialValues?.description || initialValues?.notes || '',
  );
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
  const [validationError, setValidationError] = useState<string | null>(null);
  // Synchronous guard alongside isSubmitting (state) — a fast double-tap
  // can fire two onPress handlers before the disabled-button re-render
  // commits, same pattern used for auth screens' submit buttons.
  const inFlightRef = useRef(false);

  // Releases the guard once the parent's async submit resolves (success,
  // partial failure, or error) — ActivityForm doesn't await onSubmit
  // itself, so it only knows submission finished via this prop flipping
  // back to false.
  useEffect(() => {
    if (!isSubmitting) inFlightRef.current = false;
  }, [isSubmitting]);

  const handleSubmit = () => {
    if (inFlightRef.current) return;
    if (!title.trim()) return setValidationError('Give your activity a title');
    if (!locationName.trim()) return setValidationError('Name the public place you picked');
    setValidationError(null);

    inFlightRef.current = true;
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
      // New activities only ever write to `description` — `notes` is kept
      // in the DB for legacy rows but is never populated for new ones.
      notes: '',
      coverUri,
      curatedCover: coverUri ? null : curatedCover,
      hostChildIds,
    });
  };

  const handlePickCoverPhoto = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setCoverUri(result.assets[0].uri);
      setCuratedCover(null);
    }
  };

  const previewCoverUrl = coverUri ? null : curatedCover ? null : initialValues?.coverImageUrl ?? null;

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

      <Text style={styles.sectionLabel}>Cover photo</Text>
      <View style={styles.coverPreview}>
        {coverUri ? (
          <CoverImage url={coverUri} fallbackCategory={activityType} style={styles.coverPreviewFill} />
        ) : curatedCover ? (
          <CuratedCover category={curatedCover} style={styles.coverPreviewFill} />
        ) : previewCoverUrl ? (
          <CoverImage url={previewCoverUrl} fallbackCategory={activityType} style={styles.coverPreviewFill} />
        ) : (
          <CuratedCover category={activityType} style={styles.coverPreviewFill} />
        )}
      </View>
      <Pressable style={styles.uploadCoverButton} onPress={handlePickCoverPhoto}>
        <Camera size={16} color={theme.text.primary} />
        <Text style={styles.uploadCoverLabel}>Upload a photo</Text>
      </Pressable>
      <Text style={styles.curatedLabel}>Or choose a curated cover</Text>
      <View style={styles.curatedRow}>
        {ACTIVITY_TYPES.map((type) => (
          <Pressable
            key={type}
            style={[styles.curatedSwatch, curatedCover === type && !coverUri && styles.curatedSwatchSelected]}
            onPress={() => {
              setCuratedCover(type);
              setCoverUri(null);
            }}
            accessibilityLabel={`Use curated cover for ${CATEGORY_LABELS[type]}`}
          >
            <CuratedCover category={type} style={styles.curatedSwatchFill} />
          </Pressable>
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

      <ComingWithSelector children={children} selectedChildIds={hostChildIds} onChange={setHostChildIds} />

      <Field label="Details (optional)">
        <TextInput
          style={[styles.input, styles.textArea]}
          placeholder="Example: Bring water and a mat. We'll meet near the main entrance."
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

      <PrimaryButton
        label={isSubmitting && stage ? STAGE_LABELS[stage] : submitLabel}
        onPress={handleSubmit}
        loading={isSubmitting}
      />
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
  coverPreview: {
    height: 140,
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: theme.background.surface,
  },
  coverPreviewFill: { flex: 1 },
  uploadCoverButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: theme.background.surface,
    borderWidth: 1,
    borderColor: theme.border.default,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
  },
  uploadCoverLabel: { ...typography.bodyMedium, color: theme.text.primary },
  curatedLabel: { ...typography.footnote, color: theme.text.secondary },
  curatedRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  curatedSwatch: {
    width: 52,
    height: 52,
    borderRadius: radius.md,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  curatedSwatchSelected: { borderColor: theme.brand.primary },
  curatedSwatchFill: { flex: 1 },
});
