# Schema baseline — captured 2026-08-03, before Phase 1 migrations

Captured so every Phase 1 migration has an exact rollback target.
Source: live production project (`ghzpzimcxvccbmjsttlf`).

## messages (pre-migration)
- `sender_id uuid NOT NULL` → profiles.id
- no `kind`, no `metadata`, no `event_key`
- indexes: `messages_pkey`, `messages_chat_idx (chat_id, created_at)`, `messages_sender_id_idx`
- RLS: `messages_insert_participant` WITH CHECK
  `sender_id = auth.uid() AND chat_id IN (select chat_id from chat_participants where user_id = auth.uid())`
- RLS: `messages_select_participant` USING
  `chat_id IN (select chat_id from chat_participants where user_id = auth.uid())`

## activity_attendees (pre-migration)
- unique `(activity_id, user_id)`; indexes on `activity_id`, `user_id`
- RLS INSERT `attendees_insert_self` WITH CHECK `auth.uid() = user_id`   ← capacity bypass
- RLS DELETE `attendees_delete_self` USING `auth.uid() = user_id`
- RLS UPDATE `attendees_update_self_or_host`
- RLS SELECT `attendees_select_own_or_active`

## activities (pre-migration)
- RLS SELECT `activities_select_authenticated` USING `true`  ← exposes latitude/longitude to all
- indexes: `activities_pkey`, `activities_host_id_idx`,
  `activities_location_idx` (GiST), `activities_start_time_idx`

## get_activity_attendance (pre-migration)
Returned `child_birthdate date` — exact dates of birth of other users'
children to any activity viewer. Full prior definition retained in git
history at commit b4086c6 via the audit transcript; the only difference in
0003 is `child_birthdate date` → `child_age_months integer` plus the
`status in ('going','attended')` filter being made explicit.

## Deferred (not in this sprint)
- `public.spatial_ref_sys` has RLS disabled. PostGIS reference table, no
  user data. Low-priority security review item; explicitly out of scope.
