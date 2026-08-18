-- Generic provider sync reconciliation — the shared, fail-closed persistence
-- boundary that any provider's connector calls after a fetch, so that adding
-- provider #2 (and #3, #4...) never means duplicating lifecycle, missing/
-- archive/retention logic, or RSVP protection.
--
-- Deliberately a NEW function rather than a generalization of
-- apply_complete_digitel_sync. That function is live, scheduled every six
-- hours, and currently the only thing writing to a table real users see.
-- Rewriting it to be provider-generic and re-verifying it behaves identically
-- for DigiTel is real risk for zero benefit this phase — DigiTel keeps
-- calling its own function, unmodified, on its own untouched schedule. This
-- function is what every NEW provider calls instead. DigiTel can be migrated
-- onto it later, deliberately, as its own reviewed change.
--
-- Simpler than the DigiTel reconcile function by one axis: DigiTel's NbrId
-- group + occurrence-time fallback exists because ArcGIS content can mutate
-- in ways that change the deterministic fingerprint while the underlying
-- record is unchanged. A provider whose connector supplies a stable native
-- identifier (Beit Ariela's URL slug, for instance) has no equivalent
-- problem, so that fallback is intentionally not reproduced here. A future
-- provider that needs it can extend this function's matching, or gain its
-- own, without disturbing DigiTel or Beit Ariela.
--
-- THE CENTRAL SAFETY RULE, restated for a second provider: nothing
-- destructive may be decided from an incomplete fetch. Everything below the
-- upsert loop is gated on p_source_complete = true and returns untouched
-- counts otherwise.

create or replace function public.apply_complete_provider_sync(
  p_provider text,
  p_run_id uuid,
  p_observed_at timestamptz,
  p_source_complete boolean,
  p_candidates jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_candidate jsonb;
  v_event_id uuid;
  v_occurrence_id text;
  v_was_published boolean;
  v_affected integer;
  v_inserted integer := 0;
  v_updated integer := 0;
  v_unchanged integer := 0;
  v_excluded_present integer := 0;
  v_unpublished integer := 0;
  v_missing integer := 0;
  v_archived integer := 0;
  v_cleaned integer := 0;
  v_preserved integer := 0;
begin
  if p_provider is null or trim(p_provider) = '' then
    raise exception 'apply_complete_provider_sync requires a provider key';
  end if;
  if p_run_id is null or p_observed_at is null or jsonb_typeof(p_candidates) <> 'array' then
    raise exception 'Invalid provider sync input';
  end if;
  if not exists (
    select 1 from public.provider_sync_runs
    where id = p_run_id and provider = p_provider and status = 'running'
  ) then
    raise exception 'Unknown or already-completed sync run for provider %', p_provider;
  end if;
  if not exists (select 1 from public.provider_registry where key = p_provider and enabled) then
    raise exception 'Provider % is not enabled in provider_registry', p_provider;
  end if;

  create temporary table provider_seen_fingerprints (fingerprint text primary key) on commit drop;

  for v_candidate in select value from jsonb_array_elements(p_candidates)
  loop
    if jsonb_typeof(v_candidate->'eligibleForNestupPublication') <> 'boolean'
      or nullif(trim(v_candidate->>'providerEventId'), '') is null
      or nullif(trim(v_candidate->>'providerTransportId'), '') is null
      or nullif(trim(v_candidate->>'occurrenceId'), '') is null
      or nullif(trim(v_candidate->>'occurrenceFingerprint'), '') is null
      or nullif(trim(v_candidate->>'title'), '') is null
      or nullif(trim(v_candidate->>'sourceUrl'), '') is null
      or nullif(trim(v_candidate->>'locationName'), '') is null
      or nullif(trim(v_candidate->>'sourceType'), '') is null
    then raise exception 'Malformed provider candidate identity for %', p_provider; end if;

    insert into provider_seen_fingerprints values (v_candidate->>'occurrenceFingerprint')
      on conflict do nothing;
    v_event_id := null;
    v_occurrence_id := null;

    select occurrence.id, occurrence.event_id into v_occurrence_id, v_event_id
    from public.event_occurrences occurrence
    join public.events event on event.id = occurrence.event_id
    where event.provider = p_provider
      and occurrence.occurrence_fingerprint = v_candidate->>'occurrenceFingerprint'
    limit 1;

    if v_occurrence_id is null then
      select id into v_event_id from public.events
      where provider = p_provider and provider_event_id = v_candidate->>'providerEventId'
      limit 1;
    end if;

    -- Present but not currently eligible: refresh last_seen, keep unpublished.
    -- Mirrors the DigiTel rule that "seen but excluded" is not the same as
    -- "missing" — a source returning a record NestUp chooses not to publish
    -- must never be treated as the source withdrawing it.
    if not (v_candidate->>'eligibleForNestupPublication')::boolean then
      if v_event_id is not null then
        select publication_status = 'published' and is_visible into v_was_published
        from public.events where id = v_event_id;
        update public.event_occurrences set
          occurrence_fingerprint = v_candidate->>'occurrenceFingerprint',
          starts_at = (v_candidate->>'startsAt')::timestamptz,
          ends_at = nullif(v_candidate->>'endsAt', '')::timestamptz,
          source_updated_at = nullif(v_candidate->>'sourceUpdatedAt', '')::timestamptz,
          last_seen_at = p_observed_at, missing_since = null, archived_at = null,
          updated_at = p_observed_at
        where id = v_occurrence_id;
        update public.events set
          last_seen_at = p_observed_at, publication_status = 'staged', is_visible = false,
          updated_at = p_observed_at
        where id = v_event_id;
        v_excluded_present := v_excluded_present + 1;
        if v_was_published then v_unpublished := v_unpublished + 1; end if;
      end if;
      continue;
    end if;

    if v_event_id is null then
      insert into public.events (
        title, description, category, image_url, age_min_months, age_max_months, price_note,
        registration_required, registration_url, verification_status, publication_status, is_visible,
        event_status, provider, provider_event_id, provider_transport_id, source_type, provider_url,
        source_name, source_url, source_published_at, source_updated_at, provider_metadata,
        is_recurring, recurrence_timezone, place_id, location_name, formatted_address,
        latitude, longitude, deduplication_key, import_batch_id, first_seen_at, last_seen_at,
        created_at, updated_at
      ) values (
        v_candidate->>'title', nullif(v_candidate->>'description', ''), v_candidate->>'category', null,
        nullif(v_candidate->>'ageMinMonths', '')::integer, nullif(v_candidate->>'ageMaxMonths', '')::integer,
        nullif(v_candidate->>'priceNote', ''), nullif(v_candidate->>'registrationRequired', '')::boolean,
        nullif(v_candidate->>'registrationUrl', ''), 'verified', 'published', true, 'scheduled',
        p_provider, v_candidate->>'providerEventId', v_candidate->>'providerTransportId',
        v_candidate->>'sourceType', nullif(v_candidate->>'providerUrl', ''),
        v_candidate->>'sourceName', v_candidate->>'sourceUrl',
        nullif(v_candidate->>'sourcePublishedAt', '')::timestamptz,
        nullif(v_candidate->>'sourceUpdatedAt', '')::timestamptz,
        coalesce(v_candidate->'providerMetadata', '{}'::jsonb),
        false, 'Asia/Jerusalem', null, v_candidate->>'locationName', nullif(v_candidate->>'formattedAddress', ''),
        (v_candidate->>'latitude')::double precision, (v_candidate->>'longitude')::double precision,
        v_candidate->>'occurrenceFingerprint', p_run_id::text, p_observed_at, p_observed_at,
        p_observed_at, p_observed_at
      ) returning id into v_event_id;
      v_inserted := v_inserted + 1;
    else
      update public.events set
        title = v_candidate->>'title', description = nullif(v_candidate->>'description', ''),
        category = v_candidate->>'category', provider_event_id = v_candidate->>'providerEventId',
        age_min_months = nullif(v_candidate->>'ageMinMonths', '')::integer,
        age_max_months = nullif(v_candidate->>'ageMaxMonths', '')::integer,
        price_note = nullif(v_candidate->>'priceNote', ''),
        registration_required = nullif(v_candidate->>'registrationRequired', '')::boolean,
        registration_url = nullif(v_candidate->>'registrationUrl', ''),
        deduplication_key = v_candidate->>'occurrenceFingerprint',
        source_url = v_candidate->>'sourceUrl',
        source_published_at = nullif(v_candidate->>'sourcePublishedAt', '')::timestamptz,
        source_updated_at = nullif(v_candidate->>'sourceUpdatedAt', '')::timestamptz,
        provider_metadata = coalesce(v_candidate->'providerMetadata', '{}'::jsonb),
        location_name = v_candidate->>'locationName',
        formatted_address = nullif(v_candidate->>'formattedAddress', ''),
        latitude = (v_candidate->>'latitude')::double precision,
        longitude = (v_candidate->>'longitude')::double precision,
        last_seen_at = p_observed_at, publication_status = 'published', verification_status = 'verified',
        is_visible = true, updated_at = p_observed_at
      where id = v_event_id and (
        title, description, category, provider_event_id, age_min_months, age_max_months, price_note,
        registration_required, registration_url, deduplication_key, source_url, provider_metadata,
        location_name, formatted_address, latitude, longitude, publication_status, verification_status, is_visible
      ) is distinct from (
        v_candidate->>'title', nullif(v_candidate->>'description', ''), v_candidate->>'category',
        v_candidate->>'providerEventId', nullif(v_candidate->>'ageMinMonths', '')::integer,
        nullif(v_candidate->>'ageMaxMonths', '')::integer, nullif(v_candidate->>'priceNote', ''),
        nullif(v_candidate->>'registrationRequired', '')::boolean, nullif(v_candidate->>'registrationUrl', ''),
        v_candidate->>'occurrenceFingerprint', v_candidate->>'sourceUrl',
        coalesce(v_candidate->'providerMetadata', '{}'::jsonb), v_candidate->>'locationName',
        nullif(v_candidate->>'formattedAddress', ''), (v_candidate->>'latitude')::double precision,
        (v_candidate->>'longitude')::double precision, 'published', 'verified', true
      );
      get diagnostics v_affected = row_count;
      if v_affected = 0 then
        update public.events set last_seen_at = p_observed_at where id = v_event_id;
        v_unchanged := v_unchanged + 1;
      else v_updated := v_updated + 1; end if;
    end if;

    if v_occurrence_id is null then
      insert into public.event_occurrences (
        id, event_id, provider_occurrence_id, occurrence_fingerprint, starts_at, ends_at,
        occurrence_status, source_updated_at, provider_metadata, import_batch_id,
        last_seen_at, created_at, updated_at
      ) values (
        v_candidate->>'occurrenceId', v_event_id, v_candidate->>'providerTransportId',
        v_candidate->>'occurrenceFingerprint', (v_candidate->>'startsAt')::timestamptz,
        nullif(v_candidate->>'endsAt', '')::timestamptz, 'scheduled',
        nullif(v_candidate->>'sourceUpdatedAt', '')::timestamptz,
        coalesce(v_candidate->'providerMetadata', '{}'::jsonb), p_run_id::text,
        p_observed_at, p_observed_at, p_observed_at
      );
    else
      update public.event_occurrences set
        occurrence_fingerprint = v_candidate->>'occurrenceFingerprint',
        starts_at = (v_candidate->>'startsAt')::timestamptz,
        ends_at = nullif(v_candidate->>'endsAt', '')::timestamptz,
        source_updated_at = nullif(v_candidate->>'sourceUpdatedAt', '')::timestamptz,
        provider_metadata = coalesce(v_candidate->'providerMetadata', '{}'::jsonb),
        last_seen_at = p_observed_at, missing_since = null, archived_at = null, updated_at = p_observed_at
      where id = v_occurrence_id;
    end if;
  end loop;

  -- Everything below is destructive and therefore gated on completeness.
  if not p_source_complete then
    return jsonb_build_object(
      'inserted', v_inserted, 'updated', v_updated, 'unchanged', v_unchanged,
      'excludedPresent', v_excluded_present, 'unpublished', v_unpublished,
      'missing', 0, 'archived', 0, 'cleaned', 0, 'preserved', 0, 'sourceComplete', false
    );
  end if;

  update public.event_occurrences occurrence set missing_since = p_observed_at
  from public.events event
  where occurrence.event_id = event.id and event.provider = p_provider
    and occurrence.archived_at is null
    and coalesce(occurrence.ends_at, occurrence.starts_at) >= p_observed_at
    and occurrence.missing_since is null
    and not exists (
      select 1 from provider_seen_fingerprints seen
      where seen.fingerprint = occurrence.occurrence_fingerprint
    );
  get diagnostics v_missing = row_count;

  update public.event_occurrences occurrence set archived_at = p_observed_at, updated_at = p_observed_at
  from public.events event
  where occurrence.event_id = event.id and event.provider = p_provider
    and occurrence.archived_at is null
    and occurrence.missing_since < p_observed_at - interval '3 days'
    and coalesce(occurrence.ends_at, occurrence.starts_at) >= p_observed_at
    and not exists (
      select 1 from provider_seen_fingerprints seen
      where seen.fingerprint = occurrence.occurrence_fingerprint
    );
  get diagnostics v_archived = row_count;

  update public.event_occurrences occurrence set archived_at = p_observed_at, updated_at = p_observed_at
  from public.events event
  where occurrence.event_id = event.id and event.provider = p_provider
    and occurrence.archived_at is null
    and coalesce(occurrence.ends_at, occurrence.starts_at) < p_observed_at - interval '30 days'
    and exists (select 1 from public.event_attendees attendee where attendee.event_occurrence_id = occurrence.id);
  get diagnostics v_preserved = row_count;

  delete from public.event_occurrences occurrence using public.events event
  where occurrence.event_id = event.id and event.provider = p_provider
    and coalesce(occurrence.ends_at, occurrence.starts_at) < p_observed_at - interval '30 days'
    and not exists (select 1 from public.event_attendees attendee where attendee.event_occurrence_id = occurrence.id);
  get diagnostics v_cleaned = row_count;

  delete from public.events event
  where event.provider = p_provider
    and not exists (select 1 from public.event_occurrences occurrence where occurrence.event_id = event.id);

  return jsonb_build_object(
    'inserted', v_inserted, 'updated', v_updated, 'unchanged', v_unchanged,
    'excludedPresent', v_excluded_present, 'unpublished', v_unpublished,
    'missing', v_missing, 'archived', v_archived, 'cleaned', v_cleaned, 'preserved', v_preserved,
    'sourceComplete', true
  );
end;
$$;

revoke all on function public.apply_complete_provider_sync(text, uuid, timestamptz, boolean, jsonb) from public, anon, authenticated;
grant execute on function public.apply_complete_provider_sync(text, uuid, timestamptz, boolean, jsonb) to service_role;

comment on function public.apply_complete_provider_sync(text, uuid, timestamptz, boolean, jsonb) is
  'Generic, fail-closed provider sync reconciliation for any provider EXCEPT tel_aviv_digitel, which keeps calling its own unmodified apply_complete_digitel_sync. RSVP-carrying occurrences are never hard-deleted (archived instead). Every destructive branch is gated on p_source_complete.';

-- ROLLBACK (review and run manually only):
-- drop function if exists public.apply_complete_provider_sync(text, uuid, timestamptz, boolean, jsonb);
-- (No table or row is touched by defining this function; nothing calls it yet.)
