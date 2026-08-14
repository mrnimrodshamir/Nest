-- Separate provider presence from NestUp publication eligibility.
-- A complete DigiTel response carries every structurally valid candidate with
-- eligibleForNestupPublication=true/false. Present-but-excluded occurrences
-- are hidden from Discovery, refreshed, and NEVER marked missing.

create or replace function public.apply_complete_digitel_sync(
  p_run_id uuid,
  p_observed_at timestamptz,
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
  v_matches integer;
  v_candidate_matches integer;
  v_inserted integer := 0;
  v_updated integer := 0;
  v_unchanged integer := 0;
  v_missing integer := 0;
  v_archived integer := 0;
  v_cleaned integer := 0;
  v_preserved integer := 0;
  v_excluded_present integer := 0;
  v_unpublished integer := 0;
  v_affected integer := 0;
  v_was_published boolean;
begin
  if p_run_id is null or p_observed_at is null or jsonb_typeof(p_candidates) <> 'array' then
    raise exception 'Invalid complete DigiTel sync input';
  end if;
  if not exists (select 1 from public.provider_sync_runs where id = p_run_id and provider = 'tel_aviv_digitel' and status = 'running') then
    raise exception 'Unknown or completed DigiTel sync run';
  end if;

  create temporary table digitel_seen_fingerprints (fingerprint text primary key) on commit drop;

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
    then raise exception 'Malformed DigiTel candidate identity'; end if;

    insert into digitel_seen_fingerprints values (v_candidate->>'occurrenceFingerprint');
    v_event_id := null;
    v_occurrence_id := null;

    -- Exact content fingerprint remains the first identity anchor.
    select occurrence.id, occurrence.event_id into v_occurrence_id, v_event_id
    from public.event_occurrences occurrence
    join public.events event on event.id = occurrence.event_id
    where event.provider = 'tel_aviv_digitel'
      and occurrence.occurrence_fingerprint = v_candidate->>'occurrenceFingerprint'
    limit 1;

    -- NbrId is not unique alone. NbrId + occurrence time is a stable fallback
    -- when title/address/coordinates change the normalized fingerprint.
    if v_occurrence_id is null and nullif(trim(v_candidate->>'sourceGroupId'), '') is not null then
      select count(*) into v_candidate_matches
      from jsonb_array_elements(p_candidates) source_candidate
      where source_candidate->>'sourceGroupId' = v_candidate->>'sourceGroupId'
        and (source_candidate->>'startsAt')::timestamptz = (v_candidate->>'startsAt')::timestamptz;
      select count(*) into v_matches
      from public.event_occurrences occurrence
      join public.events event on event.id = occurrence.event_id
      where event.provider = 'tel_aviv_digitel'
        and event.source_group_id = v_candidate->>'sourceGroupId'
        and occurrence.starts_at = (v_candidate->>'startsAt')::timestamptz;
      if v_matches = 1 and v_candidate_matches = 1 then
        select occurrence.id, occurrence.event_id into v_occurrence_id, v_event_id
        from public.event_occurrences occurrence
        join public.events event on event.id = occurrence.event_id
        where event.provider = 'tel_aviv_digitel'
          and event.source_group_id = v_candidate->>'sourceGroupId'
          and occurrence.starts_at = (v_candidate->>'startsAt')::timestamptz
        limit 1;
      end if;
    end if;

    if not (v_candidate->>'eligibleForNestupPublication')::boolean then
      if v_occurrence_id is not null then
        select publication_status = 'published' and is_visible into v_was_published
        from public.events where id = v_event_id;
        update public.event_occurrences set
          occurrence_fingerprint = v_candidate->>'occurrenceFingerprint',
          starts_at = (v_candidate->>'startsAt')::timestamptz,
          source_updated_at = nullif(v_candidate->>'sourceUpdatedAt','')::timestamptz,
          last_seen_at = p_observed_at, missing_since = null, archived_at = null,
          updated_at = p_observed_at
        where id = v_occurrence_id;
        update public.events set
          source_group_id = nullif(v_candidate->>'sourceGroupId',''),
          last_seen_at = p_observed_at, publication_status = 'staged',
          is_visible = false, updated_at = p_observed_at
        where id = v_event_id;
        v_excluded_present := v_excluded_present + 1;
        if v_was_published then v_unpublished := v_unpublished + 1; end if;
      end if;
      continue;
    end if;

    if v_event_id is null then
      select id into v_event_id from public.events
      where provider = 'tel_aviv_digitel' and provider_event_id = v_candidate->>'providerEventId'
      limit 1;
    end if;

    if v_event_id is null then
      insert into public.events (
        title, description, category, image_url, age_min_months, age_max_months, price_note,
        registration_required, registration_url, verification_status, publication_status, is_visible,
        event_status, cancellation_reason, provider, provider_event_id, provider_transport_id,
        source_group_id, source_name, source_url, source_published_at, source_updated_at, provider_metadata,
        is_recurring, recurrence_rule, recurrence_timezone, recurrence_series_id, place_id,
        location_name, formatted_address, latitude, longitude, deduplication_key, import_batch_id,
        first_seen_at, last_seen_at, created_at, updated_at
      ) values (
        v_candidate->>'title', nullif(v_candidate->>'description',''), v_candidate->>'category', null,
        null, null, null, null, null, 'verified', 'published', true, 'scheduled', null,
        'tel_aviv_digitel', v_candidate->>'providerEventId', v_candidate->>'providerTransportId',
        nullif(v_candidate->>'sourceGroupId',''), 'Tel Aviv DigiTel', v_candidate->>'sourceUrl',
        nullif(v_candidate->>'sourcePublishedAt','')::timestamptz, nullif(v_candidate->>'sourceUpdatedAt','')::timestamptz,
        coalesce(v_candidate->'providerMetadata','{}'::jsonb), false, null, 'Asia/Jerusalem', null, null,
        v_candidate->>'locationName', null, (v_candidate->>'latitude')::double precision,
        (v_candidate->>'longitude')::double precision, v_candidate->>'occurrenceFingerprint', p_run_id::text,
        p_observed_at, p_observed_at, p_observed_at, p_observed_at
      ) returning id into v_event_id;
      v_inserted := v_inserted + 1;
    else
      update public.events set
        title = v_candidate->>'title', description = nullif(v_candidate->>'description',''),
        category = v_candidate->>'category', provider_event_id = v_candidate->>'providerEventId',
        deduplication_key = v_candidate->>'occurrenceFingerprint',
        source_group_id = nullif(v_candidate->>'sourceGroupId',''), source_url = v_candidate->>'sourceUrl',
        source_published_at = nullif(v_candidate->>'sourcePublishedAt','')::timestamptz,
        source_updated_at = nullif(v_candidate->>'sourceUpdatedAt','')::timestamptz,
        provider_metadata = coalesce(v_candidate->'providerMetadata','{}'::jsonb),
        location_name = v_candidate->>'locationName', latitude = (v_candidate->>'latitude')::double precision,
        longitude = (v_candidate->>'longitude')::double precision, last_seen_at = p_observed_at,
        publication_status = 'published', verification_status = 'verified', is_visible = true, updated_at = p_observed_at
      where id = v_event_id and (
        title, description, category, provider_event_id, deduplication_key, source_group_id, source_url,
        source_published_at, source_updated_at, provider_metadata, location_name, latitude, longitude,
        publication_status, verification_status, is_visible
      ) is distinct from (
        v_candidate->>'title', nullif(v_candidate->>'description',''), v_candidate->>'category',
        v_candidate->>'providerEventId', v_candidate->>'occurrenceFingerprint',
        nullif(v_candidate->>'sourceGroupId',''), v_candidate->>'sourceUrl',
        nullif(v_candidate->>'sourcePublishedAt','')::timestamptz, nullif(v_candidate->>'sourceUpdatedAt','')::timestamptz,
        coalesce(v_candidate->'providerMetadata','{}'::jsonb), v_candidate->>'locationName',
        (v_candidate->>'latitude')::double precision, (v_candidate->>'longitude')::double precision,
        'published', 'verified', true
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
        original_starts_at, occurrence_status, cancellation_reason, source_updated_at,
        provider_metadata, import_batch_id, last_seen_at, missing_since, archived_at, created_at, updated_at
      ) values (
        v_candidate->>'occurrenceId', v_event_id, v_candidate->>'providerTransportId',
        v_candidate->>'occurrenceFingerprint', (v_candidate->>'startsAt')::timestamptz,
        nullif(v_candidate->>'endsAt','')::timestamptz, null, 'scheduled', null,
        nullif(v_candidate->>'sourceUpdatedAt','')::timestamptz,
        coalesce(v_candidate->'providerMetadata','{}'::jsonb), p_run_id::text,
        p_observed_at, null, null, p_observed_at, p_observed_at
      );
    else
      update public.event_occurrences set
        occurrence_fingerprint = v_candidate->>'occurrenceFingerprint',
        starts_at = (v_candidate->>'startsAt')::timestamptz,
        ends_at = nullif(v_candidate->>'endsAt','')::timestamptz,
        source_updated_at = nullif(v_candidate->>'sourceUpdatedAt','')::timestamptz,
        provider_metadata = coalesce(v_candidate->'providerMetadata','{}'::jsonb),
        last_seen_at = p_observed_at, missing_since = null, archived_at = null, updated_at = p_observed_at
      where id = v_occurrence_id;
    end if;
  end loop;

  update public.event_occurrences occurrence set missing_since = p_observed_at
  from public.events event
  where occurrence.event_id = event.id and event.provider = 'tel_aviv_digitel'
    and occurrence.archived_at is null and coalesce(occurrence.ends_at, occurrence.starts_at) >= p_observed_at
    and occurrence.missing_since is null
    and not exists (select 1 from digitel_seen_fingerprints seen where seen.fingerprint = occurrence.occurrence_fingerprint);
  get diagnostics v_missing = row_count;

  update public.event_occurrences occurrence set archived_at = p_observed_at, updated_at = p_observed_at
  from public.events event
  where occurrence.event_id = event.id and event.provider = 'tel_aviv_digitel'
    and occurrence.archived_at is null and occurrence.missing_since < p_observed_at - interval '3 days'
    and coalesce(occurrence.ends_at, occurrence.starts_at) >= p_observed_at
    and not exists (select 1 from digitel_seen_fingerprints seen where seen.fingerprint = occurrence.occurrence_fingerprint);
  get diagnostics v_archived = row_count;

  update public.event_occurrences occurrence set archived_at = p_observed_at, updated_at = p_observed_at
  from public.events event
  where occurrence.event_id = event.id and event.provider = 'tel_aviv_digitel'
    and occurrence.archived_at is null
    and coalesce(occurrence.ends_at, occurrence.starts_at) < p_observed_at - interval '30 days'
    and exists (select 1 from public.event_attendees attendee where attendee.event_occurrence_id = occurrence.id);
  get diagnostics v_preserved = row_count;

  delete from public.event_occurrences occurrence using public.events event
  where occurrence.event_id = event.id and event.provider = 'tel_aviv_digitel'
    and coalesce(occurrence.ends_at, occurrence.starts_at) < p_observed_at - interval '30 days'
    and not exists (select 1 from public.event_attendees attendee where attendee.event_occurrence_id = occurrence.id);
  get diagnostics v_cleaned = row_count;

  delete from public.events event
  where event.provider = 'tel_aviv_digitel'
    and not exists (select 1 from public.event_occurrences occurrence where occurrence.event_id = event.id);

  return jsonb_build_object(
    'inserted', v_inserted, 'updated', v_updated, 'unchanged', v_unchanged,
    'missing', v_missing, 'archived', v_archived, 'cleaned', v_cleaned,
    'preserved', v_preserved, 'excludedPresent', v_excluded_present,
    'unpublished', v_unpublished
  );
end;
$$;

revoke all on function public.apply_complete_digitel_sync(uuid, timestamptz, jsonb) from public, anon, authenticated;
grant execute on function public.apply_complete_digitel_sync(uuid, timestamptz, jsonb) to service_role;

comment on function public.apply_complete_digitel_sync(uuid, timestamptz, jsonb) is
  'Atomic DigiTel sync with provider presence separated from NestUp publication eligibility.';

-- ROLLBACK (review and run manually only): reapply the function definition from
-- 20260814120000_digitel_sync_executor.sql. No table or row rollback is needed.
