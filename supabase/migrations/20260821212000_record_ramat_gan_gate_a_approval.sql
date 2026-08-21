-- Human-authorized Gate A decision for the supervised Ramat Gan rollout.
-- The operator explicitly approved Beit Emanuel in the production-enablement
-- instruction. This records that decision; no agent self-approval is inferred.

insert into public.city_expansion_runs(
  id, workflow_type, city_id, status, current_stage, risk_level, autonomy_level
) values (
  '86000000-0000-4000-8000-000000000001', 'city_expansion', 'ramat_gan',
  'awaiting_approval', 'approved', 'medium', 2
)
on conflict (id) do nothing;

insert into public.agent_tasks(
  id, run_id, agent, stage, status, input_summary, output_summary, tools_used,
  confidence, approval_required, started_at, finished_at
) values
(
  '86000000-0000-4000-8000-000000000011',
  '86000000-0000-4000-8000-000000000001',
  'source_discovery', 'source_review', 'completed',
  '{"source":"https://mbe-rg.smarticket.co.il/","method":"public calendar API plus public JSON-LD detail pages"}',
  '{"authentication_required":false,"robots_txt_status":404,"private_endpoint_bypass":false,"provider_images_republished":false}',
  array['http_read_only','structured_response_validation'], 95, false, now(), now()
),
(
  '86000000-0000-4000-8000-000000000012',
  '86000000-0000-4000-8000-000000000001',
  'provider_integration', 'dry_run', 'completed',
  '{"window_days":7,"production_writes":false}',
  '{"fetched":67,"normalized":61,"relevant":24,"excluded":40,"invalid":0,"exact_duplicates":2,"probable_duplicates":0,"ambiguous_duplicates":0,"distinct":24,"coordinate_coverage":38,"age_data":20,"price_data":24,"registration_urls":24,"source_complete":true}',
  array['generic_provider_dry_run','provider_fixture_tests'], 92, true, now(), now()
),
(
  '86000000-0000-4000-8000-000000000013',
  '86000000-0000-4000-8000-000000000001',
  'event_quality', 'quality_review', 'completed',
  '{}',
  '{"dedupe":"stable Smarticket ID plus exact normalized title, occurrence time and curated venue","legitimate_age_sessions_preserved":true,"coordinates":"curated verified venues only","fail_closed":true}',
  array['dedupe_analysis','boundary_validation'], 93, true, now(), now()
),
(
  '86000000-0000-4000-8000-000000000014',
  '86000000-0000-4000-8000-000000000001',
  'localization', 'localization_review', 'completed',
  '{}',
  '{"city_locales":["en","he","fr","ru","ar","es"],"provider_content_policy":"preserve official source text","source_badge":"Beit Emanuel Ramat Gan","tel_aviv_badge_excluded":true}',
  array['locale_contract_review','source_badge_tests'], 94, true, now(), now()
)
on conflict (id) do nothing;

insert into public.agent_artifacts(
  id, run_id, artifact_type, payload, content_hash, created_by_agent
) values (
  '86000000-0000-4000-8000-000000000021',
  '86000000-0000-4000-8000-000000000001',
  'provider_gate_a_evidence',
  '{
    "provider":"ramat_gan_beit_emanuel",
    "source_method":"public structured calendar endpoint and public JSON-LD event pages",
    "expected_event_yield":24,
    "data_quality":{"source_complete":true,"invalid":0,"distinct":24,"coordinate_coverage_before_relevance":38},
    "legal_operational":{"official_public_source":true,"credentials_required":false,"images_republished":false},
    "fail_closed":{"partial_fetch_reconciles_missing":false,"failed_fetch_writes":false},
    "dedupe":{"exact_duplicates":2,"probable":0,"ambiguous":0,"age_group_sessions_preserved":true},
    "localization":{"city_labels":["en","he","fr","ru","ar","es"],"provider_text_machine_translated":false}
  }',
  'ramat-gan-beit-emanuel-gate-a-20260821',
  'orchestrator'
)
on conflict (id) do nothing;

insert into public.approval_requests(
  id, run_id, gate, decision_required, risk_summary, proposed_changes, evidence,
  dry_run_results, requested_by_agent, status, decided_at, decision_authority
) values (
  '86000000-0000-4000-8000-000000000031',
  '86000000-0000-4000-8000-000000000001',
  'new_source',
  'Approve Beit Emanuel as the first supervised Ramat Gan event provider',
  '{"level":"medium","production_write_requires_controlled_sync":true,"cron_requires_post_sync_idempotence":true}',
  '{"provider":"ramat_gan_beit_emanuel","city":"ramat_gan","autonomy_level":2,"initially_enabled":false}',
  '{"artifact_id":"86000000-0000-4000-8000-000000000021","operator_instruction":"APPROVED — Ramat Gan should now be added as a live NestUp city"}',
  '{"fetched":67,"normalized":61,"relevant":24,"excluded":40,"invalid":0,"exact":2,"probable":0,"ambiguous":0,"distinct":24,"source_complete":true}',
  'orchestrator', 'APPROVE', now(), 'explicit_operator_instruction'
)
on conflict (id) do nothing;

-- ROLLBACK (manual review only, before any production sync):
-- delete from public.approval_requests where id='86000000-0000-4000-8000-000000000031';
-- delete from public.agent_artifacts where id='86000000-0000-4000-8000-000000000021';
-- delete from public.agent_tasks where run_id='86000000-0000-4000-8000-000000000001';
-- delete from public.city_expansion_runs where id='86000000-0000-4000-8000-000000000001';
