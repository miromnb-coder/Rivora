-- Synthetic dependency gaps only. This is not a full Supabase environment.
create schema storage;
create table storage.buckets(id text primary key,name text,public boolean default false,file_size_limit bigint,allowed_mime_types text[]);
create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text references storage.buckets(id),name text,metadata jsonb default '{}');
alter table storage.objects enable row level security;
create function storage.foldername(text) returns text[] language sql immutable as $$ select string_to_array($1,'/') $$;
grant usage on schema storage to authenticated,service_role;
grant select,insert,update,delete on storage.objects to authenticated;
alter table public.rfqs add column source_file_name text,add column processing_error text,add column extraction_provider text,add column extraction_model text,add column extraction_confidence numeric,add column extraction_warnings jsonb default '[]',add column extraction_completed_at timestamptz;
alter table public.rfq_lines add column manufacturer text,add column manufacturer_part_number text,add column extraction_confidence numeric,add column source_page integer,add column extraction_notes text;
alter table public.ai_extractions add column rfq_id uuid references public.rfqs(id),add column provider text,add column model text,add column response_id text,add column status text,add column source_file_name text,add column source_file_sha256 text,add column document_type text,add column overall_confidence numeric,add column extracted_payload jsonb,add column warnings jsonb,add column usage jsonb;
