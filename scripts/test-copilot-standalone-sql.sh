#!/usr/bin/env bash
# Only the synthetic Operations CI PostgreSQL container. Never pass a remote DB URL.
set -euo pipefail
cd "$(dirname "$0")/.."
container=averomira-catalogue-test
db=averomira_test
docker_cmd=(env -u DOCKER_HOST -u DOCKER_CONTEXT -u DOCKER_TLS -u DOCKER_TLS_VERIFY -u DOCKER_CERT_PATH docker --host=unix:///var/run/docker.sock)
sql_cmd=("${docker_cmd[@]}" exec -i "$container" psql -X -U postgres -d "$db" -v ON_ERROR_STOP=1)
"${docker_cmd[@]}" inspect "$container" >/dev/null
"${sql_cmd[@]}" < supabase/migrations/20261016193000_copilot_standalone_ai_ledger.sql
"${sql_cmd[@]}" < tests/fixtures/copilot-standalone-ledger-checks.sql
echo 'Copilot standalone ledger and disabled-default checks: PASS'
