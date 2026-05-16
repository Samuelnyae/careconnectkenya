#!/usr/bin/env bash
# DR pre-flight checks. Run weekly via cron. Exits non-zero on any failure.
set -euo pipefail

NS=careconnect
PRIMARY_CTX=${PRIMARY_CTX:-nairobi}
BACKUP_CTX=${BACKUP_CTX:-backup}

fail() { echo "FAIL: $*" >&2; exit 1; }
ok()   { echo "OK:   $*"; }

echo "== Backup cluster reachable =="
kubectl --context="$BACKUP_CTX" -n "$NS" get deploy careconnect-web >/dev/null \
  || fail "backup cluster unreachable"
ok "backup reachable"

echo "== Backup has >=2 ready replicas =="
ready=$(kubectl --context="$BACKUP_CTX" -n "$NS" get deploy careconnect-web \
  -o jsonpath='{.status.readyReplicas}')
[[ "${ready:-0}" -ge 2 ]] || fail "backup ready=$ready"
ok "backup ready=$ready"

echo "== Image digest parity =="
p_img=$(kubectl --context="$PRIMARY_CTX" -n "$NS" get deploy careconnect-web \
  -o jsonpath='{.spec.template.spec.containers[0].image}')
b_img=$(kubectl --context="$BACKUP_CTX" -n "$NS" get deploy careconnect-web \
  -o jsonpath='{.spec.template.spec.containers[0].image}')
[[ "$p_img" == "$b_img" ]] || fail "image mismatch primary=$p_img backup=$b_img"
ok "image parity: $p_img"

echo "== Backup APP_REGION =="
region=$(kubectl --context="$BACKUP_CTX" -n "$NS" get cm careconnect-config \
  -o jsonpath='{.data.APP_REGION}')
[[ "$region" == "backup-secondary" ]] || fail "APP_REGION=$region (expected backup-secondary)"
ok "APP_REGION=$region"

echo "== TLS cert validity (>14d) =="
for host in careconnect.health www.careconnect.health; do
  end=$(echo | openssl s_client -servername "$host" -connect "$host":443 2>/dev/null \
    | openssl x509 -noout -enddate | cut -d= -f2)
  end_ts=$(date -d "$end" +%s)
  now_ts=$(date +%s)
  days=$(( (end_ts - now_ts) / 86400 ))
  [[ $days -gt 14 ]] || fail "$host cert expires in $days days"
  ok "$host cert valid $days days"
done

echo "== Cloudflare API token =="
: "${CF_API_TOKEN:?CF_API_TOKEN not set}"
curl -fsS -H "Authorization: Bearer $CF_API_TOKEN" \
  https://api.cloudflare.com/client/v4/user/tokens/verify >/dev/null \
  || fail "cloudflare token invalid"
ok "cloudflare token valid"

echo
echo "All pre-flight checks passed."