#!/usr/bin/env bash
# Tests the prepared Copilot ledger SQL ONLY against the isolated CI PostgreSQL
# container created by scripts/test-operations-sql.sh. Never accept a DB URL.
set -euo pipefail
cd "$(dirname "$0")/.."
container=averomira-catalogue-test
db=averomira_test
sql_file=docs/copilot/PRODUCTION_LEDGER_PATCH_CANDIDATE.sql
docker_cmd=(env -u DOCKER_HOST -u DOCKER_CONTEXT -u DOCKER_TLS -u DOCKER_TLS_VERIFY -u DOCKER_CERT_PATH docker --host=unix:///var/run/docker.sock)
psql_cmd=("${docker_cmd[@]}" exec -i "$container" psql -X -U postgres -d "$db" -v ON_ERROR_STOP=1)

if ! "${docker_cmd[@]}" inspect "$container" >/dev/null 2>&1; then
  echo 'Synthetic Copilot ledger test requires the named disposable CI container.' >&2
  exit 1
fi

check_allowlist() {
  "${psql_cmd[@]}" -A -t -c "select (position('copilot_ai' in pg_get_functiondef('public.reserve_ai_usage_server(uuid,uuid,text,uuid,text,text,bigint)'::regprocedure))>0)::int;" | tr -d '\r\n'
}
check_limits() {
  "${psql_cmd[@]}" -A -t -c "select count(*) from private.operation_limits where 'copilot_ai'=any(enabled_types);" | tr -d '\r\n'
}

[[ "$(check_allowlist)" == "0" ]] || { echo "Unexpected Copilot ledger before patch" >&2; exit 1; }
[[ "$(check_limits)" == "0" ]] || { echo "Synthetic limits already enabled" >&2; exit 1; }

log="$(mktemp)"
trap 'rm -f "$log"' EXIT
# Without an explicitly set synthetic session approval the patch must fail
# before DDL, even though Foundation exists in the synthetic database.
if "${psql_cmd[@]}" < "$sql_file" > "$log" 2>&1; then
  echo "SQL candidate ran without the manual approval guard" >&2; exit 1
fi
grep -q 'COPILOT_PRODUCTION_CHANGE_NOT_APPROVED' "$log" || {
  echo "SQL candidate did not fail at expected approval gate" >&2
  cat "$log"
  exit 1
}
[[ "$(check_allowlist)" == "0" ]] || { echo "Rejected patch changed a function" >&2; exit 1; }

# Approved run below is ONLY on the disposable synthetic container.
# It is a proof of migration syntax and disabled-default posture,
# NOT user approval for production SQL.
{
  printf "SET averomira.copilot_phase43_reviewed = 'yes';\n"
  cat "$sql_file"
} | "${psql_cmd[@]}" > "$log" 2>&1 || { cat "$log"; exit 1; }

[[ "$(check_allowlist)" == "1" ]] || { echo "Synthetic patch did not add copilot_ai type" >&2; exit 1; }
[[ "$(check_limits)" == "0" ]] || { echo "Synthetic patch unexpectedly enabled spending" >&2; exit 1; }
echo "Copilot phase 4.3 isolated SQL guard and disabled limits: PASS"
