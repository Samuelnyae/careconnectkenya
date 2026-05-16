#!/usr/bin/env bash
# Smoke test the web tier against primary, backup, or public DNS.
# Usage: smoke.sh {primary|backup|public}
set -euo pipefail

target=${1:-public}
case "$target" in
  primary) HOST=careconnect.health; IP=$(kubectl --context=nairobi -n careconnect get svc careconnect-web -o jsonpath='{.status.loadBalancer.ingress[0].ip}') ;;
  backup)  HOST=careconnect.health; IP=$(kubectl --context=backup  -n careconnect get svc careconnect-web -o jsonpath='{.status.loadBalancer.ingress[0].ip}') ;;
  public)  HOST=careconnect.health; IP="" ;;
  *) echo "usage: $0 {primary|backup|public}" >&2; exit 2 ;;
esac

curl_args=(-fsS -o /dev/null -w "%{http_code} %{time_total}s\n" --max-time 10)
if [[ -n "$IP" ]]; then
  curl_args+=(--resolve "$HOST:443:$IP")
fi

fail=0
for path in / /login /dashboard; do
  echo -n "GET $path -> "
  code=$(curl "${curl_args[@]}" "https://$HOST$path" || echo "000 -")
  echo "$code"
  [[ "${code%% *}" =~ ^(200|302|307)$ ]] || fail=1
done

echo -n "OPTIONS /api/public/hooks/send-reminders -> "
code=$(curl "${curl_args[@]}" -X OPTIONS "https://$HOST/api/public/hooks/send-reminders" || echo "000 -")
echo "$code"
[[ "${code%% *}" =~ ^(200|204|405)$ ]] || fail=1

exit $fail