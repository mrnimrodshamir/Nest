-- Three high-confidence Beit Emanuel venues only. Unknown family attributes stay NULL.
insert into public.places(name,slug,category,latitude,longitude,formatted_address,city,country_code,provider,provider_place_id,source_name,source_url,verification_status,last_verified_at,is_active,place_origin)
values
('משחקיית ר״געים','ramat-gan-regaim-play-space','indoor_playground',32.0849863,34.8122928,'ביאליק 89, רמת גן','Ramat Gan','IL','beit_emanuel','beit-emanuel-regaim','בית עמנואל רמת גן','https://mbe-rg.smarticket.co.il/','verified',now(),true,'municipality'),
('בית הצנחן','ramat-gan-beit-hatzanhan','community_center',32.0969629,34.8165514,'רוקח 121, רמת גן','Ramat Gan','IL','beit_emanuel','beit-emanuel-beit-hatzanhan','בית עמנואל רמת גן','https://mbe-rg.smarticket.co.il/','verified',now(),true,'municipality'),
('בית דורון','ramat-gan-beit-doron','community_center',32.082076,34.80393,'הראשונים 1, רמת גן','Ramat Gan','IL','beit_emanuel','beit-emanuel-beit-doron','בית עמנואל רמת גן','https://mbe-rg.smarticket.co.il/','verified',now(),true,'municipality')
on conflict(slug) do nothing;

-- ROLLBACK (manual review only): delete from public.places where slug in
-- ('ramat-gan-regaim-play-space','ramat-gan-beit-hatzanhan','ramat-gan-beit-doron')
-- and provider='beit_emanuel' and import_batch_id is null;
