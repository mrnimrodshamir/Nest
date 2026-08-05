import type { EventDetails } from '@/types/event';
import { EVENT_CATEGORY_LABELS } from '@/types/event';
import { EVENT_LIFECYCLE_LABELS } from '@/utils/eventLifecycle';

export interface EventDetailsPresentation {
  title: string;
  description: string | null;
  categoryLabel: string;
  lifecycleLabel: string;
  dateLabel: string;
  timeLabel: string;
  locationName: string;
  addressLabel: string | null;
  recurrenceLabel: string | null;
  cancellationMessage: string | null;
  sourceLabel: string | null;
  sourceUrl: string | null;
  registrationUrl: string | null;
  registrationLabel: string | null;
}

export function buildEventDetailsPresentation(event: EventDetails, locale = 'en-IL'): EventDetailsPresentation {
  const timezone = event.recurrence.timezone;
  const start = new Date(event.occurrence.startsAt);
  if (Number.isNaN(start.getTime())) throw new Error('Invalid event start time');
  const end = event.occurrence.endsAt ? new Date(event.occurrence.endsAt) : null;
  if (end && Number.isNaN(end.getTime())) throw new Error('Invalid event end time');
  const dateLabel = new Intl.DateTimeFormat(locale, {
    weekday: 'long', month: 'long', day: 'numeric', timeZone: timezone,
  }).format(start);
  const startLabel = new Intl.DateTimeFormat(locale, {
    hour: 'numeric', minute: '2-digit', timeZone: timezone,
  }).format(start);
  const endLabel = end ? new Intl.DateTimeFormat(locale, {
    hour: 'numeric', minute: '2-digit', timeZone: timezone,
  }).format(end) : null;
  const cancellationReason = event.occurrence.cancellationReason ?? event.cancellationReason;
  const sourceUrl = safeHttpsUrl(event.source.sourceUrl);
  return {
    title: event.title,
    description: event.description,
    categoryLabel: event.category ? EVENT_CATEGORY_LABELS[event.category] : 'Event',
    lifecycleLabel: EVENT_LIFECYCLE_LABELS[event.lifecycle],
    dateLabel,
    timeLabel: endLabel ? `${startLabel}–${endLabel}` : startLabel,
    locationName: event.location.name ?? 'Location to be confirmed',
    addressLabel: event.location.formattedAddress,
    recurrenceLabel: event.recurrence.isRecurring ? 'Part of a recurring series' : null,
    cancellationMessage: event.lifecycle === 'cancelled'
      ? cancellationReason ?? 'The organizer cancelled this event.'
      : event.lifecycle === 'postponed'
        ? 'The organizer postponed this event. Check the official source for updates.'
        : null,
    sourceLabel: event.source.sourceName ? `Source: ${event.source.sourceName}` : sourceUrl ? 'Official source' : null,
    sourceUrl,
    registrationUrl: safeHttpsUrl(event.registrationUrl),
    registrationLabel: event.registrationRequired === true ? 'Registration required' : event.registrationUrl ? 'Event information' : null,
  };
}

function safeHttpsUrl(value: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' ? url.toString() : null;
  } catch {
    return null;
  }
}
