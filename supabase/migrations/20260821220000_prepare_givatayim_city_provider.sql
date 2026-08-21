-- Givatayim Level-2 supervised foundation. City stays disabled until one
-- controlled sync and its idempotence/cross-city checks pass.
insert into public.city_registry(city_id,canonical_name,localized_names,center_latitude,center_longitude,default_radius_m,boundary_source_url,boundary_source_code,boundary_bounds,enabled,digest_enabled)
values('givatayim','Givatayim','{"en":"Givatayim","he":"גבעתיים","fr":"Givatayim","ru":"Гиватаим","ar":"جفعاتايم","es":"Givatayim"}',32.0714,34.81,5000,'https://ags.iplan.gov.il/arcgisiplan/rest/services/PlanningPublic/gvulot_retzef/MapServer/1','6300','{"south":32.0584110791,"west":34.7978726592,"north":32.0817992831,"east":34.8207514301}',false,false)
on conflict(city_id) do update set canonical_name=excluded.canonical_name,localized_names=excluded.localized_names,center_latitude=excluded.center_latitude,center_longitude=excluded.center_longitude,default_radius_m=excluded.default_radius_m,boundary_source_url=excluded.boundary_source_url,boundary_source_code=excluded.boundary_source_code,boundary_bounds=excluded.boundary_bounds,updated_at=now();

insert into public.provider_registry(key,name,source_type,base_url,connector_type,enabled,schedule_cron,trust_level,default_city,city_id)
values('givatayim_municipality','Givatayim Municipality','municipal','https://www.givatayim.muni.il/events/','html_extraction',true,null,'trusted','Givatayim','givatayim')
on conflict(key) do update set name=excluded.name,source_type=excluded.source_type,base_url=excluded.base_url,connector_type=excluded.connector_type,enabled=true,schedule_cron=null,trust_level=excluded.trust_level,default_city=excluded.default_city,city_id=excluded.city_id,updated_at=now();

insert into public.event_providers(id,display_name,source_base_url,is_active)
values('givatayim_municipality','Givatayim Municipality','https://www.givatayim.muni.il/events/',true)
on conflict(id) do update set display_name=excluded.display_name,source_base_url=excluded.source_base_url,is_active=true,updated_at=now();

insert into public.city_expansion_runs(id,workflow_type,city_id,status,current_stage,risk_level,autonomy_level)
values('63000000-0000-4000-8000-000000000001','city_expansion','givatayim','running','production_prepared','medium',2)
on conflict(id) do nothing;

insert into public.agent_tasks(id,run_id,agent,stage,status,input_summary,output_summary,tools_used,confidence,approval_required,started_at,finished_at) values
('63000000-0000-4000-8000-000000000011','63000000-0000-4000-8000-000000000001','city_expansion','city_profile','completed','{"boundary_source":"Israel Planning Administration CR_LAMAS=6300"}','{"official_code":"6300","precision":"signed vector source","cross_city_boundary_required":true}',array['official_arcgis_read'],98,false,now(),now()),
('63000000-0000-4000-8000-000000000012','63000000-0000-4000-8000-000000000001','source_discovery','source_review','completed','{"candidates":6,"existing_provider_comparison":true}','{"top_source":"givatayim_municipality","stable_numeric_ids":true,"official_source":true,"net_new_family_events":44}',array['official_source_research','live_html_inspection'],95,false,now(),now()),
('63000000-0000-4000-8000-000000000013','63000000-0000-4000-8000-000000000001','provider_integration','dry_run','completed','{"window_days":7,"production_writes":false}','{"fetched":197,"normalized":50,"relevant":44,"excluded":153,"invalid":0,"exact":0,"probable":0,"ambiguous":0,"distinct":44,"coordinates":44,"source_complete":true}',array['generic_provider_dry_run','management_api_read_only_comparison'],96,true,now(),now()),
('63000000-0000-4000-8000-000000000014','63000000-0000-4000-8000-000000000001','event_quality','quality_review','completed','{}','{"publish":44,"review":0,"reject":6,"official_boundary_enforced":true,"provider_images_republished":false}',array['cross_city_dedupe','boundary_validation'],95,true,now(),now()),
('63000000-0000-4000-8000-000000000015','63000000-0000-4000-8000-000000000001','localization','localization_review','completed','{}','{"locales":["en","he","fr","ru","ar","es"],"provider_content_preserved":true,"source_name":"עיריית גבעתיים"}',array['locale_contract_review'],96,true,now(),now())
on conflict(id) do nothing;

insert into public.agent_artifacts(id,run_id,artifact_type,payload,content_hash,created_by_agent)
values('63000000-0000-4000-8000-000000000021','63000000-0000-4000-8000-000000000001','provider_gate_a_evidence','{"provider":"givatayim_municipality","source":"official municipal events feed","boundary":"official iPlan CR_LAMAS=6300","dry_run":{"fetched":197,"normalized":50,"relevant":44,"invalid":0,"cross_city_exact":0,"cross_city_probable":0,"cross_city_ambiguous":0},"safety":{"fail_closed":true,"rsvp_preserved":true,"images_republished":false}}','givatayim-gate-a-20260821','orchestrator')
on conflict(id) do nothing;

insert into public.approval_requests(id,run_id,gate,decision_required,risk_summary,proposed_changes,evidence,dry_run_results,requested_by_agent,status,decided_at,decision_authority)
values('63000000-0000-4000-8000-000000000031','63000000-0000-4000-8000-000000000001','new_source','Approve official Givatayim municipality as first provider','{"level":"medium","controlled_sync_required":true,"cron_requires_idempotence":true}','{"provider":"givatayim_municipality","city":"givatayim","city_initially_enabled":false}','{"operator_instruction":"explicitly authorizes supervised production enablement only after clean gates","artifact_id":"63000000-0000-4000-8000-000000000021"}','{"fetched":197,"normalized":50,"relevant":44,"invalid":0,"exact":0,"probable":0,"ambiguous":0,"distinct":44,"source_complete":true}','orchestrator','APPROVE',now(),'explicit_operator_instruction')
on conflict(id) do nothing;

do $$ begin
 if not exists(select 1 from public.city_registry where city_id='givatayim' and not enabled and not digest_enabled) then raise exception 'Givatayim must remain disabled before controlled sync'; end if;
 if not exists(select 1 from public.provider_registry where key='givatayim_municipality' and enabled and schedule_cron is null) then raise exception 'Approved provider preparation failed'; end if;
end $$;

-- ROLLBACK (only before a controlled sync): disable/delete the provider rows,
-- then remove run-linked artifacts/tasks/approval and the disabled city row.
