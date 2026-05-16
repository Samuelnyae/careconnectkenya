#!/usr/bin/env bash
# Flip Cloudflare DNS for careconnect.health between primary and backup.
# Requires: CF_API_TOKEN, CF_ZONE_ID, PRIMARY_LB_IP, BACKUP_LB_IP env vars.
# Usage: failover.sh --to {primary|backup} --confirm
set -euo pipefail

TO=""
CONFIRM=0
while [[ $# -gt 0 ]]; do
  case "$1" in
    --to) TO="$2"; shift 2 ;;
    --confirm) CONFIRM=1; shift ;;
    *) echo "unknown arg: $1" >&2; exit 2 ;;
  esac
done

[[ "$TO" =~ ^(primary|backup)$ ]] || { echo "must pass --to primary|backup" >&2; exit 2; }
[[ $CONFIRM -eq 1 ]] || { echo "refusing to flip DNS without --confirm" >&2; exit 2; }

: "${CF_API_TOKEN:?}"
: "${CF_ZONE_ID:?}"
: "${PRIMARY_LB_IP:?}"
: "${BACKUP_LB_IP:?}"

target_ip=$([[ "$TO" == primary ]] && echo "$PRIMARY_LB_IP" || echo "$BACKUP_LB_IP")
echo "Flipping DNS to $TO ($target_ip)"

update_record() {
  local name=$1
  local rec_id
  rec_id=$(curl -fsS -H "Authorization: Bearer $CF_API_TOKEN" \
    "https://api.cloudflare.com/client/v4/zones/$CF_ZONE_ID/dns_records?type=A&name=$name" \
    | jq -r '.result[0].id')
  [[ -n "$rec_id" && "$rec_id" != "null" ]] || { echo "no A record for $name" >&2; exit 1; }
  curl -fsS -X PUT \
    -H "Authorization: Bearer $CF_API_TOKEN" \
    -H "Content-Type: application/json" \
    --data "{\"type\":\"A\",\"name\":\"$name\",\"content\":\"$target_ip\",\"ttl\":60,\"proxied\":true}" \
    "https://api.cloudflare.com/client/v4/zones/$CF_ZONE_ID/dns_records/$rec_id" \
    | jq -r '.success'
}

for host in careconnect.health www.careconnect.health; do
  echo -n "$host -> "
  update_record "$host"
done

echo "DNS flipped. Verify with: dig +short careconnect.health @1.1.1.1"