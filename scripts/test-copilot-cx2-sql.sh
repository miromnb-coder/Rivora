#!/usr/bin/env bash
# Disposable container from Operations synthetic PostgreSQL CI only.
set -euo pipefail
cd "$(dirname "$0")/.."
container=averomira-catalogue-test
db=averomira_test
docker_cmd=(env -u DOCKER_HOST -u DOCKER_CONTEXT -u DOCKER_TLS -u DOCKER_TLS_VERIFY -u DOCKER_CERT_PATH docker --host=unix:///var/run/docker.sock)
sql_cmd=("${docker_cmd[@]}" exec -i "$container" psql -X -U postgres -d "$db" -v ON_ERROR_STOP=1)
"${docker_cmd[@]}" inspect "$container" >/dev/null
"${sql_cmd[@]}" < supabase/migrations/20261018120000_copilot_conversation_experience_2.sql
"${sql_cmd[@]}" < tests/fixtures/copilot-cx2-rls.sql
echo 'CX2 isolated migration + tenant/private user RLS: PASS'
