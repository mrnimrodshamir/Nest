-- SECURITY FIX for 0013. Applied to production together with 0012/0013.
--
-- Supabase configures ALTER DEFAULT PRIVILEGES to GRANT EXECUTE on newly
-- created functions to anon, authenticated and service_role. 0013 ended with
-- `revoke all on function ... from public`, which removes the PUBLIC
-- pseudo-role grant but NOT an explicit grant to the `anon` role — so both
-- forum functions shipped with anon holding EXECUTE.
--
-- join_forum was unaffected in practice: it raises when auth.uid() is null.
-- forum_overview was NOT: it is SECURITY DEFINER (so it bypasses RLS by
-- design, in order to list forums the viewer has not joined) and had no auth
-- guard, meaning an unauthenticated caller could read the most recent message
-- of every forum.
--
-- Two independent mitigations, so neither alone is load-bearing:
--   1. Revoke EXECUTE from anon explicitly.
--   2. Require auth.uid() inside the function body, so restoring the grant by
--      accident still leaks nothing.
--
-- Verified post-apply: `set local role anon; select * from forum_overview()`
-- returns "permission denied for function forum_overview".

revoke execute on function public.forum_overview() from anon;
revoke execute on function public.join_forum(text) from anon;

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
  -- Defence in depth: SECURITY DEFINER bypasses RLS, so the function must
  -- refuse anonymous callers itself rather than relying on the grant alone.
  where f.is_active and auth.uid() is not null
  order by f.sort_order, f.key;
$$;

revoke all on function public.forum_overview() from public;
revoke execute on function public.forum_overview() from anon;
grant execute on function public.forum_overview() to authenticated;
