-- Gate A has been explicitly approved and recorded. Enable only the provider
-- so one controlled sync can be executed. Ramat Gan itself remains disabled
-- until that sync and its idempotence verification pass.
update public.provider_registry
set enabled = true, updated_at = now()
where key = 'ramat_gan_beit_emanuel'
  and city_id = 'ramat_gan'
  and exists (
    select 1 from public.approval_requests
    where id = '86000000-0000-4000-8000-000000000031'
      and status = 'APPROVE'
      and decision_authority = 'explicit_operator_instruction'
  );

do $$
begin
  if not exists (
    select 1 from public.provider_registry
    where key='ramat_gan_beit_emanuel' and city_id='ramat_gan' and enabled
  ) then
    raise exception 'Approved Beit Emanuel provider was not enabled';
  end if;
end $$;

update public.city_expansion_runs
set status='running', current_stage='production_prepared', updated_at=now()
where id='86000000-0000-4000-8000-000000000001';

-- ROLLBACK (safe before city enablement):
-- update public.provider_registry set enabled=false where key='ramat_gan_beit_emanuel';
