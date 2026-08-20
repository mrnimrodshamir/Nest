-- Weekly Digest extension. Additive only: reuses the existing Digest
-- instance/send tables and never changes the live Daily scheduler.

-- Existing users remain opted out until they explicitly enable Weekly.
update public.profiles
set notification_preferences = coalesce(notification_preferences, '{}'::jsonb)
  || jsonb_build_object('weekly_digest', false)
where notification_preferences is null
   or not (notification_preferences ? 'weekly_digest');

comment on column public.profiles.notification_preferences is
  'jsonb: {activity_changes, chat_messages, reminders, daily_digest, weekly_digest}. Every category is opt-in; missing/false means off.';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'daily_digest_instances_type_check'
  ) then
    alter table public.daily_digest_instances
      add constraint daily_digest_instances_type_check
      check (digest_type in ('daily', 'weekly'));
  end if;
  if not exists (
    select 1 from pg_constraint where conname = 'daily_digest_sends_type_check'
  ) then
    alter table public.daily_digest_sends
      add constraint daily_digest_sends_type_check
      check (digest_type in ('daily', 'weekly'));
  end if;
end $$;

-- Existing unique indexes already provide the required identities:
-- instance: (digest_type, digest_date, city)
-- send:     (user_id, digest_type, digest_date) and send_key

-- ROLLBACK (review and run manually only):
-- alter table public.daily_digest_sends drop constraint if exists daily_digest_sends_type_check;
-- alter table public.daily_digest_instances drop constraint if exists daily_digest_instances_type_check;
-- update public.profiles set notification_preferences = notification_preferences - 'weekly_digest';
