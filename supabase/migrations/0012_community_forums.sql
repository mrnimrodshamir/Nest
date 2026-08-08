-- Community forums: fixed, curated, NestUp-created discussion spaces.
--
-- DESIGN: forums reuse the EXISTING chat stack rather than introducing a
-- parallel messaging system. A forum is a row in `chats` with type='forum',
-- plus one row in `forums` carrying its stable key and presentation metadata.
-- Messages, participants, unread tracking and RLS are all unchanged.
--
-- ACCESS: the existing policies gate chats/messages on chat_participants
-- membership. Rather than weaken them, opening a forum transparently inserts a
-- participant row via join_forum(). No existing policy is modified, so activity
-- and direct chats are provably unaffected by this migration.
--
-- USER-CREATED FORUMS ARE IMPOSSIBLE BY CONSTRUCTION: `chats` has no INSERT
-- policy at all, and `forums` below gets SELECT only. Both therefore fall
-- through to RLS default-deny for every client role.
--
-- ROLLBACK NOTES (see the bottom of this file for the statements):
--   The enum value 'forum' cannot be dropped from chat_type in PostgreSQL.
--   Rolling back means deleting the forum rows and the table; the unused enum
--   label is harmless and must be left in place.

-- ---------------------------------------------------------------------------
-- 1. chat_type gains 'forum'
-- ---------------------------------------------------------------------------
-- ADD VALUE IF NOT EXISTS is idempotent. It cannot run inside an explicit
-- transaction block on PG < 12; this project is on PG 17, where it is allowed,
-- but the new label still may not be USED in the same transaction that adds
-- it. The seed below therefore runs in its own statement batch.
alter type public.chat_type add value if not exists 'forum';

-- ---------------------------------------------------------------------------
-- 2. forums metadata
-- ---------------------------------------------------------------------------
create table if not exists public.forums (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid not null unique references public.chats(id) on delete cascade,
  -- Stable, human-readable identifier. Drives deep links
  -- (nestup://forum/breastfeeding) and the i18n key lookup, so it must never
  -- change once shipped.
  key text not null unique,
  -- Fallback display name only. The app resolves the visible title and
  -- description from its own dictionaries via `key`, so translations ship with
  -- the client and need no migration to change.
  fallback_title text not null,
  icon text not null default 'chats-circle',
  sort_order integer not null default 100,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists forums_active_order_idx
  on public.forums (is_active, sort_order, key);

alter table public.forums enable row level security;

-- SELECT only, and only for signed-in users. No INSERT/UPDATE/DELETE policy
-- exists, so clients cannot create, rename or remove a forum.
drop policy if exists forums_select_authenticated on public.forums;
create policy forums_select_authenticated on public.forums
  for select to authenticated
  using (is_active);
