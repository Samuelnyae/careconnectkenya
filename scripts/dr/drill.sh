#!/usr/bin/env bash
# Non-destructive quarterly DR drill. Touches NO production DNS.
# Creates dr-drill.careconnect.health -> backup LB, smoke-tests, tears down.
set -euo pipefail

: "${CF_API_TOKEN:?}"
: "${CF_ZONE_ID:?}"
: "${BACKUP_LB_IP:?}"

NS=careconnect
BACKUP_CTX=${BACKUP_CTX:-backup}
DRILL_HOST=dr-drill.careconnect.health
REPORT_DIR=docs/dr-drills
mkdir -p "$REPORT_DIR"
quarter="$(date +%Y)-Q$((( $(date +%-m) - 1 ) / 3 + 1))"
REPORT="$REPORT_DIR/$quarter.md"

cleanup() {
  echo "[cleanup] scaling backup back to 2 replicas"
  kubectl --context="$BACKUP_CTX" -n "$NS" scale deploy/careconnect-web --replicas=2 || true
  if [[ -n "${REC_ID:-}" ]]; then
    echo "[cleanup] deleting temp DNS $DRILL_HOST"
    curl -fsS -X DELETE -H "Authorization: Bearer $CF_API_TOKEN" \
      "https://api.cloudflare.com/client/v4/zones/$CF_ZONE_ID/dns_records/$REC_ID" >/dev/null || true
  fi
}
trap cleanup EXIT

{
  echo "# DR drill — $quarter"
  echo
  echo "- Started: $(date -Is)"
  echo "- Backup context: $BACKUP_CTX"
  echo "- Drill host: $DRILL_HOST -> $BACKUP_LB_IP"
  echo
} > "$REPORT"

echo "[1/4] scale backup to 5"
kubectl --context="$BACKUP_CTX" -n "$NS" scale deploy/careconnect-web --replicas=5
kubectl --context="$BACKUP_CTX" -n "$NS" rollout status deploy/careconnect-web --timeout=3m

echo "[2/4] create temp DNS $DRILL_HOST"
REC_ID=$(curl -fsS -X POST -H "Authorization: Bearer $CF_API_TOKEN" \
  -H "Content-Type: application/json" \
  --data "{\"type\":\"A\",\"name\":\"$DRILL_HOST\",\"content\":\"$BACKUP_LB_IP\",\"ttl\":60,\"proxied\":true}" \
  "https://api.cloudflare.com/client/v4/zones/$CF_ZONE_ID/dns_records" \
  | jq -r '.result.id')

echo "[3/4] wait for DNS + smoke (3 passes)"
sleep 30
pass=0; fail=0
for i in 1 2 3; do
  if HOST=$DRILL_HOST scripts/dr/smoke.sh public; then pass=$((pass+1)); else fail=$((fail+1)); fi
  sleep 10
done

{
  echo "## Smoke results"
  echo "- pass: $pass / 3"
  echo "- fail: $fail / 3"
  echo "- Finished: $(date -Is)"
} >> "$REPORT"

echo "[4/4] report -> $REPORT"
[[ $fail -eq 0 ]] || { echo "DR drill FAILED ($fail/3)"; exit 1; }
echo "DR drill PASSED"