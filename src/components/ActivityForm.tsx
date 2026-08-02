import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, StyleSheet } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Camera } from 'phosphor-react-native';
import { theme, typography, spacing, radius } from '@/theme';
import { CategoryChip } from '@/components/CategoryChip';
import { CategoryPicker } from '@/components/CategoryPicker';
import { DateTimeField } from '@/components/DateTimeField';
import { LocationPicker } from '@/components/LocationPicker';
import { NumberStepper } from '@/components/NumberStepper';
import { YearsMonthsPicker } from '@/components/YearsMonthsPicker';
import { Checkbox } from '@/components/Checkbox';
import { PrimaryButton } from '@/components/PrimaryButton';
import { CoverImage } from '@/components/CoverImage';
import { CoverFrame } from '@/components/CoverFrame';
import { ComingWithSelector } from '@/components/ComingWithSelector';
import { useAuth } from '@/hooks/useAuth';
import { useChildren } from '@/hooks/useChildren';
import { CATEGORY_LABELS, DURATION_OPTIONS_MINUTES } from '@/types/activity';
import type { ActivityCategory } from '@/types/activity';
import { formatDuration } from '@/utils/formatDuration';
import { pickDefaultChild } from '@/utils/pickDefaultChild';
import { generateActivityTitle } from '@/utils/generateActivityTitle';
import { formatExactStartTime } from '@/utils/formatExactStartTime';
import type { CreateActivityInput, CreateActivityStage } from '@/hooks/useCreateActivity';

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
  /** Only ever set for Edit, where every field must start at the activity's
   *  real current value. Create never passes this — see `initialLocation`
   *  for the one piece of starting data Create actually needs. Passing a
   *  populated object here for Create would silently disable the whole
   *  create-only flow (Review step, reactive title generation, default-
   *  child auto-select all gate on `!initialValues`). */
  initialValues?: ActivityFormInitialValues;
  /** Create-only: where to initially center the map, from the device's
   *  current location. Ignored once `initialValues` is set. */
  initialLocation?: { latitude: number; longitude: number };
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
  initialLocation,
  submitLabel,
  isSubmitting,
  stage,
  error,
  onSubmit,
  footer,
}: ActivityFormProps) {
  // Only a brand-new activity gets the Type -> Date -> Location -> Review
  // flow — editing an existing one keeps the original single-screen save,
  // since a review step there would just be friction on a flow that
  // already works.
  const isCreateFlow = !initialValues;
  const [reviewMode, setReviewMode] = useState(false);

  const { session } = useAuth();
  const { children } = useChildren(session?.user.id ?? null);
  const [hostChildIds, setHostChildIds] = useState<string[]>(initialValues?.hostChildIds ?? []);
  // Auto-select the host's default (or only) child the first time their
  // children finish loading — never for Edit, which pre-loads the
  // activity's real existing selection via initialValues.hostChildIds.
  // Fires once; after that the host's own taps are never overridden.
  const didAutoSelectChild = useRef(false);
  useEffect(() => {
    if (initialValues) return;
    if (didAutoSelectChild.current) return;
    const defaultChild = pickDefaultChild(children);
    if (!defaultChild) return;
    didAutoSelectChild.current = true;
    setHostChildIds([defaultChild.id]);
  }, [children, initialValues]);

  const [activityType, setActivityType] = useState<ActivityCategory>(
    initialValues?.activityType ?? 'stroller_walk',
  );
  const [coverUri, setCoverUri] = useState<string | null>(null);

  // The title is generated from type + date/time + location and kept in
  // sync automatically — a host only ever types one by hand if they tap
  // "Customize title" (and can tap back to "Use automatic title" any
  // time). Editing an existing activity starts customized (it already
  // has a real title) so it's never silently rewritten.
  const [titleCustomized, setTitleCustomized] = useState(!!initialValues);
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
  const [latitude, setLatitude] = useState(
    initialValues?.latitude ?? initialLocation?.latitude ?? 32.0853,
  );
  const [longitude, setLongitude] = useState(
    initialValues?.longitude ?? initialLocation?.longitude ?? 34.7818,
  );
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

  useEffect(() => {
    if (titleCustomized) return;
    setTitle(generateActivityTitle(activityType, startsAt, locationName));
  }, [activityType, startsAt, locationName, titleCustomized]);

  const validateEssentials = () => {
    if (!title.trim()) return setValidationError('Give your activity a title'), false;
    if (!locationName.trim()) return setValidationError('Name the public place you picked'), false;
    setValidationError(null);
    return true;
  };

  const handleSubmit = () => {
    if (inFlightRef.current) return;
    if (!validateEssentials()) return;

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
      hostChildIds,
    });
  };

  const handlePrimaryPress = () => {
    if (isCreateFlow && !reviewMode) {
      if (!validateEssentials()) return;
      setReviewMode(true);
      return;
    }
    handleSubmit();
  };

  const handlePickCoverPhoto = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      // 4:3 matches the hero frame (ACTIVITY_ART_ASPECT.hero) used by this
      // preview, the Review step and Activity Detail — the surfaces where
      // an uploaded cover is shown largest and a mismatch would be most
      // visible. Discovery/My Activities cards are 16:9 and will trim the
      // top/bottom of this crop via resizeMode="cover", which is the
      // intended, lossless-direction behaviour (never a stretch).
      aspect: [4, 3],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setCoverUri(result.assets[0].uri);
    }
  };

  const reviewDateTimeSummary = formatExactStartTime(startsAt.toISOString());

  const reviewChildSummary =
    hostChildIds.length === 0
      ? 'Coming alone'
      : children
          .filter((c) => hostChildIds.includes(c.id))
          .map((c) => c.name)
          .join(', ') || 'Coming alone';

  const primaryLabel = isSubmitting && stage ? STAGE_LABELS[stage] : isCreateFlow && !reviewMode ? 'Review' : submitLabel;

  return (
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      {isCreateFlow && reviewMode ? (
        <View style={styles.reviewBlock}>
          <CoverFrame variant="hero" radius={radius.lg} style={styles.coverPreview}>
            {/* Review only ever renders in the create flow, which has no
                initialValues.coverImageUrl to fall back to. */}
            <CoverImage url={coverUri} fallbackCategory={activityType} variant="hero" surface="ReviewStep" style={styles.coverPreviewFill} />
          </CoverFrame>
          <Text style={styles.generatedTitle}>{title}</Text>

          <ReviewRow label="Category" value={CATEGORY_LABELS[activityType] ?? CATEGORY_LABELS.other} />
          <ReviewRow label="When" value={reviewDateTimeSummary} />
          <ReviewRow label="Duration" value={formatDuration(durationMinutes)} />
          <ReviewRow label="Location" value={locationName} />
          <ReviewRow label="Capacity" value={noLimit ? 'No limit' : `${maxParticipants} people`} />
          <ReviewRow label="Coming with" value={reviewChildSummary} />
          {description.trim() ? <ReviewRow label="Details" value={description.trim()} /> : null}

          <Pressable onPress={() => setReviewMode(false)} style={styles.editDetailsLink} hitSlop={8}>
            <Text style={styles.customizeLink}>Edit details</Text>
          </Pressable>
        </View>
      ) : (
        <>
          <Text style={styles.sectionLabel}>Activity type</Text>
          <CategoryPicker selected={activityType} onSelect={setActivityType} />

          <CoverFrame variant="hero" radius={radius.lg} style={styles.coverPreview}>
            <CoverImage
              url={coverUri ?? initialValues?.coverImageUrl ?? null}
              fallbackCategory={activityType}
              variant="hero"
              surface="CreatePreview"
              style={styles.coverPreviewFill}
            />
          </CoverFrame>
          <Pressable style={styles.uploadCoverButton} onPress={handlePickCoverPhoto}>
            <Camera size={16} color={theme.text.primary} />
            <Text style={styles.uploadCoverLabel}>
              {coverUri ? 'Change activity cover photo' : 'Upload an activity cover photo'}
            </Text>
          </Pressable>

          {titleCustomized ? (
            <Field label="Title">
              <TextInput
                style={styles.input}
                placeholder="Stroller walk along the park"
                placeholderTextColor={theme.text.muted}
                value={title}
                onChangeText={setTitle}
              />
              {!initialValues && (
                <Pressable
                  onPress={() => setTitleCustomized(false)}
                  hitSlop={8}
                  style={styles.revertTitleLink}
                >
                  <Text style={styles.customizeLink}>Use automatic title</Text>
                </Pressable>
              )}
            </Field>
          ) : (
            <View style={styles.generatedTitleRow}>
              <Text style={styles.generatedTitle} numberOfLines={2}>
                {title}
              </Text>
              <Pressable onPress={() => setTitleCustomized(true)} hitSlop={8}>
                <Text style={styles.customizeLink}>Customize title</Text>
              </Pressable>
            </View>
          )}

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
            onChangeLocationName={setLocationName}
            autoCenterOnMount={!initialValues}
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

          <ComingWithSelector children={children} selectedChildIds={hostChildIds} onChange={setHostChildIds} />

          <Text style={styles.sectionLabel}>Capacity, age range & details</Text>
          <View style={styles.moreSection}>
            <Text style={styles.sectionLabel}>Max participants</Text>
            <View style={styles.row}>
              {!noLimit && (
                <NumberStepper value={maxParticipants} min={2} max={100} onChange={setMaxParticipants} />
              )}
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
          </View>
        </>
      )}

      {(validationError || error) && <Text style={styles.formError}>{validationError ?? error}</Text>}

      <PrimaryButton label={primaryLabel} onPress={handlePrimaryPress} loading={isSubmitting} />
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

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.reviewRow}>
      <Text style={styles.reviewLabel}>{label}</Text>
      <Text style={styles.reviewValue} numberOfLines={3}>
        {value}
      </Text>
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
  formError: { ...typography.footnote, color: theme.semantic.danger, textAlign: 'center' },
  // Background only — CoverFrame supplies the hero ratio, height cap and
  // clipping, so the preview matches exactly what Activity Detail renders.
  coverPreview: { backgroundColor: theme.background.surface },
  coverPreviewFill: { flex: 1 },
  generatedTitleRow: { gap: spacing.xs },
  generatedTitle: { ...typography.headline, color: theme.text.primary },
  customizeLink: { ...typography.footnote, color: theme.brand.primary },
  revertTitleLink: { marginTop: spacing.xs },
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
  moreSection: { gap: spacing.lg },
  reviewBlock: { gap: spacing.md },
  reviewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.border.default,
  },
  reviewLabel: { ...typography.footnote, color: theme.text.secondary },
  reviewValue: { ...typography.bodyMedium, color: theme.text.primary, flexShrink: 1, textAlign: 'right' },
  editDetailsLink: { alignItems: 'center', paddingVertical: spacing.sm },
});
