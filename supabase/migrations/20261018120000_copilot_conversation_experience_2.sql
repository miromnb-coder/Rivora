-- CX 2.0: PERSONAL tenant-bound conversation history. No production DDL executed by this commit.
-- All mutations use trusted server routes with rechecked session+membership,
-- not browser JWT direct writes. User SELECTs are restricted by RLS.
create table public.copilot_user_preferences(
 organization_id uuid not null references public.organizations(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 workspace_data_consent boolean not null default false,
 consent_version text,
 consented_at timestamptz,
 revoked_at timestamptz,
 history_enabled boolean not null default true,
 last_conversation_id uuid,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 primary key(organization_id,user_id),
 constraint copilot_preferences_consent_check check (
   (workspace_data_consent=true and consent_version is not null and consented_at is not null and revoked_at is null)
   or workspace_data_consent=false
 ),
 constraint copilot_preferences_version_check check(consent_version is null or length(consent_version)<=32)
);
create table public.copilot_conversations(
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.organizations(id) on delete cascade,
 owner_user_id uuid not null references auth.users(id) on delete cascade,
 title text not null default 'Uusi keskustelu',
 context_kind text,
 context_record_id uuid,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 last_activity_at timestamptz not null default now(),
 unique(id,organization_id,owner_user_id),
 constraint cx2_title_check check(length(trim(title)) between 1 and 100),
 constraint cx2_record_context_check check (
  (context_kind is null and context_record_id is null) or
  (context_kind in ('rfq','quote','po','sales') and context_record_id is not null)
 )
);
alter table public.copilot_user_preferences
 add constraint copilot_preferences_last_conversation_fkey
 foreign key(last_conversation_id,organization_id,user_id)
 references public.copilot_conversations(id,organization_id,owner_user_id)
 on delete set null (last_conversation_id);
create table public.copilot_messages(
 id uuid primary key default gen_random_uuid(),
 conversation_id uuid not null,
 organization_id uuid not null,
 owner_user_id uuid not null,
 request_id uuid not null,
 role text not null,
 content text not null default '',
 status text not null,
 verified_metadata jsonb,
 created_at timestamptz not null default now(),
 completed_at timestamptz,
 unique(conversation_id,request_id,role),
 foreign key(conversation_id,organization_id,owner_user_id)
   references public.copilot_conversations(id,organization_id,owner_user_id)
   on delete cascade,
 constraint cx2_role_check check(role in ('user','assistant')),
 constraint cx2_status_check check(status in ('pending','completed','failed','cancelled')),
 constraint cx2_content_check check(length(content)<=6000 and
   (status<>'completed' or length(trim(content))>0)),
 constraint cx2_user_content_check check(role<>'user' or length(content)<=1200),
 constraint cx2_metadata_check check(verified_metadata is null or
   (jsonb_typeof(verified_metadata)='object' and length(verified_metadata::text)<=12000))
);
create index cx2_conversations_owner_activity on public.copilot_conversations(
 organization_id,owner_user_id,last_activity_at desc,id desc);
create index cx2_messages_conversation_created on public.copilot_messages(
 conversation_id,created_at desc,id desc);
create index cx2_conversations_retention on public.copilot_conversations(last_activity_at);
create index cx2_messages_owner on public.copilot_messages(organization_id,owner_user_id);
alter table public.copilot_user_preferences enable row level security;
alter table public.copilot_conversations enable row level security;
alter table public.copilot_messages enable row level security;

create policy cx2_preferences_owner_select on public.copilot_user_preferences
 for select to authenticated using(
  user_id=(select auth.uid()) and exists(
   select 1 from public.organization_members m
   where m.user_id=(select auth.uid()) and m.organization_id=copilot_user_preferences.organization_id
  )
 );
create policy cx2_conversations_owner_select on public.copilot_conversations
 for select to authenticated using(
  owner_user_id=(select auth.uid()) and exists(
   select 1 from public.organization_members m
   where m.user_id=(select auth.uid()) and m.organization_id=copilot_conversations.organization_id
  )
 );
create policy cx2_messages_owner_select on public.copilot_messages
 for select to authenticated using(
  owner_user_id=(select auth.uid()) and exists(
   select 1 from public.organization_members m
   where m.user_id=(select auth.uid()) and m.organization_id=copilot_messages.organization_id
  )
 );
revoke all on public.copilot_user_preferences,public.copilot_conversations,public.copilot_messages from anon,authenticated;
grant select on public.copilot_user_preferences,public.copilot_conversations,public.copilot_messages to authenticated;
grant all on public.copilot_user_preferences,public.copilot_conversations,public.copilot_messages to service_role;
-- No automatically active cron job: cleanup requires an approved, verified retention operator.
