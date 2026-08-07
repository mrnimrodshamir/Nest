-- Session 2B — self-selected parent role + optional profile context
--
-- NOT APPLIED. Prepared locally for review, per sprint instruction.
--
-- Verified current profiles columns (ghzpzimcxvccbmjsttlf):
--   avatar_url, bio, created_at, display_name, due_date, email, id, location,
--   neighborhood_label, notification_preferences, onboarding_completed,
--   phone, updated_at, verified_at
-- So `parent_role`, `occupation` and `birthdate` do NOT exist yet.
--
-- SAFETY
-- Every column is nullable with no default and no backfill. Existing rows are
-- untouched. NULL parent_role renders as the neutral "Parent", which is
-- exactly today's copy — so the client can ship BEFORE this migration lands
-- with zero behaviour change. No RLS change: profiles_select_own already
-- restricts reads to the owner, and public exposure goes through the
-- public_profiles view (see the separate view migration below).

create type parent_role as enum ('mom', 'dad', 'parent');

alter table public.profiles
  add column parent_role parent_role,          -- null = user has not chosen
  add column occupation text,                  -- optional, free text
  add column birthdate date;                   -- stored; only derived age is exposed

comment on column public.profiles.parent_role is
  'Self-selected ONLY. Never inferred from name, photo, child or relationship. NULL renders as "Parent".';
comment on column public.profiles.birthdate is
  'Never exposed publicly. Only a derived age may leave the database.';

-- ---------------------------------------------------------------------
-- ROLLBACK
-- ---------------------------------------------------------------------
-- alter table public.profiles
--   drop column if exists birthdate,
--   drop column if exists occupation,
--   drop column if exists parent_role;
-- drop type if exists parent_role;
--
-- Safe to roll back at any time: nothing reads these columns unless the
-- client has been updated, and the client treats absent/null as "Parent".
