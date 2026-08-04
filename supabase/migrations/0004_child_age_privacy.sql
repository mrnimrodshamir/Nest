-- Phase 1a / P0 PRIVACY — stop returning exact child birthdates
--
-- PROBLEM
-- get_activity_attendance returned `child_birthdate date` — the exact date
-- of birth of another user's child — to any caller who could view the
-- activity. That is the most sensitive field in the schema and it was on
-- the participants payload.
--
-- FIX
-- Return a derived age only, floored to the precision that is actually
-- displayed, so the caller cannot recover more than the UI shows:
--   < 24 months  -> exact months  (UI renders months; ~30-day window)
--   >= 24 months -> floored to whole years (years * 12; ~365-day window)
-- The raw date never leaves the database. No other returned column
-- contains it, and `children` itself is not directly selectable by other
-- users (children has no permissive SELECT policy for non-owners).
--
-- SCOPE: this migration changes ONLY this function. Attendance write
-- policies, join_activity, exact-location RLS, map queries and
-- spatial_ref_sys are deliberately untouched (deferred to Phase 2).

drop function if exists public.get_activity_attendance(uuid);

create or replace function public.get_activity_attendance(p_activity_id uuid)
returns table(
  source text,
  user_id uuid,
  display_name text,
  avatar_url text,
  coming_alone boolean,
  child_id uuid,
  child_name text,
  child_age_months integer
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
    return; -- not visible to this caller — empty result, not an error
  end if;

  return query
  select
    'host'::text,
    a.host_id,
    p.display_name,
    p.avatar_url,
    a.host_coming_alone,
    c.id,
    c.name,
    case
      when c.birthdate is null then null
      when (extract(year from age(current_date, c.birthdate)) * 12
          + extract(month from age(current_date, c.birthdate))) < 24
        then (extract(year from age(current_date, c.birthdate)) * 12
            + extract(month from age(current_date, c.birthdate)))::integer
      else (extract(year from age(current_date, c.birthdate)) * 12)::integer
    end
  from public.activities a
  join public.profiles p on p.id = a.host_id
  left join public.activity_host_children hc on hc.activity_id = a.id
  left join public.children c on c.id = hc.child_id
  where a.id = p_activity_id

  union all

  select
    'attendee'::text,
    aa.user_id,
    p.display_name,
    p.avatar_url,
    aa.coming_alone,
    c.id,
    c.name,
    case
      when c.birthdate is null then null
      when (extract(year from age(current_date, c.birthdate)) * 12
          + extract(month from age(current_date, c.birthdate))) < 24
        then (extract(year from age(current_date, c.birthdate)) * 12
            + extract(month from age(current_date, c.birthdate)))::integer
      else (extract(year from age(current_date, c.birthdate)) * 12)::integer
    end
  from public.activity_attendees aa
  join public.profiles p on p.id = aa.user_id
  left join public.activity_attendee_children ac on ac.attendee_id = aa.id
  left join public.children c on c.id = ac.child_id
  where aa.activity_id = p_activity_id
    and aa.status = 'going';  -- current active participants only
end;
$$;

grant execute on function public.get_activity_attendance(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- ROLLBACK (restores 0003's month-precision response without restoring the
-- exact-birthdate leak)
-- ---------------------------------------------------------------------
-- drop function if exists public.get_activity_attendance(uuid);
-- create or replace function public.get_activity_attendance(p_activity_id uuid)
-- returns table(source text, user_id uuid, display_name text, avatar_url text,
--               coming_alone boolean, child_id uuid, child_name text,
--               child_age_months integer)
-- language plpgsql security definer set search_path to 'public','pg_temp'
-- as $$ begin
--   if not exists (select 1 from public.activities a where a.id = p_activity_id
--     and (a.status <> 'draft' or a.host_id = auth.uid())) then return; end if;
--   return query
--   select 'host'::text, a.host_id, p.display_name, p.avatar_url,
--          a.host_coming_alone, c.id, c.name,
--          case when c.birthdate is null then null else
--            (extract(year from age(c.birthdate)) * 12
--             + extract(month from age(c.birthdate)))::integer end
--   from public.activities a join public.profiles p on p.id = a.host_id
--   left join public.activity_host_children hc on hc.activity_id = a.id
--   left join public.children c on c.id = hc.child_id
--   where a.id = p_activity_id
--   union all
--   select 'attendee'::text, aa.user_id, p.display_name, p.avatar_url,
--          aa.coming_alone, c.id, c.name,
--          case when c.birthdate is null then null else
--            (extract(year from age(c.birthdate)) * 12
--             + extract(month from age(c.birthdate)))::integer end
--   from public.activity_attendees aa join public.profiles p on p.id = aa.user_id
--   left join public.activity_attendee_children ac on ac.attendee_id = aa.id
--   left join public.children c on c.id = ac.child_id
--   where aa.activity_id = p_activity_id and aa.status in ('going','attended');
-- end; $$;
