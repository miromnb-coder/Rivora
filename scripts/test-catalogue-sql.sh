#!/usr/bin/env bash
set -euo pipefail
# Only docker exec into the explicitly named synthetic local container is permitted.
container_name=averomira-catalogue-test
repo_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
docker_cmd=(env -u DOCKER_HOST -u DOCKER_CONTEXT -u DOCKER_TLS -u DOCKER_TLS_VERIFY -u DOCKER_CERT_PATH docker --host=unix:///var/run/docker.sock)
"${docker_cmd[@]}" exec "$container_name" dropdb --if-exists --force -U postgres averomira_test
"${docker_cmd[@]}" exec "$container_name" createdb -U postgres averomira_test
# Roles survive database recreation; reset the test cluster roles explicitly.
"${docker_cmd[@]}" exec "$container_name" psql -U postgres -d postgres -v ON_ERROR_STOP=1 -c 'drop role if exists anon, authenticated, service_role' >/dev/null
for source in tests/fixtures/catalogue-database-bootstrap.sql supabase/schema.sql tests/fixtures/catalogue-database-baseline.sql supabase/migrations/20260925_pilot_safety_phase_0_2.sql supabase/migrations/20260928090000_catalogue_sync_inactive_quote_guard_audit_trail.sql supabase/migrations/20260928091000_harden_activity_event_privileges.sql supabase/migrations/20261010140726_catalogue_integrity_guided_import.sql; do
  "${docker_cmd[@]}" exec -i "$container_name" psql -U postgres -d averomira_test -v ON_ERROR_STOP=1 < "$repo_root/$source" > /tmp/averomira-sql-step.log 2>&1 || { cat /tmp/averomira-sql-step.log; exit 1; }
  echo "Applied synthetic database source: $source"
done
"${docker_cmd[@]}" exec -i "$container_name" psql -U postgres -d averomira_test -v ON_ERROR_STOP=1 < "$repo_root/supabase/tests/catalogue_integrity.sql"
# Migration replay must also be safe.
"${docker_cmd[@]}" exec -i "$container_name" psql -U postgres -d averomira_test -v ON_ERROR_STOP=1 < "$repo_root/supabase/migrations/20261010140726_catalogue_integrity_guided_import.sql" >/tmp/averomira-sql-replay.log 2>&1
echo 'Catalogue migration replay: PASS'
if cat "$repo_root/tests/fixtures/catalogue-existing-conflict.sql" "$repo_root/supabase/migrations/20261010140726_catalogue_integrity_guided_import.sql" | "${docker_cmd[@]}" exec -i "$container_name" psql -U postgres -d averomira_test -v ON_ERROR_STOP=1 >/tmp/averomira-sql-conflict.log 2>&1; then
  echo 'FAIL: migration accepted a preexisting SKU conflict'; exit 1
fi
rg -q 'SKU_CONFLICT' /tmp/averomira-sql-conflict.log
echo 'Catalogue existing-conflict migration gate: PASS (transaction rolled back)'
