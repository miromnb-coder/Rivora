#!/usr/bin/env bash
set -euo pipefail
repo_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_root"
bash scripts/test-catalogue-sql.sh
container_name=averomira-catalogue-test
docker_cmd=(env -u DOCKER_HOST -u DOCKER_CONTEXT -u DOCKER_TLS -u DOCKER_TLS_VERIFY -u DOCKER_CERT_PATH docker --host=unix:///var/run/docker.sock)
files=(tests/fixtures/operations-baseline.sql)
for path in supabase/migrations/*.sql; do
 case "$path" in *2026092809[45]*|*202609280965*|*2026092810*|*202609281715*|*202610011830*|*202610011945*|*202610012025*|*202610012040*|*202610061130*|*202610061145*|*2026100613*|*202610061500*|*202610061515*|*202610061830*|*202610061845*|*202610061910*|*202610070815*|*202610111*) files+=("$path");; esac
done
for source in "${files[@]}"; do
 "${docker_cmd[@]}" exec -i "$container_name" psql -U postgres -d averomira_test -v ON_ERROR_STOP=1 < "$source" > /tmp/averomira-operation-step.log 2>&1 || { cat /tmp/averomira-operation-step.log; exit 1; }
 echo "Applied operations synthetic source: $source"
done
for source in supabase/migrations/202610111*.sql; do
 "${docker_cmd[@]}" exec -i "$container_name" psql -U postgres -d averomira_test -v ON_ERROR_STOP=1 < "$source" >/tmp/averomira-operation-replay.log 2>&1 || { cat /tmp/averomira-operation-replay.log; exit 1; }
done
echo 'Operations migration replay: PASS'
node scripts/test-operations-concurrency.mjs
