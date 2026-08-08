-- Seeds the fixed forum set and the two functions the client needs.
--
-- SEPARATE FILE ON PURPOSE: 0012 adds the 'forum' label to chat_type, and
-- PostgreSQL forbids USING a new enum label in the same transaction that adds
-- it. Splitting guarantees the seed runs in a later transaction.
--
-- Idempotent: re-running creates nothing new and overwrites no message data.

-- ---------------------------------------------------------------------------
-- 1. Seed the fixed forums
-- ---------------------------------------------------------------------------
-- `fallback_title` is only a safety net for admin tooling and any client that
-- lacks the translation; the app renders titles and descriptions from its own
-- dictionaries keyed by `key`.
do $$
declare
  seed record;
  new_chat_id uuid;
begin
  for seed in
    select * from (values
      ('tel-aviv-moms',         'Tel Aviv Moms',                        'users-three',   10),
      ('tel-aviv-dads',         'Tel Aviv Dads',                        'users-three',   20),
      ('breastfeeding',         'Breastfeeding',                        'heart',         30),
      ('child-development',     'Child Development',                    'plant',         40),
      ('parental-leave',        'Parents on Parental Leave',            'house',         50),
      ('baby-sleep',            'Baby Sleep',                           'moon',          60),
      ('starting-solids',       'Starting Solids & Baby Nutrition',     'bowl-food',     70),
      ('things-to-do-tel-aviv', 'Things to Do with Kids in Tel Aviv',   'map-trifold',   80),
      ('local-recommendations', 'Local Recommendations',                'star',          90),
      ('pregnancy-postpartum',  'Pregnancy & Postpartum',               'baby',         100),
      ('first-time-parents',    'First-Time Parents',                   'hand-heart',   110),
      ('daycare-preschools',    'Daycare & Preschools',                 'backpack',     120)
    ) as t(key, fallback_title, icon, sort_order)
  loop
    -- Skip entirely if this forum already exists, so re-running never creates
    -- a second chat and never orphans the first one's messages.
    if exists (select 1 from public.forums f where f.key = seed.key) then
      continue;
    end if;

    insert into public.chats (type, activity_id)
    values ('forum', null)
    returning id into new_chat_id;

    insert into public.forums (chat_id, key, fallback_title, icon, sort_order)
    values (new_chat_id, seed.key, seed.fallback_title, seed.icon, seed.sort_order);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 2. join_forum — transparent, friction-free membership
-- ---------------------------------------------------------------------------
-- The existing chats/messages policies require a chat_participants row. Rather
-- than loosening them (which would affect activity and direct chats too), a
-- user joins the forum silently the first time they open it.
create or replace function public.join_forum(p_key text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_chat_id uuid;
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'not authenticated';
  end if;

  -- Only ACTIVE forums are joinable, and only by key: there is no code path
  -- here that can create a forum or join an arbitrary chat.
  select f.chat_id into v_chat_id
  from public.forums f
  where f.key = p_key and f.is_active;

  if v_chat_id is null then
    raise exception 'unknown forum: %', p_key;
  end if;

  insert into public.chat_participants (chat_id, user_id)
  values (v_chat_id, v_user_id)
  on conflict (chat_id, user_id) do nothing;

  return v_chat_id;
end $$;

revoke all on function public.join_forum(text) from public;
grant execute on function public.join_forum(text) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. forum_overview — one lightweight query for the whole Forums list
-- ---------------------------------------------------------------------------
-- Returns metadata plus ONE preview row per forum. Deliberately never returns
-- message history: opening a forum loads messages separately, paginated.
--
-- SECURITY DEFINER because the list must show every forum, including ones the
-- viewer has not joined yet, whose chats/messages the participant policies
-- would otherwise hide. Only the single most recent message is exposed, which
-- is exactly what the row renders.
create or replace function public.forum_overview()
returns table (
  key text,
  chat_id uuid,
  icon text,
  sort_order integer,
  fallback_title text,
  last_message_content text,
  last_message_at timestamptz,
  last_message_sender_name text,
  has_unread boolean,
  unread_count integer
)
language sql
security definer
set search_path = public
stable
as $$
  select
    f.key,
    f.chat_id,
    f.icon,
    f.sort_order,
    f.fallback_title,
    m.content,
    m.created_at,
    p.display_name,
    -- Unread only once the user has joined; an unvisited forum is not
    -- "unread", it is simply new, and badging all twelve on first launch
    -- would be noise.
    coalesce(u.unread_count, 0) > 0 as has_unread,
    coalesce(u.unread_count, 0)::integer as unread_count
  from public.forums f
  left join lateral (
    select mm.content, mm.created_at, mm.sender_id
    from public.messages mm
    where mm.chat_id = f.chat_id
    order by mm.created_at desc
    limit 1
  ) m on true
  left join public.chat_participants cp
    on cp.chat_id = f.chat_id and cp.user_id = auth.uid()
  left join lateral (
    -- Bounded on purpose: the badge caps at "99+", so counting past 100 rows
    -- per forum would be work nobody sees. Own messages never count as
    -- unread, which also suppresses self-notification in the badge.
    select count(*) as unread_count
    from (
      select 1
      from public.messages mm
      where mm.chat_id = f.chat_id
        and cp.user_id is not null
        and mm.created_at > cp.last_read_at
        and mm.sender_id <> cp.user_id
      limit 100
    ) capped
  ) u on true
  left join public.profiles p on p.id = m.sender_id
  where f.is_active
  order by f.sort_order, f.key;
$$;

revoke all on function public.forum_overview() from public;
grant execute on function public.forum_overview() to authenticated;

-- ---------------------------------------------------------------------------
-- ROLLBACK
-- ---------------------------------------------------------------------------
--   drop function if exists public.forum_overview();
--   drop function if exists public.join_forum(text);
--   delete from public.chats where id in (select chat_id from public.forums);
--   drop table if exists public.forums;
-- The 'forum' label on chat_type cannot be dropped and is harmless if unused.
-- Deleting the chats cascades to their messages and participants; take a
-- backup first if any forum discussion is worth keeping.
