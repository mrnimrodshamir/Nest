-- Enable Ramat Gan only after the complete controlled sync and read-only
-- idempotence check succeeded. Digest remains intentionally disabled.

insert into public.agent_tasks(
  id, run_id, agent, stage, status, input_summary, output_summary, tools_used,
  confidence, approval_required, started_at, finished_at
) values (
  '86000000-0000-4000-8000-000000000015',
  '86000000-0000-4000-8000-000000000001',
  'provider_integration', 'production_enablement', 'completed',
  '{"provider":"ramat_gan_beit_emanuel","controlled_syncs":1}',
  '{"fetched":67,"normalized":38,"relevant":24,"inserted":24,"updated":0,"unchanged":0,"missing":0,"archived":0,"cleaned":0,"source_complete":true,"second_dry_run":{"inserted":0,"updated":0,"unchanged":24}}',
  array['supabase_edge_function','production_read_only_verification'], 98, true, now(), now()
)
on conflict(id) do nothing;

insert into public.agent_artifacts(
  id, run_id, task_id, artifact_type, payload, content_hash, created_by_agent
) values (
  '86000000-0000-4000-8000-000000000022',
  '86000000-0000-4000-8000-000000000001',
  '86000000-0000-4000-8000-000000000015',
  'controlled_sync_verification',
  '{"events":24,"occurrences":24,"active_future":24,"wrong_city":0,"out_of_bounds":0,"duplicate_provider_ids":0,"duplicate_transport_ids":0,"duplicate_fingerprints":0,"tel_aviv_signatures_unchanged":true,"rsvp_signature_unchanged":true,"archive":0,"delete":0}',
  'ramat-gan-controlled-sync-20260821',
  'provider_integration'
)
on conflict(id) do nothing;

insert into public.agent_decisions(
  id, run_id, task_id, agent, decision_type, decision, reasons, confidence, approval_required
) values (
  '86000000-0000-4000-8000-000000000023',
  '86000000-0000-4000-8000-000000000001',
  '86000000-0000-4000-8000-000000000015',
  'orchestrator', 'production_enablement',
  '{"city_id":"ramat_gan","status":"production_enabled","autonomy_level":2,"digest_enabled":false}',
  '["Gate A explicitly approved","controlled sync complete","idempotence dry run clean","Tel Aviv and RSVP signatures unchanged"]',
  98, true
)
on conflict(id) do nothing;

update public.city_registry
set enabled=true, digest_enabled=false, autonomy_level=2, updated_at=now()
where city_id='ramat_gan';

update public.city_expansion_runs
set status='completed', current_stage='production_enabled', updated_at=now()
where id='86000000-0000-4000-8000-000000000001';

do $$
begin
  if not exists (
    select 1 from public.city_registry
    where city_id='ramat_gan' and enabled and not digest_enabled and autonomy_level=2
  ) then raise exception 'Ramat Gan production enablement invariant failed'; end if;
end $$;

-- ROLLBACK: update public.city_registry set enabled=false where city_id='ramat_gan';
-- Provider data is retained; do not delete Events, Places, RSVP, or workflow history.

