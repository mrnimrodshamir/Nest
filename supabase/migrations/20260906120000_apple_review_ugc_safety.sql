-- Apple Review P0: versioned legal consent, typed UGC reports, moderation
-- signals and bidirectional block enforcement. Additive and row-preserving.

create table if not exists public.legal_acceptances (
  user_id uuid primary key references auth.users(id) on delete cascade,
  terms_version text not null,
  privacy_version text not null,
  accepted_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.legal_acceptances enable row level security;
drop policy if exists legal_acceptances_select_own on public.legal_acceptances;
create policy legal_acceptances_select_own on public.legal_acceptances for select to authenticated using (user_id = auth.uid());
revoke all on public.legal_acceptances from anon;
grant select on public.legal_acceptances to authenticated;

create or replace function public.record_legal_acceptance(p_terms_version text, p_privacy_version text)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  if coalesce(length(trim(p_terms_version)), 0) = 0 or coalesce(length(trim(p_privacy_version)), 0) = 0 then
    raise exception 'legal versions required';
  end if;
  insert into public.legal_acceptances(user_id, terms_version, privacy_version, accepted_at, updated_at)
  values (auth.uid(), trim(p_terms_version), trim(p_privacy_version), now(), now())
  on conflict (user_id) do update set terms_version = excluded.terms_version,
    privacy_version = excluded.privacy_version, accepted_at = now(), updated_at = now();
end $$;
revoke all on function public.record_legal_acceptance(text,text) from public, anon;
grant execute on function public.record_legal_acceptance(text,text) to authenticated;

alter table public.reports add column if not exists target_type text;
alter table public.reports add column if not exists target_id text;
alter table public.reports add column if not exists message_id uuid references public.messages(id) on delete set null;
alter table public.reports add column if not exists forum_id uuid references public.forums(id) on delete set null;
alter table public.reports add column if not exists details text;
alter table public.reports add column if not exists context jsonb not null default '{}'::jsonb;
alter table public.reports add column if not exists updated_at timestamptz not null default now();
update public.reports set target_type = case when activity_id is not null then 'activity' else 'user' end where target_type is null;
update public.reports set target_id = coalesce(activity_id::text, reported_user_id::text, id::text) where target_id is null;

create or replace function public.normalize_legacy_report() returns trigger language plpgsql set search_path=public,pg_temp as $$
begin
  new.target_type := coalesce(new.target_type, case when new.activity_id is not null then 'activity' else 'user' end);
  new.target_id := coalesce(new.target_id, new.activity_id::text, new.reported_user_id::text, new.id::text);
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists reports_normalize_legacy on public.reports;
create trigger reports_normalize_legacy before insert or update on public.reports for each row execute function public.normalize_legacy_report();

create table if not exists public.moderation_signals (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null unique references public.reports(id) on delete cascade,
  signal_type text not null check (signal_type in ('user_report','user_block')),
  created_at timestamptz not null default now(),
  acknowledged_at timestamptz
);
alter table public.moderation_signals enable row level security;
revoke all on public.moderation_signals from anon, authenticated;
grant select, insert, update on public.moderation_signals to service_role;

create or replace function public.emit_report_signal() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
  insert into public.moderation_signals(report_id, signal_type)
  values (new.id, case when new.target_type='block' then 'user_block' else 'user_report' end)
  on conflict (report_id) do nothing;
  return new;
end $$;
drop trigger if exists reports_emit_signal on public.reports;
create trigger reports_emit_signal after insert on public.reports for each row execute function public.emit_report_signal();

create or replace function public.is_blocked_between(a uuid, b uuid) returns boolean
language sql stable security definer set search_path=public,pg_temp as $$
  select a is not null and b is not null and exists (
    select 1 from public.blocks x where (x.blocker_id=a and x.blocked_id=b) or (x.blocker_id=b and x.blocked_id=a)
  )
$$;
revoke all on function public.is_blocked_between(uuid,uuid) from public, anon;
grant execute on function public.is_blocked_between(uuid,uuid) to authenticated;

create or replace function public.submit_content_report(p_target_type text, p_target_id text, p_reason text, p_details text default null)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare rid uuid; reported uuid; aid uuid; mid uuid; fid uuid; snapshot jsonb := '{}'::jsonb;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  if p_target_type not in ('activity','user','message','forum_message') then raise exception 'invalid report target'; end if;
  if p_reason not in ('harassment','inappropriate','spam','hate','safety','other') then raise exception 'invalid report reason'; end if;
  if length(coalesce(p_details,'')) > 1000 then raise exception 'details too long'; end if;
  if p_target_type='activity' then
    select a.id,a.host_id,jsonb_build_object('title',a.title) into aid,reported,snapshot from public.activities a where a.id=p_target_id::uuid;
  elsif p_target_type='user' then
    select p.id,jsonb_build_object('display_name',p.display_name) into reported,snapshot from public.profiles p where p.id=p_target_id::uuid;
  else
    select m.id,m.sender_id,jsonb_build_object('content_excerpt',left(m.content,240),'chat_id',m.chat_id)
      into mid,reported,snapshot from public.messages m where m.id=p_target_id::uuid and public.can_access_chat(m.chat_id);
    if p_target_type='forum_message' then select f.id into fid from public.forums f join public.messages m on m.chat_id=f.chat_id where m.id=mid; end if;
  end if;
  if reported is null or reported=auth.uid() then raise exception 'invalid report target'; end if;
  insert into public.reports(reporter_id,reported_user_id,activity_id,message_id,forum_id,target_type,target_id,reason,details,context,status)
  values(auth.uid(),reported,aid,mid,fid,p_target_type,p_target_id,p_reason,nullif(trim(p_details),''),snapshot,'open') returning id into rid;
  return rid;
end $$;
revoke all on function public.submit_content_report(text,text,text,text) from public, anon;
grant execute on function public.submit_content_report(text,text,text,text) to authenticated;

create unique index if not exists reports_one_block_signal_per_pair
  on public.reports(reporter_id,reported_user_id) where target_type='block';
create or replace function public.block_user_with_moderation(p_blocked_user_id uuid)
returns boolean language plpgsql security definer set search_path=public,pg_temp as $$
declare inserted_count integer := 0; rid uuid;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  if p_blocked_user_id is null or p_blocked_user_id=auth.uid() then raise exception 'invalid block target'; end if;
  insert into public.blocks(blocker_id,blocked_id) values(auth.uid(),p_blocked_user_id) on conflict do nothing;
  get diagnostics inserted_count = row_count;
  if inserted_count > 0 then
    insert into public.reports(reporter_id,reported_user_id,target_type,target_id,reason,status)
    values(auth.uid(),p_blocked_user_id,'block',p_blocked_user_id::text,'safety','open')
    on conflict (reporter_id,reported_user_id) where target_type='block' do nothing returning id into rid;
  end if;
  return inserted_count > 0;
end $$;
revoke all on function public.block_user_with_moderation(uuid) from public, anon;
grant execute on function public.block_user_with_moderation(uuid) to authenticated;

-- Restrictive policies compose with (rather than replace) the existing access rules.
drop policy if exists activities_block_isolation on public.activities;
create policy activities_block_isolation on public.activities as restrictive for select to authenticated using (host_id=auth.uid() or not public.is_blocked_between(auth.uid(),host_id));
drop policy if exists activity_attendees_block_isolation on public.activity_attendees;
create policy activity_attendees_block_isolation on public.activity_attendees as restrictive for select to authenticated using (user_id=auth.uid() or not public.is_blocked_between(auth.uid(),user_id));
drop policy if exists event_attendees_block_isolation on public.event_attendees;
create policy event_attendees_block_isolation on public.event_attendees as restrictive for select to authenticated using (user_id=auth.uid() or not public.is_blocked_between(auth.uid(),user_id));
drop policy if exists messages_block_isolation on public.messages;
create policy messages_block_isolation on public.messages as restrictive for select to authenticated using (sender_id is null or sender_id=auth.uid() or not public.is_blocked_between(auth.uid(),sender_id));
drop policy if exists messages_block_send on public.messages;
create policy messages_block_send on public.messages as restrictive for insert to authenticated with check (
  sender_id=auth.uid() and not exists(select 1 from public.chat_participants cp where cp.chat_id=messages.chat_id and cp.user_id<>auth.uid() and public.is_blocked_between(auth.uid(),cp.user_id))
);

-- Keep the original direct-chat implementation intact under a private name,
-- and put the bidirectional block gate in front of old and new clients.
do $$ begin
  if to_regprocedure('public.get_or_create_direct_chat_unchecked(uuid)') is null
     and to_regprocedure('public.get_or_create_direct_chat(uuid)') is not null then
    alter function public.get_or_create_direct_chat(uuid) rename to get_or_create_direct_chat_unchecked;
  end if;
end $$;
revoke all on function public.get_or_create_direct_chat_unchecked(uuid) from public, anon, authenticated;
create or replace function public.get_or_create_direct_chat(other_user_id uuid) returns uuid
language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if auth.uid() is null or public.is_blocked_between(auth.uid(),other_user_id) then raise exception 'conversation unavailable'; end if;
  return public.get_or_create_direct_chat_unchecked(other_user_id);
end $$;
revoke all on function public.get_or_create_direct_chat(uuid) from public, anon;
grant execute on function public.get_or_create_direct_chat(uuid) to authenticated;

-- Attendance SECURITY DEFINER filtering: preserve exact privacy-safe contract.
create or replace function public.get_activity_attendance(p_activity_id uuid)
returns table(source text,user_id uuid,display_name text,avatar_url text,coming_alone boolean,child_id uuid,child_name text,child_age_months integer)
language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if not exists(select 1 from public.activities a where a.id=p_activity_id and (a.status<>'draft' or a.host_id=auth.uid()) and not public.is_blocked_between(auth.uid(),a.host_id)) then return; end if;
  return query
  select 'host'::text,a.host_id,p.display_name,p.avatar_url,a.host_coming_alone,c.id,c.name,
    case when c.birthdate is null then null when (extract(year from age(current_date,c.birthdate))*12+extract(month from age(current_date,c.birthdate)))<24 then (extract(year from age(current_date,c.birthdate))*12+extract(month from age(current_date,c.birthdate)))::integer else (extract(year from age(current_date,c.birthdate))*12)::integer end
  from public.activities a join public.profiles p on p.id=a.host_id left join public.activity_host_children hc on hc.activity_id=a.id left join public.children c on c.id=hc.child_id
  where a.id=p_activity_id and not public.is_blocked_between(auth.uid(),a.host_id)
  union all
  select 'attendee'::text,aa.user_id,p.display_name,p.avatar_url,aa.coming_alone,c.id,c.name,
    case when c.birthdate is null then null when (extract(year from age(current_date,c.birthdate))*12+extract(month from age(current_date,c.birthdate)))<24 then (extract(year from age(current_date,c.birthdate))*12+extract(month from age(current_date,c.birthdate)))::integer else (extract(year from age(current_date,c.birthdate))*12)::integer end
  from public.activity_attendees aa join public.profiles p on p.id=aa.user_id left join public.activity_attendee_children ac on ac.attendee_id=aa.id left join public.children c on c.id=ac.child_id
  where aa.activity_id=p_activity_id and aa.status='going' and not public.is_blocked_between(auth.uid(),aa.user_id);
end $$;
revoke all on function public.get_activity_attendance(uuid) from public, anon;
grant execute on function public.get_activity_attendance(uuid) to authenticated;

-- Moderators use the service role to review this queue; clients cannot query it.
create or replace view public.moderation_queue with (security_invoker=true) as
select r.id,r.target_type,r.target_id,r.reported_user_id,r.activity_id,r.message_id,r.forum_id,r.reason,r.details,r.context,r.status,r.created_at,r.updated_at
from public.reports r where r.status in ('open','reviewed');
revoke all on public.moderation_queue from anon, authenticated;
grant select on public.moderation_queue to service_role;
