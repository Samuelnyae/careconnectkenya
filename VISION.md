# CareConnect Kenya — Vision

A unified digital health platform for Kenyan clinics, pharmacies, and patients.

## North-star goals

| Goal | Target | How we get there |
|---|---|---|
| **Digitize health facilities** | 10,000+ Kenyan clinics & pharmacies | Free tier, Android-first PWA, offline-first sync, M-Pesa billing, SMS onboarding |
| **Reduce drug wastage** | −40% | AI reorder forecasting, expiry tracking, cross-facility inventory visibility, demand signals from disease trends |
| **National patient record access** | Portable EMR per patient | Phone-number identity (OTP), consent-based record sharing across tenants, lab result storage, prescription history |
| **Data-driven healthcare** | Real-time county-level signals | Disease trend tracking per county, outbreak detection (AI), anonymized aggregates for MoH/partners |

## Pillars

1. **Reach** — Android PWA, offline mode, SMS reminders (Twilio), low-bandwidth UI
2. **Trust** — RLS-enforced multi-tenant data, role separation (`private` schema), audit-friendly migrations
3. **Intelligence** — Lovable AI gateway powers Rx anomaly detection, outbreak detection, credit risk, reorder forecasting
4. **Resilience** — Multi-region K8s (Nairobi primary + backup), warm standby, IndexedDB outbox for offline writes
5. **Affordability** — M-Pesa STK push, free entry tier, pay-as-you-grow

## Roadmap signals

- County-level disease dashboards → MoH partnership
- SHIF/NHIF claims automation
- Telemedicine (consult rooms already scaffolded)
- Cross-clinic referrals on shared patient identity

See `docs/DEVOPS.md` for the deployment architecture that supports this vision.