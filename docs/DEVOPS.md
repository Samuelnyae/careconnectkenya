# CareConnect Kenya — DevOps

## Stack
- **Container**: Multi-stage `Dockerfile` (Bun build → Node 20 alpine runtime, non-root, healthcheck)
- **Orchestration**: Kubernetes manifests in `k8s/` with Kustomize overlays per region
- **CI**: `.github/workflows/ci.yml` — lint, typecheck, build on every PR
- **CD**: `.github/workflows/cd.yml` — build & push multi-arch image to GHCR, deploy to Nairobi (primary) then backup region, push Supabase migrations

## Multi-region layout

```
              ┌─────────────────────┐
   users ───▶ │  GeoDNS / Cloudflare │ ──▶ nairobi-primary  (5+ replicas, HPA 3–30)
              │     load balancer    │ ──▶ backup-secondary (2 replicas, HPA 2–10, warm)
              └─────────────────────┘
                        │
                Supabase (KE region) + cross-region read replica
```

- **Primary**: Nairobi cluster (`k8s/overlays/nairobi`) — handles all live traffic.
- **Backup**: Secondary cluster (`k8s/overlays/backup`) — warm standby, takes over via DNS failover.
- Both clusters pull the **same image digest** from GHCR; config/region differs only via ConfigMap.

## Local
```bash
docker compose up --build
```

## Required GitHub Secrets
- `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_PROJECT_ID` — for build
- `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD`, `SUPABASE_PROJECT_REF` — for migrations
- `KUBECONFIG_NAIROBI`, `KUBECONFIG_BACKUP` — base64-encoded kubeconfigs

## Note on Lovable hosting
Lovable deploys this app on Cloudflare Workers automatically. The Docker/K8s stack
here is for **self-hosting from the GitHub repo** (e.g. Safaricom Cloud, on-prem
MoH datacenter). Pick one path or run both in parallel.