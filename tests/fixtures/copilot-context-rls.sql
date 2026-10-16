-- Isolated disposable PostgreSQL fixture ONLY. Never run in production.
-- This file runs after operations-synthetic's catalogue and RLS migrations.
begin;
insert into auth.users(id,email) values
('aaaaaaaa-1111-4111-8111-111111111111','context-a.invalid'),
('bbbbbbbb-2222-4222-8222-222222222222','context-b.invalid');
insert into public.organizations(id,name) values
('11111111-1111-4111-8111-111111111111','Same Nordic Organization'),
('22222222-2222-4222-8222-222222222222','Same Nordic Organization');
insert into public.organization_members(organization_id,user_id,role) values
('11111111-1111-4111-8111-111111111111','aaaaaaaa-1111-4111-8111-111111111111','owner'),
('22222222-2222-4222-8222-222222222222','bbbbbbbb-2222-4222-8222-222222222222','owner');
insert into public.rfqs(id,organization_id,reference,source_type,status) values
('cccccccc-1111-4111-8111-111111111111','11111111-1111-4111-8111-111111111111','SECRET_A_RFQ','manual','needs_review'),
('dddddddd-2222-4222-8222-222222222222','22222222-2222-4222-8222-222222222222','SECRET_B_RFQ','manual','needs_review');

-- A sees only A, despite two organizations having the SAME name.
set local role authenticated;
select set_config('request.jwt.claim.sub','aaaaaaaa-1111-4111-8111-111111111111',true);
do $$
declare own int; other int;
begin
select count(*) into own from public.rfqs where organization_id='11111111-1111-4111-8111-111111111111';
select count(*) into other from public.rfqs where organization_id='22222222-2222-4222-8222-222222222222';
if own<>1 or other<>0 then raise exception 'CONTEXT_TENANT_A_ISOLATION_FAILED'; end if;
if (select count(*) from public.rfqs)<>1 then
raise exception 'CONTEXT_TENANT_A_CROSS_ORG_LEAK'; end if;
end $$;

-- B sees only B; A cannot infer its records by asking the same name.
select set_config('request.jwt.claim.sub','bbbbbbbb-2222-4222-8222-222222222222',true);
do $$
declare own int; other int;
begin
select count(*) into own from public.rfqs where organization_id='22222222-2222-4222-8222-222222222222';
select count(*) into other from public.rfqs where organization_id='11111111-1111-4111-8111-111111111111';
if own<>1 or other<>0 then raise exception 'CONTEXT_TENANT_B_ISOLATION_FAILED'; end if;
if (select count(*) from public.rfqs)<>1 then
raise exception 'CONTEXT_TENANT_B_CROSS_ORG_LEAK'; end if;
end $$;
reset role;
rollback;
select 'Phase 5.0 JWT-scoped synthetic tenant RLS test: PASS' as result;
