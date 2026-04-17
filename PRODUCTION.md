# Production Setup Checklist

Use this checklist before inviting real sellers or accepting real transaction documents.

## Vercel

- Disable Deployment Protection for production or attach a public custom domain.
- Set `APP_URL` to the public production URL.
- Set `ADMIN_TOKEN` to a long random secret.
- Set Stripe and SMTP environment variables.
- Redeploy after environment changes.

## Supabase

- Create a Supabase project.
- Run `supabase/schema.sql` in the SQL editor. The current API immediately uses the `app_state` table for durable JSON persistence; the normalized tables are included for the next migration.
- Create a private storage bucket named `homepilot-documents`.
- Set these Vercel env vars:
  - `SUPABASE_URL`
  - `SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `SUPABASE_STORAGE_BUCKET=homepilot-documents`
- Confirm `/readiness` reports `supabase-app-state` after env vars are set and Vercel is redeployed.
- Next migration: move from `app_state` JSON persistence into the normalized tables in `supabase/schema.sql`.

## Stripe

- Create products/prices for Starter, Launch, and Guided Sale.
- Set `STRIPE_SECRET_KEY` and each `STRIPE_PRICE_*` variable.
- Create webhook endpoint: `/api/stripe/webhook`.
- Subscribe to `checkout.session.completed`.
- Set `STRIPE_WEBHOOK_SECRET`.

## Legal

- Review `/terms`, `/privacy`, `/legal-disclaimer`, `/fair-housing`, and `/partner-disclosure` with counsel.
- Review Florida checklist language.
- Review UPL, brokerage, RESPA, fair housing, and referral-partner flows.
- Set `LEGAL_REVIEW_COMPLETE=true` only after review is complete.

## Product

- Add real password reset or use managed auth.
- Add audit logs for seller/admin actions.
- Add email verification.
- Add analytics for onboarding, listing, offer, and billing funnels.
- Add backup/export process for seller records.
