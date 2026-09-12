# Prado's Tour — Base44 Dev Environment

## Overview

Next.js 15 (App Router, Turbopack) + TypeScript + Tailwind CSS. Tour-booking
platform with catalog, reservations, PIX/card payments (Asaas), vouchers,
check-in, sellers/commissions, finance, CRM, coupons, push notifications.

## Running in Base44

```bash
docker compose -f docker-compose.base44.yml up -d
```

- Web entry point: **port 3000** (`next dev --turbopack -H 0.0.0.0`)
- Node 22 slim image; source bind-mounted at `/app`; `node_modules`, `.next`,
  and `.data` use named volumes so installs/cache/seed persist across restarts.
- `npm install` runs at every container start (fast — deps are cached in the
  `node_modules` volume).

## Data backend

Default is **local mode** (`DATA_BACKEND=local`, `AUTH_DRIVER=local`):
persistence is a JSON file at `.data/store.json`. No database required.

The store **auto-seeds** on first run via `src/lib/db/seed.ts` with demo
accounts (password `Prados@123` for all):

| E-mail | Role |
|--------|------|
| admin@pradostour.com | SUPER_ADMIN |
| vendedor@pradostour.com | VENDEDOR |
| monitor@pradostour.com | MONITOR |
| financeiro@pradostour.com | FINANCEIRO |
| cliente@pradostour.com | CLIENTE |

To switch to Supabase (`DATA_BACKEND=supabase`), set
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_URL`,
`SUPABASE_SERVICE_ROLE_KEY`, and run `database/schema.sql` + `database/seed.sql`.

## Required environment variables

- **AUTH_SECRET** — JWT signing secret. Required at boot (no fallback).
  A development placeholder is generated automatically via Base44 secrets.
- ASAAS_API_KEY, ASAAS_ENVIRONMENT, ASAAS_WEBHOOK_TOKEN — only needed for
  real payment processing; not required for local-mode boot.

## Next.js dev origin

`next.config.ts` includes `allowedDevOrigins` driven by
`BASE44_PUBLIC_HOST_SUFFIX` so the preview origin can load dev assets and HMR.
The variable is passed into the container via compose `environment:`.

## Verification

- `curl -s -o /dev/null -w '%{http_code}' http://localhost:3000/` → 200
- Home page title: "Prado's Tour — Excursões"
- Log in at `/login` with `admin@pradostour.com` / `Prados@123`.
