# Celebrate — Project Rules for Claude Code

## What this is
SaaS event-planning platform for the Ghanaian market. Wedge: weddings + funerals.
Private-celebration PLANNING (websites, RSVP, cash gifting via MoMo, vendor marketplace,
AI planning) — NOT public ticketing. Read SPEC.md for full scope before any feature work.

## Stack (source of truth — do not introduce alternatives without asking)
- Web: Next.js (App Router) + TypeScript + Tailwind
- DB: PostgreSQL via Prisma
- Payments: <Paystack|Flutterwave> — must use Ghana Mobile Money + card
- Messaging: WhatsApp Business API + <SMS provider>
- AI: Anthropic Claude API
- Currency is GHS everywhere. Amounts stored as integer minor units (pesewas), never floats.

## Commands
- Install: `npm install`
- Dev server: `npm run dev`
- Lint: `npm run lint`
- Typecheck: `npm run typecheck`
- Tests: `npm test`
- DB migrate (dev): `npx prisma migrate dev`

## Workflow rules
- Plan before coding. For non-trivial work, propose a short plan and wait for my go-ahead.
- Work in small slices. One feature per change set. Don't scope-creep.
- After changes, run lint + typecheck + tests and show me passing output before claiming done.
- Never commit secrets. All keys via env vars; keep `.env.example` updated.
- Prefer a mobile-first, low-bandwidth-friendly UI. Keep bundle/asset weight down.

## Money-handling rules (treat as high-risk)
- Any code touching gift money, payouts, or vendor commissions must be explicit, logged,
  idempotent, and covered by tests. Flag assumptions to me — do not guess on financial logic.
- Never auto-trigger real payouts or live charges. Default to test/sandbox keys.

## Code style
- TypeScript strict mode. No `any` unless justified in a comment.
- Small, named functions over clever one-liners. Keep components focused.
- Don't add dependencies without telling me why and what it costs in bundle size.

## Out of scope for MVP (do not build unless I ask)
- Native mobile apps, multi-language UI, parties/sports/social-group event types.
