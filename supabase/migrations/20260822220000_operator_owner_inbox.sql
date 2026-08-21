-- Additive owner-inbox contract for supervised autonomous operator approvals.
-- Agents retain INSERT-only access to approvals and therefore cannot decide
-- their own requests. Only an explicitly allow-listed authenticated owner may
-- read the inbox and update the decision columns.

alter table public.approval_requests
  add column if not exists category text,
  add column if not exists title text,
  add column if not exists summary text,
  add column if not exists why_now text,
  add column if not exists recommended_action text,
  add column if not exists risk_level text check (risk_level in ('low','medium','high')),
  add column if not exists expected_impact text,
  add column if not exists rollback_plan text,
  add column if not exists agent_recommendation text check (agent_recommendation in ('APPROVE','REJECT','REQUEST_CHANGES')),
  add column if not exists operator_key text;

create table if not exists public.operator_owners (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  created_by text not null
);

alter table public.operator_owners enable row level security;
revoke all on public.operator_owners from anon, authenticated;
grant select on public.operator_owners to authenticated;
grant all on public.operator_owners to service_role;

drop policy if exists operator_owners_read_self on public.operator_owners;
create policy operator_owners_read_self on public.operator_owners
for select to authenticated using (user_id = auth.uid());

grant select on public.approval_requests to authenticated;
grant update(status, decided_by, decided_at) on public.approval_requests to authenticated;

drop policy if exists operator_owner_read_approvals on public.approval_requests;
create policy operator_owner_read_approvals on public.approval_requests
for select to authenticated using (
  exists(select 1 from public.operator_owners o where o.user_id = auth.uid())
);

drop policy if exists operator_owner_decide_pending_approval on public.approval_requests;
create policy operator_owner_decide_pending_approval on public.approval_requests
for update to authenticated
using (
  status = 'PENDING'
  and exists(select 1 from public.operator_owners o where o.user_id = auth.uid())
)
with check (
  status in ('APPROVE','REJECT','REQUEST_CHANGES')
  and decided_by = auth.uid()
  and decided_at is not null
  and decision_authority is null
  and exists(select 1 from public.operator_owners o where o.user_id = auth.uid())
);

create index if not exists approval_requests_owner_inbox_idx
  on public.approval_requests(status, created_at desc)
  where category is not null;
create unique index if not exists approval_requests_one_pending_operator_key_idx
  on public.approval_requests(operator_key)
  where status = 'PENDING' and operator_key is not null;

comment on table public.operator_owners is 'Explicit allow-list for the human operator inbox. Agents cannot insert or update this table.';
comment on column public.approval_requests.category is 'Structured operator approval category; legacy city approvals may be NULL.';

-- ROLLBACK (manual review only):
-- revoke select, update on public.approval_requests from authenticated;
-- drop policy if exists operator_owner_decide_pending_approval on public.approval_requests;
-- drop policy if exists operator_owner_read_approvals on public.approval_requests;
-- drop table if exists public.operator_owners;
-- drop index if exists public.approval_requests_owner_inbox_idx;
-- alter table public.approval_requests drop column category, drop column title,
--   drop column summary, drop column why_now, drop column recommended_action,
--   drop column risk_level, drop column expected_impact, drop column rollback_plan,
--   drop column agent_recommendation, drop column operator_key;
