-- Phase 1 / M2b — server-side system message emitter + triggers
--
-- REVIEW BEFORE APPLYING. Not applied to production.
--
-- Why SECURITY DEFINER: RLS policy `messages_insert_participant` requires
-- `sender_id = auth.uid()`, which rejects every system message by design.
-- Emission therefore has to run as owner. The function is the ONLY way a
-- system row can be created; clients still cannot forge one because the
-- CHECK constraint from 0001 forbids kind='system' with a non-null sender.

create or replace function public.emit_activity_system_message(
  p_activity_id uuid,
  p_event text,
  p_event_key text,
  p_metadata jsonb default '{}'::jsonb
) returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_chat_id uuid;
begin
  select id into v_chat_id from public.chats
  where activity_id = p_activity_id and type = 'group'
  limit 1;

  -- No chat yet (e.g. activity created but chat not provisioned) — drop the
  -- event rather than failing the host's transaction.
  if v_chat_id is null then
    return;
  end if;

  insert into public.messages (chat_id, sender_id, kind, content, metadata, event_key)
  values (
    v_chat_id,
    null,
    'system',
    '',                       -- rendering is driven by metadata, not this
    p_metadata || jsonb_build_object('event', p_event),
    p_event_key
  )
  on conflict (chat_id, event_key) where kind = 'system' and event_key is not null
  do nothing;                 -- idempotent under retries and concurrency
end;
$$;

revoke all on function public.emit_activity_system_message(uuid, text, text, jsonb) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- Join / leave
-- ---------------------------------------------------------------------
create or replace function public.tg_system_message_attendee()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_name text;
  v_children text[];
begin
  if tg_op = 'INSERT' then
    select display_name into v_name from public.profiles where id = new.user_id;
    select array_agg(c.name order by c.name) into v_children
      from public.activity_attendee_children ac
      join public.children c on c.id = ac.child_id
      where ac.attendee_id = new.id;

    perform public.emit_activity_system_message(
      new.activity_id,
      'participant_joined',
      'join:' || new.activity_id || ':' || new.user_id,
      jsonb_build_object(
        'actor_id', new.user_id,
        'actor_name', v_name,
        'child_names', coalesce(to_jsonb(v_children), '[]'::jsonb),
        'coming_alone', new.coming_alone
      )
    );
    return new;
  end if;

  if tg_op = 'DELETE' then
    select display_name into v_name from public.profiles where id = old.user_id;
    perform public.emit_activity_system_message(
      old.activity_id,
      'participant_left',
      'leave:' || old.activity_id || ':' || old.user_id || ':' || extract(epoch from now())::bigint,
      jsonb_build_object('actor_id', old.user_id, 'actor_name', v_name)
    );
    return old;
  end if;

  return null;
end;
$$;

create trigger system_message_attendee
  after insert or delete on public.activity_attendees
  for each row execute function public.tg_system_message_attendee();

-- ---------------------------------------------------------------------
-- Activity changes
-- ---------------------------------------------------------------------
-- event_key includes the NEW value, so a genuine second change to a
-- different value emits again, while a repeated write of the SAME value
-- (a retry) collides and is dropped.
create or replace function public.tg_system_message_activity()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
begin
  if new.status = 'cancelled' and old.status <> 'cancelled' then
    perform public.emit_activity_system_message(
      new.id, 'activity_cancelled', 'cancelled:' || new.id, '{}'::jsonb);
    return new;                 -- a cancelled activity emits nothing else
  end if;

  if new.start_time <> old.start_time then
    if new.start_time::date <> old.start_time::date then
      perform public.emit_activity_system_message(
        new.id, 'date_changed',
        'date:' || new.id || ':' || new.start_time,
        jsonb_build_object('old_value', old.start_time, 'new_value', new.start_time));
    else
      perform public.emit_activity_system_message(
        new.id, 'time_changed',
        'time:' || new.id || ':' || new.start_time,
        jsonb_build_object('old_value', old.start_time, 'new_value', new.start_time));
    end if;
  end if;

  -- Deliberately carries NO address or coordinates: chat history is
  -- readable by anyone in the chat, and the exact location of a
  -- privacy-enabled activity must not leak through a system message.
  if new.latitude is distinct from old.latitude
     or new.longitude is distinct from old.longitude then
    perform public.emit_activity_system_message(
      new.id, 'location_changed',
      'location:' || new.id || ':' || coalesce(new.latitude::text,'') || ',' || coalesce(new.longitude::text,''),
      '{}'::jsonb);
  end if;

  if new.capacity is distinct from old.capacity then
    perform public.emit_activity_system_message(
      new.id, 'capacity_changed',
      'capacity:' || new.id || ':' || coalesce(new.capacity::text,'null'),
      jsonb_build_object('old_value', old.capacity, 'new_value', new.capacity));
  end if;

  return new;
end;
$$;

create trigger system_message_activity
  after update on public.activities
  for each row execute function public.tg_system_message_activity();

-- ---------------------------------------------------------------------
-- ROLLBACK
-- ---------------------------------------------------------------------
-- drop trigger if exists system_message_activity on public.activities;
-- drop trigger if exists system_message_attendee on public.activity_attendees;
-- drop function if exists public.tg_system_message_activity();
-- drop function if exists public.tg_system_message_attendee();
-- drop function if exists public.emit_activity_system_message(uuid, text, text, jsonb);
