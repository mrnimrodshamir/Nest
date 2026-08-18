-- events.provider has a foreign key into public.event_providers, a lookup
-- table distinct from provider_registry (which governs sync scheduling/
-- enablement, not referential integrity). beit_ariela_libraries was added to
-- provider_registry in 20260818090500 but never inserted here, so the first
-- attempted Beit Ariela event insert fails events_provider_fkey. Registering
-- it now, mirroring the existing tel_aviv_digitel row's shape.
insert into public.event_providers (id, display_name, source_base_url, is_active)
values ('beit_ariela_libraries', 'Beit Ariela -- Tel Aviv Public Libraries', 'https://ariela.today', true)
on conflict (id) do nothing;
