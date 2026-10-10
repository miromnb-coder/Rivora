-- Synthetic local PostgreSQL harness. Never execute this on a hosted database.
-- Auth functions model JWT identity only, not the Supabase Auth service.
create role anon;
create role authenticated;
create role service_role bypassrls;
create schema auth;
create schema private;
create schema extensions;
create extension if not exists pg_trgm with schema extensions;
create table auth.users(id uuid primary key, email text);
create function auth.uid() returns uuid language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claim.sub',true),''),nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid $$;
create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$;
create function auth.role() returns text language sql stable as $$ select current_user::text $$;
grant usage on schema auth, private, extensions to authenticated, service_role;
grant execute on all functions in schema auth to authenticated, service_role;
