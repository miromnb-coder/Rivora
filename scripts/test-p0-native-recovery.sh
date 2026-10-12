#!/usr/bin/env bash
set -euo pipefail
umask 077
# Fixed offline synthetic containers only. No production URLs or credentials.
repo_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
docker_cmd=(env -u DOCKER_HOST -u DOCKER_CONTEXT -u DOCKER_TLS -u DOCKER_TLS_VERIFY -u DOCKER_CERT_PATH docker --host=unix:///var/run/docker.sock)
source_container=averomira-catalogue-test
restore_container=averomira-p0-restored
command -v age >/dev/null
command -v age-keygen >/dev/null
scratch_dir="$(mktemp -d)"
cleanup() {
  rm -rf -- "$scratch_dir"
  "${docker_cmd[@]}" rm --force "$restore_container" >/dev/null 2>&1 || true
}
trap cleanup EXIT
"${docker_cmd[@]}" exec -i "$source_container" psql -U postgres -d averomira_test \
  -v ON_ERROR_STOP=1 < "$repo_root/tests/fixtures/p0-recovery-seed.sql" >/dev/null
"${docker_cmd[@]}" exec "$source_container" pg_dump -U postgres -Fc averomira_test > "$scratch_dir/database.dump"
"${docker_cmd[@]}" exec "$source_container" pg_dumpall -U postgres --roles-only --no-role-passwords > "$scratch_dir/roles.sql"
# The fresh image already has the reserved bootstrap postgres role.
sed -i '/^CREATE ROLE postgres;$/d' "$scratch_dir/roles.sql"
age-keygen -o "$scratch_dir/recovery-key.txt" 2>/dev/null
recipient="$(age-keygen -y "$scratch_dir/recovery-key.txt")"
tar -C "$scratch_dir" -cf - database.dump roles.sql | age -r "$recipient" -o "$scratch_dir/backup.age"
mkdir "$scratch_dir/restored"
age -d -i "$scratch_dir/recovery-key.txt" "$scratch_dir/backup.age" | tar -C "$scratch_dir/restored" -xf -
cmp "$scratch_dir/database.dump" "$scratch_dir/restored/database.dump"
cmp "$scratch_dir/roles.sql" "$scratch_dir/restored/roles.sql"
echo 'PASS: encrypted synthetic archive restores byte-identical database and role dumps'
"${docker_cmd[@]}" run --detach --name "$restore_container" --network none --memory 1g --cpus 2 \
  --env POSTGRES_HOST_AUTH_METHOD=trust postgres:17.6 >/dev/null
ready=false
for attempt in $(seq 1 20); do
  if "${docker_cmd[@]}" exec "$restore_container" pg_isready -U postgres >/dev/null; then ready=true; break; fi
  sleep 2
done
[[ "$ready" == true ]]
"${docker_cmd[@]}" exec -i "$restore_container" psql -U postgres -d postgres \
  -v ON_ERROR_STOP=1 < "$scratch_dir/restored/roles.sql" >/dev/null
"${docker_cmd[@]}" exec "$restore_container" createdb -U postgres averomira_restored
"${docker_cmd[@]}" exec -i "$restore_container" pg_restore -U postgres --exit-on-error \
  -d averomira_restored < "$scratch_dir/restored/database.dump"
"${docker_cmd[@]}" exec -i "$restore_container" psql -U postgres -d averomira_restored \
  -v ON_ERROR_STOP=1 <<'SQL'
do $$ begin
 if not exists(select 1 from public.products where id='30000000-0000-0000-0000-000000000099' and sku='RECOVERY-1' and unit_price=123.45) then raise exception 'recovery product missing'; end if;
 if not exists(select 1 from auth.users where id='10000000-0000-0000-0000-000000000099') then raise exception 'synthetic auth row missing'; end if;
 if not exists(select 1 from pg_roles where rolname='authenticated') then raise exception 'role missing'; end if;
 if not exists(select 1 from pg_class where oid='public.products'::regclass and relrowsecurity) then raise exception 'RLS missing'; end if;
 if has_table_privilege('authenticated','private.catalogue_imports','SELECT') then raise exception 'private ACL leak'; end if;
 if has_function_privilege('anon','public.commit_catalogue_import(uuid,uuid,boolean)','EXECUTE') then raise exception 'RPC ACL leak'; end if;
 if (select count(*) from public.activity_events where entity_id='50000000-0000-0000-0000-000000000099')<>1 then raise exception 'audit missing or duplicated'; end if;
 raise notice 'PASS: restored product ID/price, auth row, roles, RLS, private/RPC ACLs and exactly-once audit';
end $$;
begin;
set local request.jwt.claim.sub='10000000-0000-0000-0000-000000000099';
set local role authenticated;
select public.commit_catalogue_import('20000000-0000-0000-0000-000000000099','50000000-0000-0000-0000-000000000099',false);
commit;
SQL
"${docker_cmd[@]}" exec -i "$restore_container" psql -U postgres -d averomira_restored \
  -v ON_ERROR_STOP=1 < "$repo_root/supabase/tests/catalogue_integrity.sql"
echo 'PASS: encrypted native PostgreSQL role/data recovery and catalogue regressions'
