# CareConnect Kenya — Disaster Recovery Runbook

**Scope:** Fail over the web tier from `nairobi-primary` (Safaricom Cloud / on-prem KE) to `backup-secondary` (warm standby) with zero data loss and < 15 min RTO.

| Target | Value |
|---|---|
| RTO (Recovery Time Objective) | 15 minutes |
| RPO (Recovery Point Objective) | 60 seconds (Supabase WAL streaming) |
| Primary region | `nairobi-primary` |
| Backup region | `backup-secondary` |
| DNS | Cloudflare GeoDNS, TTL 60s |
| Apex | `careconnect.health`, `www.careconnect.health` |

---

## 1. Decision matrix — when to fail over

Trigger DR **only** if one of the following is true for > 5 minutes and cannot be mitigated in-region:

1. Primary cluster API server unreachable (`kubectl --context=nairobi get ns` fails).
2. `careconnect-web` deployment in `nairobi-primary` has 0 ready replicas and rollout cannot recover.
3. Ingress 5xx rate > 50% sustained, or TLS termination failing across all replicas.
4. Datacenter-level event (power, network, fibre cut) confirmed by Safaricom Cloud NOC.
5. Regional Supabase outage with no read path (rare — DR is web-tier only; Supabase has its own HA).

Do **not** fail over for: single-pod crashloop, single-AZ degradation, transient 5xx < 5 min, or expired TLS cert (renew instead).

---

## 2. Roles

- **Incident Commander (IC)** — declares DR, owns comms.
- **Ops on-call** — executes runbook.
- **Comms** — updates status page + WhatsApp ops channel + MoH liaison.
- **Observer** — captures timeline for post-mortem.

---

## 3. Pre-flight (run weekly, automated)

```bash
./scripts/dr/preflight.sh
```

Checks:
- Backup cluster reachable and `careconnect-web` has ≥ 2 ready replicas
- Image digest in backup == image digest in primary
- ConfigMap `APP_REGION=backup-secondary` in backup
- TLS cert valid > 14 days in both clusters
- Cloudflare API token valid
- Supabase project `ACTIVE_HEALTHY`

---

## 4. Failover procedure (Nairobi → Backup)

### 4.1 Declare incident (T+0)
- IC pages `#careconnect-ops`, opens incident doc, sets status page to **Investigating**.

### 4.2 Freeze writes optional (T+1m)
If primary is partially up and corrupting data, scale primary to 0:
```bash
kubectl --context=nairobi -n careconnect scale deploy/careconnect-web --replicas=0
```
Skip if primary is already fully down.

### 4.3 Warm up backup (T+2m)
```bash
kubectl --context=backup -n careconnect scale deploy/careconnect-web --replicas=5
kubectl --context=backup -n careconnect rollout status deploy/careconnect-web --timeout=3m
```

### 4.4 Smoke test backup directly (T+5m)
Bypass DNS — hit the backup ingress IP with a Host header:
```bash
./scripts/dr/smoke.sh backup
```
Must return HTTP 200 on `/`, `/login`, `/api/public/hooks/send-reminders` (OPTIONS).

### 4.5 Cut DNS over (T+7m)
```bash
./scripts/dr/failover.sh --to backup --confirm
```
Script updates Cloudflare A/AAAA records for `careconnect.health` and `www` to the backup ingress LB. TTL is already 60s.

### 4.6 Verify (T+10m)
- `dig +short careconnect.health` resolves to backup IP from 3 vantage points.
- Synthetic check (`./scripts/dr/smoke.sh public`) green for 3 consecutive runs.
- Login + create-patient flow exercised by ops.
- Offline outbox in sample tenants drains (check `OfflineIndicator`).

### 4.7 Comms (T+12m)
Status page → **Identified / Mitigated**. Notify MoH liaison + top-10 clinic admins via SMS.

---

## 5. Failback (Backup → Nairobi)

Only after primary is fully restored AND has run for ≥ 30 min healthy on synthetic traffic.

1. `kubectl --context=nairobi rollout restart deploy/careconnect-web`
2. `./scripts/dr/smoke.sh primary` — must be green 3× in a row.
3. `./scripts/dr/failover.sh --to primary --confirm` — flips DNS back.
4. Scale backup back to warm standby: `kubectl --context=backup scale deploy/careconnect-web --replicas=2`.
5. Reconcile any rows written during DR — Supabase is single-source, so nothing to merge unless backup wrote to a different project (it should not).

---

## 6. Quarterly DR drill (mandatory)

Run a **non-destructive** drill on the 1st Saturday of each quarter, 02:00 EAT:

```bash
./scripts/dr/drill.sh
```

The drill:
1. Spins backup to 5 replicas.
2. Adds a temporary DNS record `dr-drill.careconnect.health` → backup LB.
3. Runs the full smoke suite against `dr-drill.careconnect.health`.
4. Tears the temp record down.
5. Writes a report to `docs/dr-drills/YYYY-QN.md`.

No production DNS is touched. Pass criterion: smoke suite green and end-to-end latency < 800 ms p95.

---

## 7. Post-incident

Within 48 h of any real failover, IC files a blameless post-mortem in `docs/postmortems/` covering: timeline, RTO/RPO actual vs target, what worked, what didn't, action items with owners + due dates.

---

## 8. Out of scope (for this runbook)

- **Database DR** — Supabase manages WAL backup + PITR for the managed project. Restore procedure lives in Supabase dashboard runbook.
- **Secrets rotation** — separate runbook (`docs/SECRETS.md`).
- **Tenant-level data export** — handled by per-clinic backup feature, not DR.