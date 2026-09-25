-- Phase 1 / M1 — structured system message columns.
--
-- APPLIED to production 2026-09-25 as migration 20260925204634.
--
-- Applied as a no-build hotfix: build 48 shipped a client that selects
-- messages.kind and messages.metadata (src/hooks/useChatMessages.ts), which
-- returned HTTP 400 against the un-migrated table and broke every chat with
-- "Couldn't load your messages". The matching RLS half of this feature was
-- already live (20260906120000_apple_review_ugc_safety tolerates a NULL
-- sender_id), so only these columns were missing.
--
-- 0002_emit_system_message.sql (the emit trigger) remains staged and is
-- deliberately NOT applied; until it is, no row is ever kind = 'system'.
--
-- Existing rows: `kind` defaults to 'user', so every current message stays
-- valid and unchanged. No message is rewritten or deleted.
--
-- sender_id becomes NULLable because a system message genuinely has no
-- sender. The alternative (a synthetic "system" profile) would pollute
-- profiles, hosted/joined counts, and chat participant lists.

create type message_kind as enum ('user', 'system');

alter table public.messages
  add column kind message_kind not null default 'user',
  add column metadata jsonb not null default '{}'::jsonb,
  add column event_key text;

alter table public.messages
  alter column sender_id drop not null;

-- A user message must still have a sender; a system message must not.
-- This is what stops a client forging a system message via the normal
-- insert policy (which requires sender_id = auth.uid()).
alter table public.messages
  add constraint messages_sender_matches_kind check (
    (kind = 'user'   and sender_id is not null) or
    (kind = 'system' and sender_id is null)
  );

-- THE dedupe guarantee. Partial so it costs nothing for user messages and
-- allows unlimited NULL event_keys. Two concurrent triggers emitting the
-- same event collide here rather than producing a duplicate row.
create unique index messages_system_event_key_uniq
  on public.messages (chat_id, event_key)
  where kind = 'system' and event_key is not null;

create index messages_chat_kind_idx
  on public.messages (chat_id, kind, created_at);

-- ---------------------------------------------------------------------
-- ROLLBACK
-- ---------------------------------------------------------------------
-- drop index if exists public.messages_chat_kind_idx;
-- drop index if exists public.messages_system_event_key_uniq;
-- alter table public.messages drop constraint if exists messages_sender_matches_kind;
-- -- NOTE: this will FAIL if any system message exists (sender_id is NULL).
-- -- Delete system rows first:  delete from public.messages where kind = 'system';
-- alter table public.messages alter column sender_id set not null;
-- alter table public.messages drop column if exists event_key,
--                             drop column if exists metadata,
--                             drop column if exists kind;
-- drop type if exists message_kind;
