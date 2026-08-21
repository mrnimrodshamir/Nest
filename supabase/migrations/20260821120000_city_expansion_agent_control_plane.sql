-- NestUp city-expansion agent control plane (Level 1/2 only).
-- Local/reviewed migration: do not apply without explicit production approval.
-- The MVP deliberately cannot persist production_enabled as a stage.

create table if not exists public.city_expansion_runs (
  id uuid primary key default gen_random_uuid(),
  workflow_type text not null default 'city_expansion' check (workflow_type = 'city_expansion'),
  city_id text not null check (city_id ~ '^[a-z0-9_]+$'),
  status text not null check (status in ('queued','running','completed','failed','blocked','awaiting_approval','cancelled')),
  current_stage text not null check (current_stage in (
    'city_profile','source_discovery','source_review','provider_analysis','connector_draft','dry_run',
    'quality_review','localization_review','expansion_scoring','awaiting_human_approval','approved',
    'rejected','production_prepared'
  )),
  risk_level text not null check (risk_level in ('low','medium','high')),
  autonomy_level smallint not null check (autonomy_level in (1,2)),
  initiated_by uuid references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.agent_tasks (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.city_expansion_runs(id) on delete cascade,
  agent text not null check (agent in ('orchestrator','source_discovery','provider_integration','event_quality','localization','city_expansion')),
  stage text not null,
  status text not null check (status in ('queued','running','completed','failed','blocked','awaiting_approval','cancelled')),
  depends_on uuid[] not null default '{}',
  input_summary jsonb not null default '{}'::jsonb,
  output_summary jsonb not null default '{}'::jsonb,
  tools_used text[] not null default '{}',
  confidence numeric(5,2) check (confidence between 0 and 100),
  approval_required boolean not null default false,
  started_at timestamptz,
  finished_at timestamptz,
  error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.agent_artifacts (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.city_expansion_runs(id) on delete cascade,
  task_id uuid references public.agent_tasks(id) on delete set null,
  artifact_type text not null,
  schema_version text not null default '1.0',
  payload jsonb not null,
  content_hash text,
  created_by_agent text not null check (created_by_agent in ('orchestrator','source_discovery','provider_integration','event_quality','localization','city_expansion')),
  created_at timestamptz not null default now()
);

create table if not exists public.agent_decisions (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.city_expansion_runs(id) on delete cascade,
  task_id uuid references public.agent_tasks(id) on delete set null,
  agent text not null,
  decision_type text not null,
  decision jsonb not null,
  reasons jsonb not null default '[]'::jsonb,
  confidence numeric(5,2) check (confidence between 0 and 100),
  approval_required boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.approval_requests (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.city_expansion_runs(id) on delete cascade,
  gate text not null check (gate in ('new_source','global_quality_or_dedupe','city_production_enablement','localization_mass_change')),
  decision_required text not null,
  risk_summary jsonb not null,
  proposed_changes jsonb not null,
  evidence jsonb not null,
  dry_run_results jsonb not null,
  requested_by_agent text not null check (requested_by_agent in ('orchestrator','source_discovery','provider_integration','event_quality','localization','city_expansion')),
  status text not null default 'PENDING' check (status in ('PENDING','APPROVE','REJECT','REQUEST_CHANGES')),
  decided_by uuid references auth.users(id) on delete restrict,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  check ((status = 'PENDING' and decided_by is null and decided_at is null) or (status <> 'PENDING' and decided_by is not null and decided_at is not null))
);

create index if not exists city_expansion_runs_city_created_idx on public.city_expansion_runs(city_id, created_at desc);
create index if not exists agent_tasks_run_status_idx on public.agent_tasks(run_id, status);
create index if not exists agent_artifacts_run_type_idx on public.agent_artifacts(run_id, artifact_type);
create index if not exists approval_requests_run_status_idx on public.approval_requests(run_id, status);

alter table public.city_expansion_runs enable row level security;
alter table public.agent_tasks enable row level security;
alter table public.agent_artifacts enable row level security;
alter table public.agent_decisions enable row level security;
alter table public.approval_requests enable row level security;

revoke all on public.city_expansion_runs, public.agent_tasks, public.agent_artifacts, public.agent_decisions, public.approval_requests from anon, authenticated;
grant select, insert, update on public.city_expansion_runs, public.agent_tasks, public.agent_artifacts, public.agent_decisions to service_role;
grant select, insert on public.approval_requests to service_role;

comment on table public.approval_requests is 'Pending human approval evidence. Agents/service_role may create and read requests in this MVP, but cannot update or delete decisions.';
comment on table public.agent_artifacts is 'Structured, secret-free evidence for assisted city expansion. Chat history is never the system of record.';

-- ROLLBACK (review only; do not run automatically):
-- drop table if exists public.approval_requests;
-- drop table if exists public.agent_decisions;
-- drop table if exists public.agent_artifacts;
-- drop table if exists public.agent_tasks;
-- drop table if exists public.city_expansion_runs;
