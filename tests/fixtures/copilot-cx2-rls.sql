-- Disposable synthetic PostgreSQL only. Never execute against production.
begin;
insert into auth.users(id,email) values
 ('aaaaaaaa-1111-4111-8111-111111111111','cx2-a.invalid'),
 ('bbbbbbbb-2222-4222-8222-222222222222','cx2-b.invalid'),
 ('cccccccc-3333-4333-8333-333333333333','cx2-c.invalid');
insert into public.organizations(id,name) values
 ('11111111-1111-4111-8111-111111111111','Same-name tenant'),
 ('22222222-2222-4222-8222-222222222222','Same-name tenant');
insert into public.organization_members(organization_id,user_id,role) values
 ('11111111-1111-4111-8111-111111111111','aaaaaaaa-1111-4111-8111-111111111111','owner'),
 ('11111111-1111-4111-8111-111111111111','cccccccc-3333-4333-8333-333333333333','member'),
 ('22222222-2222-4222-8222-222222222222','bbbbbbbb-2222-4222-8222-222222222222','owner');
insert into public.copilot_user_preferences(organization_id,user_id) values
 ('11111111-1111-4111-8111-111111111111','aaaaaaaa-1111-4111-8111-111111111111'),
 ('11111111-1111-4111-8111-111111111111','cccccccc-3333-4333-8333-333333333333'),
 ('22222222-2222-4222-8222-222222222222','bbbbbbbb-2222-4222-8222-222222222222');
insert into public.copilot_conversations(id,organization_id,owner_user_id,title) values
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111','aaaaaaaa-1111-4111-8111-111111111111','A only'),
 ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','22222222-2222-4222-8222-222222222222','bbbbbbbb-2222-4222-8222-222222222222','B only'),
 ('cccccccc-cccc-4ccc-8ccc-cccccccccccc','11111111-1111-4111-8111-111111111111','cccccccc-3333-4333-8333-333333333333','C only');
insert into public.copilot_messages(conversation_id,organization_id,owner_user_id,request_id,role,content,status,completed_at) values
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111','aaaaaaaa-1111-4111-8111-111111111111','11111111-aaaa-4aaa-8aaa-aaaaaaaaaaaa','user','A private text','completed',now()),
 ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','22222222-2222-4222-8222-222222222222','bbbbbbbb-2222-4222-8222-222222222222','22222222-bbbb-4bbb-8bbb-bbbbbbbbbbbb','user','B private text','completed',now()),
 ('cccccccc-cccc-4ccc-8ccc-cccccccccccc','11111111-1111-4111-8111-111111111111','cccccccc-3333-4333-8333-333333333333','33333333-cccc-4ccc-8ccc-cccccccccccc','user','C private text','completed',now());
do $$
begin
 if has_table_privilege('authenticated','public.copilot_messages','INSERT') or
    has_table_privilege('authenticated','public.copilot_messages','UPDATE') or
    has_table_privilege('authenticated','public.copilot_conversations','DELETE') or
    has_table_privilege('anon','public.copilot_messages','SELECT') then
  raise exception 'CX2_DIRECT_BROWSER_WRITE_OR_ANON_READ';
 end if;
end $$;
set local role authenticated;
select set_config('request.jwt.claim.sub','aaaaaaaa-1111-4111-8111-111111111111',true);
do $$
begin
 if (select count(*) from public.copilot_conversations)<>1 or
    (select count(*) from public.copilot_messages)<>1 or
    (select count(*) from public.copilot_user_preferences)<>1 then
  raise exception 'CX2_USER_A_ISOLATION_FAILED';
 end if;
 if exists(select 1 from public.copilot_conversations where title<>'A only') then
  raise exception 'CX2_A_FOREIGN_CONVERSATION';
 end if;
end $$;
select set_config('request.jwt.claim.sub','bbbbbbbb-2222-4222-8222-222222222222',true);
do $$
begin
 if (select count(*) from public.copilot_conversations)<>1 or
    (select count(*) from public.copilot_messages)<>1 or
    (select count(*) from public.copilot_user_preferences)<>1 then
  raise exception 'CX2_USER_B_ISOLATION_FAILED';
 end if;
end $$;
select set_config('request.jwt.claim.sub','cccccccc-3333-4333-8333-333333333333',true);
do $$
begin
 if (select count(*) from public.copilot_conversations)<>1 or
    (select count(*) from public.copilot_messages)<>1 or
    (select count(*) from public.copilot_user_preferences)<>1 then
  raise exception 'CX2_SAME_ORG_PERSONAL_ISOLATION_FAILED';
 end if;
end $$;
reset role;
rollback;
select 'CX2 isolated RLS and browser-permission tests: PASS' as result;
