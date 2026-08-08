-- NestUp RSVP for external / municipal Events.
--
-- SCOPE: this records that a NestUp parent said they are going. It is NOT
-- registration with the municipality, DigiTel, the venue, the organiser or a
-- ticket provider. External registration remains a separate link on the Event,
-- untouched by this migration.
--
-- WHY A DEDICATED TABLE rather than reusing activity_attendees:
--   * activity_attendees.activity_id is a uuid FK to activities, while
--     event_occurrences.id is TEXT (provider-derived). They cannot share a
--     column without dropping referential integrity for one of them.
--   * activity_attendees carries child selections, going/attended lifecycle
--     and capacity triggers. Events have no capacity we control and no child
--     roster, so those columns would be permanently null and the capacity
--     trigger would need an exception path.
--   * Coupling them would put external-content writes on the same table as the
--     race-safe join_activity RPC. Keeping them apart means this migration
--     provably cannot affect Activity attendance.
--
-- ADDITIVE AND REVERSIBLE: creates one table, one index and three policies.
-- Touches no existing table, column, policy, function or row.
--
-- ROLLBACK:  drop table if exists public.event_attendees;
--            (No other object is modified, so nothing else needs undoing.)

create table if not exists public.event_attendees (
  id uuid primary key default gen_random_uuid(),
  -- TEXT to match event_occurrences.id, which is provider-derived rather than
  -- a generated uuid. Cascade so removing an occurrence cleans up its RSVPs.
  event_occurrence_id text not null references public.event_occurrences(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  -- Beta ships exactly one status. The CHECK makes "interested"/"maybe"/
  -- "waitlist" impossible to write without a deliberate future migration,
  -- rather than leaving the column open to drift.
  status text not null default 'going' check (status = 'going'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Makes duplicate RSVPs impossible at the database level, so a double tap or
  -- a retried request cannot produce two rows.
  unique (event_occurrence_id, user_id)
);

create index if not exists event_attendees_occurrence_idx
  on public.event_attendees (event_occurrence_id);
create index if not exists event_attendees_user_idx
  on public.event_attendees (user_id);

alter table public.event_attendees enable row level security;

-- READ: any signed-in parent can see who else from NestUp is going. Events are
-- public, published content, and this is the whole point of the social layer.
-- The row exposes only a user_id; every profile field still comes from
-- public_profiles, which enforces its own privacy contract.
drop policy if exists event_attendees_select_authenticated on public.event_attendees;
create policy event_attendees_select_authenticated on public.event_attendees
  for select to authenticated
  using (true);

-- WRITE: auth.uid() is the security boundary, NOT a client-supplied id. A
-- request claiming someone else's user_id fails the WITH CHECK.
drop policy if exists event_attendees_insert_self on public.event_attendees;
create policy event_attendees_insert_self on public.event_attendees
  for insert to authenticated
  with check (user_id = (select auth.uid()));

-- DELETE: you may withdraw only your own RSVP.
drop policy if exists event_attendees_delete_self on public.event_attendees;
create policy event_attendees_delete_self on public.event_attendees
  for delete to authenticated
  using (user_id = (select auth.uid()));

-- No UPDATE policy: status has exactly one legal value, so an RSVP is created
-- or removed, never edited. Anything else falls to RLS default-deny.
