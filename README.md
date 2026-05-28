# Celebrate

SaaS event-planning platform for the Ghanaian market. MVP wedge: weddings.

See [SPEC.md](./SPEC.md) for the full product spec and [CLAUDE.md](./CLAUDE.md) for the dev rules of engagement.

## Quick start (local)

```bash
# 1. Postgres (the schema assumes a local 16-cluster on :5432, user/db `celebrate`)
sudo -u postgres pg_ctlcluster 16 main start
sudo -u postgres psql -c "CREATE USER celebrate WITH PASSWORD 'celebrate' CREATEDB;"
sudo -u postgres psql -c "CREATE DATABASE celebrate OWNER celebrate;"

# 2. App
cp .env.example .env
npm install
npx prisma db push
npm run dev
```

Open http://localhost:3000 and click **Start planning**. In dev mode the
OTP code is printed to the server console *and* surfaced in the UI, so you
can sign in without an SMS gateway.

## Provider mode

All external integrations are behind an interface with a `mock` and a `real`
implementation. Defaults in `.env.example` are all `mock` so the app runs
locally with no third-party keys. To enable a real provider:

| Capability | Env var(s) to set | What you need |
|---|---|---|
| Phone OTP | `OTP_PROVIDER=hubtel`, `HUBTEL_CLIENT_ID`, `HUBTEL_CLIENT_SECRET` | A Hubtel SMS account with a registered sender ID |
| WhatsApp | `WHATSAPP_PROVIDER=meta`, `META_WHATSAPP_PHONE_NUMBER_ID`, `META_WHATSAPP_TOKEN`, `META_WHATSAPP_VERIFY_TOKEN` | A WhatsApp Business account with at least one approved template |
| Payments | `PAYMENT_PROVIDER=paystack`, `PAYSTACK_SECRET_KEY`, `PAYSTACK_PUBLIC_KEY` | Paystack merchant account, Ghana MoMo enabled. **Use sandbox keys in dev.** |
| AI (budget estimator) | `AI_PROVIDER=anthropic`, `ANTHROPIC_API_KEY` | An Anthropic API key. Without it, the budget estimator falls back to a built-in template. |

The mock OTP provider logs codes to the server console.

## Scripts

```bash
npm run dev          # Next.js dev server
npm run build        # Production build
npm run start        # Production server
npm run lint         # ESLint
npm run typecheck    # tsc --noEmit
npm test             # Vitest (unit tests)
npm run db:push      # Prisma schema → Postgres (no migration history)
npm run db:migrate   # Create a versioned migration
```

## What's in this slice

This is the **Phase 0 + Phase 1** vertical slice from `SPEC.md`:

- ✅ Auth: phone OTP (mock provider, Hubtel adapter included)
- ✅ Create event flow + organizer dashboard
- ✅ Guest list CRUD + bulk CSV paste
- ✅ Public event page (one polished mobile-first template)
- ✅ Public RSVP flow with phone-OTP verification
- ✅ AI Budget Estimator — Claude when key set, deterministic template otherwise
- ✅ Provider interfaces for WhatsApp + Payments (mock impls; real adapters present but unwired in UI)
- ✅ Strict TypeScript, ESLint, Vitest tests
- ✅ Audit log + AI invocation log tables

What's intentionally **not** in this slice (see SPEC.md §11 for the phased plan):

- WhatsApp send + RSVP-via-WA inbox UI
- MoMo gift collection UI + Paystack webhook handling (provider code is in place; needs wiring + tests)
- Vendor directory
- Planning assistant + vendor matching AI features

## Deployment

The codebase is ready for Vercel + any managed Postgres. You'll need to:

1. Provision a Postgres database (Supabase / Neon / RDS / etc.).
2. Set the env vars listed in `.env.example` (real provider keys where you want real integrations).
3. Run `prisma db push` (or set up migrations) against the production database.
4. Deploy.

There is no live URL yet — the developer environment this was built in is sandboxed.

## Repo layout

```
src/
  app/                       # Next.js App Router
    api/                     # Route handlers (auth, events, guests, rsvp, budget)
    dashboard/[eventId]/     # Organizer dashboard (overview / guests / budget)
    e/[slug]/                # Public event page + RSVP
    r/[shortCode]/           # Short-link → RSVP redirect
    login/, onboarding/      # Auth + onboarding wizard
  components/                # Shared UI
  lib/
    ai/budget.ts             # Claude-backed budget estimator + validated schema + template fallback
    providers/               # OTP, WhatsApp, Payments interfaces + mock + real adapters
    auth.ts, otp.ts          # Session + OTP flow
    db.ts                    # Prisma client singleton
    money.ts, phone.ts       # Pure helpers, fully tested
prisma/
  schema.prisma              # Postgres schema for Phase 0+1 slice
```
