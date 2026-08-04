-- Provider-neutral activity location metadata. Existing columns remain the
-- compatibility source of truth for older app builds and legacy rows.
alter table public.activities
  add column if not exists place_name text,
  add column if not exists formatted_address text,
  add column if not exists place_category text,
  add column if not exists place_provider text,
  add column if not exists provider_place_id text,
  add column if not exists location_source text,
  add column if not exists location_was_adjusted boolean;

alter table public.activities
  add constraint activities_place_provider_check
    check (place_provider is null or place_provider in ('apple_maps')),
  add constraint activities_location_source_check
    check (location_source is null or location_source in ('provider', 'manual', 'legacy'));

-- Shared, database-backed beta limiter. Direct table access stays closed;
-- authenticated users consume slots through the SECURITY DEFINER function.
create table if not exists public.place_search_rate_limits (
  user_id uuid primary key references auth.users(id) on delete cascade,
  window_started_at timestamptz not null,
  request_count integer not null check (request_count >= 0)
);

alter table public.place_search_rate_limits enable row level security;
revoke all on table public.place_search_rate_limits from anon, authenticated;

create or replace function public.consume_place_search_rate_limit()
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  allowed boolean;
begin
  if current_user_id is null then return false; end if;

  insert into public.place_search_rate_limits as limits (user_id, window_started_at, request_count)
  values (current_user_id, clock_timestamp(), 1)
  on conflict (user_id) do update
  set
    window_started_at = case
      when limits.window_started_at <= clock_timestamp() - interval '1 minute' then clock_timestamp()
      else limits.window_started_at
    end,
    request_count = case
      when limits.window_started_at <= clock_timestamp() - interval '1 minute' then 1
      else limits.request_count + 1
    end
  returning request_count <= 30 into allowed;

  return allowed;
end;
$$;

revoke all on function public.consume_place_search_rate_limit() from public, anon;
grant execute on function public.consume_place_search_rate_limit() to authenticated;

comment on function public.consume_place_search_rate_limit() is
  'Consumes one of 30 place-search requests per authenticated user per minute window.';

-- ROLLBACK (review only; do not run automatically):
-- drop function if exists public.consume_place_search_rate_limit();
-- drop table if exists public.place_search_rate_limits;
-- alter table public.activities
--   drop constraint if exists activities_location_source_check,
--   drop constraint if exists activities_place_provider_check,
--   drop column if exists location_was_adjusted,
--   drop column if exists location_source,
--   drop column if exists provider_place_id,
--   drop column if exists place_provider,
--   drop column if exists place_category,
--   drop column if exists formatted_address,
--   drop column if exists place_name;

