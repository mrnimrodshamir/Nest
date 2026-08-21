-- The event domain predates provider_registry and enforces its provider FK
-- through event_providers. Keep both registries aligned before the first
-- successful controlled sync.
insert into public.event_providers(id, display_name, source_base_url, is_active)
values(
  'ramat_gan_beit_emanuel',
  'Beit Emanuel Ramat Gan',
  'https://mbe-rg.smarticket.co.il/',
  true
)
on conflict(id) do update set
  display_name=excluded.display_name,
  source_base_url=excluded.source_base_url,
  is_active=true,
  updated_at=now();

-- ROLLBACK (only before any provider Events exist):
-- delete from public.event_providers where id='ramat_gan_beit_emanuel';
