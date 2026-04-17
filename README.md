# HomePilot MVP

A Vite + React prototype plus local pilot backend for a guided for-sale-by-owner home-selling platform.

## Run locally

```powershell
npm install
npm run dev
```

`npm run dev` starts both the Vite web app and the local API. The Vite server proxies `/api` calls to `http://localhost:8787`.

## Build

```powershell
npm run build
```

## Run production-style

```powershell
npm run build
npm start
```

The production server serves `dist/`, exposes `/api/*`, and serves uploaded files from `/uploads/*`.

## Local Pilot Backend

The API stores pilot data in `data/homepilot-db.json` and uploads in `data/uploads/`. The `data/` directory is ignored by git because it may contain seller documents and test credentials.

Implemented backend capabilities:

- Email/password account registration and login using PBKDF2 password hashes.
- Bearer-token sessions with a 30-day local development expiry.
- Server-saved seller profiles.
- Listing draft save/load.
- Offer create/update/delete.
- Showing create/update.
- Document upload/delete with local file storage.
- Lead capture to `data/leads.jsonl` and the local database.
- Optional SMTP notification for new leads.
- Admin/operator overview at `/api/admin/overview` protected by `ADMIN_TOKEN`.

Copy `.env.example` to `.env` or set environment variables for local configuration:

```powershell
$env:ADMIN_TOKEN="replace-me"
$env:SMTP_HOST="smtp.example.com"
$env:SMTP_USER="username"
$env:SMTP_PASS="password"
$env:LEADS_TO="founder@example.com"
```

## Frontend Product Surface

- Multi-page marketing routes for the homepage, workflow, pricing, savings calculator, Florida state page, and seller dashboard.
- Account-gated seller workspace.
- Interactive listing-side commission savings calculator.
- Saved seller onboarding state with server sync after login.
- Dynamic seller checklist with completion progress and task toggles.
- First launch-state checklist engine for Florida, including material-fact, flood-disclosure, lead-paint, HOA/condo, pool, well/septic, MLS partner, offer, and closing tasks.
- Listing builder with generated listing description, social caption, flyer copy, and showing instructions.
- Pricing planner with fast, balanced, and aspirational strategy ranges.
- Offer desk with structured intake, net proceeds math, and risk scoring.
- Showing scheduler with approval/completion updates.
- Document vault with local uploads.
- Operator console for reviewing leads and seller workspaces.


## Stripe Checkout

The seller workspace has a `billing` tab. If `STRIPE_SECRET_KEY` is not configured, checkout records a mock paid purchase so the local pilot remains testable. To use real Stripe Checkout, set these environment variables before running the API:

```powershell
$env:APP_URL="http://localhost:5173"
$env:STRIPE_SECRET_KEY="sk_test_..."
$env:STRIPE_WEBHOOK_SECRET="whsec_..."
$env:STRIPE_PRICE_STARTER="price_..."
$env:STRIPE_PRICE_LAUNCH="price_..."
$env:STRIPE_PRICE_GUIDED="price_..."
```

If you omit the `STRIPE_PRICE_*` variables but provide `STRIPE_SECRET_KEY`, the backend creates Checkout line items with inline `price_data` using the local package amounts. Stripe webhooks should post to `/api/stripe/webhook`.

## Production Readiness

The deployed app exposes `/readiness` and `/api/readiness` to show whether the environment is ready for real sellers. The report checks durable database/storage readiness, Stripe, SMTP, admin token hardening, public URL configuration, and legal-review status.

Production planning files:

- `PRODUCTION.md` contains the launch checklist.
- `supabase/schema.sql` contains an `app_state` table used by the current API for durable Supabase-backed JSON persistence, plus normalized table scaffolding for the next migration.

## Important Limitations

This is a pilot build, not a production real estate compliance system. Supabase-backed app state is supported when env vars are configured, but before charging real customers you should add production auth, complete attorney review, harden admin access, and migrate long-term records from JSON app state into normalized tables.
