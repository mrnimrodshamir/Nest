import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, StyleSheet } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import MapView from 'react-native-maps';
import { Camera, MapPin } from 'phosphor-react-native';
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
import type { SelectedActivityLocation } from '@/types/place';
import {
  legacyFieldsToSelectedLocation,
  normalizedPlaceToSelectedLocation,
  selectedLocationToNormalizedPlace,
} from '@/utils/activityPlaceMapping';
import { createManualPlace } from '@/utils/normalizedPlace';
import { presentSelectedLocation } from '@/utils/locationPresentation';
import { applyReverseGeocodeLabel, moveSelectedLocation } from '@/utils/placeAdjustment';
import { formatDuration } from '@/utils/formatDuration';
import { pickDefaultChild } from '@/utils/pickDefaultChild';
import { generateActivityTitle } from '@/utils/generateActivityTitle';
import { formatExactStartTime } from '@/utils/formatExactStartTime';
import type { CreateActivityInput, CreateActivityStage } from '@/hooks/useCreateActivity';
import {
  resolveActivityFormMode,
  startTimeValidationMessage,
} from '@/utils/activityFormMode';

const STAGE_LABELS: Record<CreateActivityStage, string> = {
  saving: 'Saving…',
  compressing: 'Preparing your photo…',
  uploading: 'Uploading your photo…',
};

export interface ActivityFormSeedValues {
  activityType: ActivityCategory;
  description: string;
  durationMinutes: number;
  latitude: number;
  longitude: number;
  locationName: string;
  selectedLocation?: SelectedActivityLocation;
  maxParticipants: number | null;
  babyMinAgeMonths: number | null;
  babyMaxAgeMonths: number | null;
  notes: string;
  coverImageUrl?: string | null;
}

export interface ActivityFormEditValues extends ActivityFormSeedValues {
  title: string;
  startsAt: Date;
  hostChildIds: string[];
}

interface ActivityFormSharedProps {
  submitLabel: string;
  isSubmitting: boolean;
  stage?: CreateActivityStage | 'saving' | null;
  error: string | null;
  onSubmit: (input: CreateActivityInput) => void;
  /** Extra actions rendered below the submit button (e.g. Cancel activity) */
  footer?: React.ReactNode;
}

type ActivityFormProps = ActivityFormSharedProps & (
  | { mode: 'create'; initialLocation: { latitude: number; longitude: number }; initialValues?: ActivityFormSeedValues }
  | { mode: 'edit'; initialValues: ActivityFormEditValues; initialLocation?: never }
  | { mode: 'again'; initialValues: ActivityFormSeedValues; initialLocation?: never }
);

export function ActivityForm({
  mode,
  initialValues,
  initialLocation,
  submitLabel,
  isSubmitting,
  stage,
  error,
  onSubmit,
  footer,
}: ActivityFormProps) {
  const behavior = resolveActivityFormMode(mode);
  const editValues = mode === 'edit' ? initialValues : null;
  const [reviewMode, setReviewMode] = useState(false);

  const { session } = useAuth();
  const { children } = useChildren(session?.user.id ?? null);
  const [hostChildIds, setHostChildIds] = useState<string[]>(editValues?.hostChildIds ?? []);
  // Auto-select the host's default (or only) child the first time their
  // children finish loading — never for Edit, which pre-loads the
  // activity's real existing selection via initialValues.hostChildIds.
  // Fires once; after that the host's own taps are never overridden.
  const didAutoSelectChild = useRef(false);
  useEffect(() => {
    if (!behavior.autoSelectsCurrentDefaultChild) return;
    if (didAutoSelectChild.current) return;
    const defaultChild = pickDefaultChild(children);
    if (!defaultChild) return;
    didAutoSelectChild.current = true;
    setHostChildIds([defaultChild.id]);
  }, [behavior.autoSelectsCurrentDefaultChild, children]);

  const [activityType, setActivityType] = useState<ActivityCategory>(
    initialValues?.activityType ?? 'stroller_walk',
  );
  const [coverUri, setCoverUri] = useState<string | null>(null);

  // The title is generated from type + date/time + location and kept in
  // sync automatically — a host only ever types one by hand if they tap
  // "Customize title" (and can tap back to "Use automatic title" any
  // time). Editing an existing activity starts customized (it already
  // has a real title) so it's never silently rewritten.
  const [titleCustomized, setTitleCustomized] = useState(mode === 'edit');
  const [title, setTitle] = useState(editValues?.title ?? '');

  // "Details" is the one optional free-text field — for an existing
  // activity being edited, fall back to its legacy `notes` value if
  // `description` is empty, so pre-merge activities don't appear to have
  // silently lost that text. New activities only ever write to
  // `description` going forward (see useCreateActivity.ts).
  const [description, setDescription] = useState(
    initialValues?.description || initialValues?.notes || '',
  );
  const [startsAt, setStartsAt] = useState(() => {
    if (editValues) return editValues.startsAt;
    const d = new Date();
    d.setHours(d.getHours() + 2, 0, 0, 0);
    return d;
  });
  const [hasSelectedStartTime, setHasSelectedStartTime] = useState(mode !== 'again');
  const initialDuration = initialValues?.durationMinutes ?? 60;
  const [durationMinutes, setDurationMinutes] = useState<number>(initialDuration);
  const [customDuration, setCustomDuration] = useState(
    !(DURATION_OPTIONS_MINUTES as readonly number[]).includes(initialDuration),
  );
  const [selectedLocation, setSelectedLocation] = useState<SelectedActivityLocation>(() =>
    initialValues?.selectedLocation ?? (mode === 'create'
      ? normalizedPlaceToSelectedLocation(createManualPlace({
          latitude: initialLocation?.latitude ?? 32.0853,
          longitude: initialLocation?.longitude ?? 34.7818,
        }))
      : legacyFieldsToSelectedLocation({
          addressLabel: initialValues?.locationName ?? '',
          latitude: initialValues?.latitude ?? 32.0853,
          longitude: initialValues?.longitude ?? 34.7818,
        })),
  );
  const { latitude, longitude, displayName: locationName } = selectedLocation;
  const locationPresentation = presentSelectedLocation(selectedLocation);
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
    if (titleCustomized || !hasSelectedStartTime) return;
    setTitle(generateActivityTitle(activityType, startsAt, locationName));
  }, [activityType, startsAt, hasSelectedStartTime, locationName, titleCustomized]);

  const validateEssentials = () => {
    const startTimeError = startTimeValidationMessage(mode, hasSelectedStartTime);
    if (startTimeError) return setValidationError(startTimeError), false;
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
      place: selectedLocationToNormalizedPlace({ ...selectedLocation, displayName: locationName.trim() }),
      maxParticipants: noLimit ? null : maxParticipants,
      babyMinAgeMonths: anyAge ? null : minYears * 12 + minMonths,
      babyMaxAgeMonths: anyAge ? null : maxYears * 12 + maxMonths,
      notes: initialValues?.notes ?? '',
      coverUri,
      coverImageUrl: initialValues?.coverImageUrl ?? null,
      hostChildIds,
    });
  };

  const handlePrimaryPress = () => {
    if (behavior.showsReview && !reviewMode) {
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

  const reviewDateTimeSummary = hasSelectedStartTime ? formatExactStartTime(startsAt.toISOString()) : '';

  const reviewChildSummary =
    hostChildIds.length === 0
      ? 'Coming alone'
      : children
          .filter((c) => hostChildIds.includes(c.id))
          .map((c) => c.name)
          .join(', ') || 'Coming alone';

  const primaryLabel = isSubmitting && stage ? STAGE_LABELS[stage] : behavior.showsReview && !reviewMode ? 'Review' : submitLabel;

  return (
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      {behavior.showsReview && reviewMode ? (
        <View style={styles.reviewBlock}>
          <CoverFrame variant="hero" radius={radius.lg} style={styles.coverPreview}>
            <CoverImage url={coverUri ?? initialValues?.coverImageUrl ?? null} fallbackCategory={activityType} variant="hero" surface="ReviewStep" style={styles.coverPreviewFill} />
          </CoverFrame>
          <Text style={styles.generatedTitle}>{title}</Text>

          <ReviewRow label="Category" value={CATEGORY_LABELS[activityType] ?? CATEGORY_LABELS.other} />
          <ReviewRow label="When" value={reviewDateTimeSummary} />
          <ReviewRow label="Duration" value={formatDuration(durationMinutes)} />
          <ReviewRow label="Location" value={locationPresentation.title} />
          {locationPresentation.address ? (
            <ReviewRow label="Address" value={locationPresentation.address} />
          ) : null}
          <View style={styles.reviewMapWrapper}>
            <MapView
              style={styles.reviewMap}
              region={{ latitude, longitude, latitudeDelta: 0.02, longitudeDelta: 0.02 }}
              scrollEnabled={false}
              zoomEnabled={false}
              rotateEnabled={false}
              pitchEnabled={false}
              pointerEvents="none"
            />
            <View style={styles.reviewMapPin} pointerEvents="none">
              <MapPin size={28} color={theme.brand.primary} weight="fill" />
            </View>
          </View>
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
              {mode !== 'edit' && (
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
            onChange={(date) => {
              setStartsAt(date);
              setHasSelectedStartTime(true);
            }}
            minimumDate={new Date()}
            hasValue={hasSelectedStartTime}
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
              setSelectedLocation((current) => moveSelectedLocation(current, { latitude: lat, longitude: lng }));
            }}
            onChangeLocationName={(name) => {
              setSelectedLocation((current) => applyReverseGeocodeLabel(current, name));
            }}
            onSelectPlace={(place) => setSelectedLocation(normalizedPlaceToSelectedLocation(place))}
            selectedLocation={selectedLocation}
            autoCenterOnMount={mode === 'create'}
          />
          <Field label="Location name">
            <TextInput
              style={styles.input}
              placeholder="e.g. HaYarkon Park, main entrance"
              placeholderTextColor={theme.text.muted}
              value={locationName}
              onChangeText={(name) => {
                setSelectedLocation((current) => ({ ...current, displayName: name }));
              }}
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
  reviewMapWrapper: { height: 150, borderRadius: radius.lg, overflow: 'hidden' },
  reviewMap: { flex: 1 },
  reviewMapPin: { position: 'absolute', top: '50%', left: '50%', marginLeft: -14, marginTop: -28 },
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
