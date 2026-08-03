-- Phase 1 / M5 + M7 — capacity enforcement and the child-birthdate leak
--
-- REVIEW BEFORE APPLYING. Not applied to production.
--
-- ⚠️ THIS IS A BREAKING CHANGE FOR BUILD 23 AND EARLIER.
-- Revoking direct writes on activity_attendees will break `leave` in every
-- shipped client, because useActivityRsvp currently issues a raw DELETE.
-- Apply ONLY after a client using leave_activity() is live. See the staged
-- rollout note at the bottom.

-- ---------------------------------------------------------------------
-- 1. leave_activity — the missing counterpart to join_activity
-- ---------------------------------------------------------------------
create or replace function public.leave_activity(p_activity_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  -- Same row lock join_activity takes, so a leave racing a join serialises
  -- instead of interleaving and corrupting the count.
  perform 1 from public.activities where id = p_activity_id for update;

  delete from public.activity_attendees
  where activity_id = p_activity_id and user_id = v_user_id;
end;
$$;

grant execute on function public.leave_activity(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 2. Close the capacity bypass
-- ---------------------------------------------------------------------
-- attendees_insert_self let ANY authenticated client insert straight into
-- activity_attendees with only `auth.uid() = user_id` checked — capacity
-- was never consulted. join_activity's FOR UPDATE lock was correct but
-- entirely bypassable. This is the actual capacity fix.
drop policy if exists attendees_insert_self on public.activity_attendees;
drop policy if exists attendees_delete_self on public.activity_attendees;

-- SELECT and UPDATE policies are intentionally left as-is.

-- ---------------------------------------------------------------------
-- 3. Stop leaking exact child birthdates
-- ---------------------------------------------------------------------
-- get_activity_attendance returned children's full dates of birth to
-- anyone who could view the activity. Replaced with a coarse age in
-- months, which is all the UI ever renders.
drop function if exists public.get_activity_attendance(uuid);

create or replace function public.get_activity_attendance(p_activity_id uuid)
returns table(
  source text, user_id uuid, display_name text, avatar_url text,
  coming_alone boolean, child_id uuid, child_name text, child_age_months integer
)
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
begin
  if not exists (
    select 1 from public.activities a
    where a.id = p_activity_id
      and (a.status <> 'draft' or a.host_id = auth.uid())
  ) then
    return;
  end if;

  return query
  select 'host'::text, a.host_id, p.display_name, p.avatar_url,
         a.host_coming_alone, c.id, c.name,
         case when c.birthdate is null then null
              else (extract(year from age(c.birthdate)) * 12
                  + extract(month from age(c.birthdate)))::integer end
  from public.activities a
  join public.profiles p on p.id = a.host_id
  left join public.activity_host_children hc on hc.activity_id = a.id
  left join public.children c on c.id = hc.child_id
  where a.id = p_activity_id

  union all

  select 'attendee'::text, aa.user_id, p.display_name, p.avatar_url,
         aa.coming_alone, c.id, c.name,
         case when c.birthdate is null then null
              else (extract(year from age(c.birthdate)) * 12
                  + extract(month from age(c.birthdate)))::integer end
  from public.activity_attendees aa
  join public.profiles p on p.id = aa.user_id
  left join public.activity_attendee_children ac on ac.attendee_id = aa.id
  left join public.children c on c.id = ac.child_id
  where aa.activity_id = p_activity_id
    and aa.status in ('going', 'attended');   -- active attendance only
end;
$$;

-- ---------------------------------------------------------------------
-- 4. Index supporting the filtered map/list path
-- ---------------------------------------------------------------------
create index if not exists activities_status_start_time_idx
  on public.activities (status, start_time);

-- ---------------------------------------------------------------------
-- STAGED ROLLOUT (required — do not apply as one step)
-- ---------------------------------------------------------------------
-- Step 1 (safe now):  sections 1, 3 and 4 only. Adds leave_activity,
--                     fixes the birthdate leak, adds the index. Backward
--                     compatible with build 23.
-- Step 2 (after a client using leave_activity is live in TestFlight):
--                     section 2, the policy drops.
-- Applying section 2 early breaks `leave` for every current tester.
--
-- ROLLBACK
-- create policy attendees_insert_self on public.activity_attendees
--   for insert with check ((select auth.uid()) = user_id);
-- create policy attendees_delete_self on public.activity_attendees
--   for delete using ((select auth.uid()) = user_id);
-- drop function if exists public.leave_activity(uuid);
-- drop index if exists public.activities_status_start_time_idx;
-- (get_activity_attendance: restore the prior definition from
--  docs/schema-baseline.sql before re-applying.)
