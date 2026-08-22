-- Weekend Digest extension. Additive preference plus existing Digest table
-- type constraints. Does not schedule a production cron.

update public.profiles
set notification_preferences = coalesce(notification_preferences, '{}'::jsonb)
  || jsonb_build_object('weekend_digest', false)
where notification_preferences is null
   or not (notification_preferences ? 'weekend_digest');

comment on column public.profiles.notification_preferences is
  'jsonb: {activity_changes, chat_messages, reminders, daily_digest, weekly_digest, weekend_digest}. Every category is opt-in; missing/false means off.';

alter table public.daily_digest_instances drop constraint if exists daily_digest_instances_type_check;
alter table public.daily_digest_instances
  add constraint daily_digest_instances_type_check check (digest_type in ('daily', 'weekly', 'weekend'));

alter table public.daily_digest_sends drop constraint if exists daily_digest_sends_type_check;
alter table public.daily_digest_sends
  add constraint daily_digest_sends_type_check check (digest_type in ('daily', 'weekly', 'weekend'));

-- Existing unique identities remain authoritative:
-- instance: (digest_type, digest_date, city)
-- send:     (user_id, digest_type, digest_date) and send_key

-- ROLLBACK (manual review only; fails if Weekend rows already exist):
-- update public.profiles set notification_preferences = notification_preferences - 'weekend_digest';
-- alter table public.daily_digest_sends drop constraint daily_digest_sends_type_check;
-- alter table public.daily_digest_sends add constraint daily_digest_sends_type_check check (digest_type in ('daily','weekly'));
-- alter table public.daily_digest_instances drop constraint daily_digest_instances_type_check;
-- alter table public.daily_digest_instances add constraint daily_digest_instances_type_check check (digest_type in ('daily','weekly'));
