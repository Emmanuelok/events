# Celebrate — Product Specification (v1)

> A start-to-finish planning platform for Ghanaian celebrations. MVP wedge: **weddings**, full stack. Later: funerals/memorials, parties, naming ceremonies, recurring social-group events.

---

## 1. Product overview

**Celebrate** is a SaaS planning platform built for the reality of Ghanaian celebrations: Mobile Money instead of card registries, WhatsApp instead of email invitations, local vendors instead of global directories, and event types (notably funerals) that foreign tools ignore.

We are explicitly **not** a public-ticketing platform. eGotickets owns the paid-entry concert/event-ticketing + MoMo distribution lane. Celebrate operates in the adjacent and underserved **private-celebration planning** lane.

### 1.1 Why we win
- **Mobile Money native** — gifting, payouts, and (later) vendor escrow built around MTN MoMo, Telecel Cash, AirtelTigo Money.
- **WhatsApp as a first-class channel** — invitations, reminders, RSVP capture and AI-assisted replies live where Ghanaians actually talk.
- **Local gifting culture** — cash gifting (the local equivalent of a registry), not US-style physical product registries.
- **Funeral support** — a real, large event category that Joy/Zola/The Knot ignore entirely. Coming in v2 with strong differentiation.
- **Local vendor marketplace** — caterers, decorators, venues, photographers, MCs, funeral service providers, vetted on the ground.

### 1.2 Working name
Celebrate.

---

## 2. Target users

### 2.1 Primary (MVP)
- **Engaged couples** in Ghana (urban + diaspora-back-home weddings). Age 25–40. Mid-to-upper income. Smartphone-first; many on mid-range Android with intermittent data.
- **Co-planners** the couple invites: maid of honor / best man, parents, siblings. Edit and view permissions, no ownership of money.

### 2.2 Secondary (MVP)
- **Wedding guests** — receive WhatsApp/SMS invitations, RSVP, send MoMo cash gifts. Often do not create accounts; identified by phone number.
- **Vendors** — caterers, decorators, venues, photographers, makeup artists, MCs, DJs, bridal-wear sellers. Self-onboard into the directory; lead-based monetization.

### 2.3 Future (v2+)
- **Bereaved families** planning funerals/memorials.
- **Professional wedding/event planners** managing multiple client events under one account (B2B tier).
- **Hosts** of parties, naming ceremonies, anniversaries, social-group recurring events.

---

## 3. MVP scope

### 3.1 In scope (v1 — weddings only, full stack)

1. **Event website / page builder** with a small set of beautiful, mobile-first templates (3 at launch). Each event has a public page at `celebrate.gh/<slug>` (or `<slug>.celebrate.gh` once custom subdomains land).
2. **Guest list + smart RSVP** with WhatsApp + SMS invitations and reminders, RSVP capture, +1 management, dietary capture, and table/group tagging.
3. **MoMo cash gifting** with per-gift transparent fee (guest pays on top), thank-you tracking, gift wall (optional, organizer-controlled visibility), and CSV export.
4. **Vendor directory** with a two-tier model: "Celebrate Verified" (hand-vetted) above an open self-signup tier. Lead-capture/quote-request flow. No in-platform booking or payment flow in v1.
5. **Organizer dashboard** unifying: event details, guest list, RSVPs, gifts, budget, checklist, vendor shortlist.
6. **AI layer (all four MVP features)**:
   - Budget estimator (Ghanaian wedding line-item budget by region + guest count).
   - Vendor matching (rank vendors by budget/location/style).
   - Planning assistant (timeline + checklist generation and conversational Q&A).
   - WhatsApp RSVP agent — **draft-and-approve only** in MVP (Claude proposes, organizer one-taps to send).
7. **Multi-event + team co-editors** — one organizer account can own many events; each event has owners, editors, viewers.
8. **Phone + OTP authentication** primary; email optional secondary.
9. **Mobile-first PWA** — installable, optimized for first-load on 3G, no native apps in v1.
10. **English UI**, i18n-ready (no hardcoded copy).

### 3.2 Out of scope (v1)

| Out of scope | Why |
|---|---|
| **Public ticketed / paid-entry events** | eGotickets lane. We do private celebrations only. |
| **Livestreaming / video hosting** | High infra cost; link out to YouTube/Zoom instead. |
| **Physical-product registries** | Local culture is cash, not blenders. Cash gifting only. |
| **Guest travel / hotel booking** | Not our wedge. Show info pages with venue + recommendations; no booking. |
| **Funerals, parties, naming ceremonies** | v2+ after we validate retention on weddings. |
| **In-platform vendor booking & escrow** | v2. MVP is lead capture only. |
| **Native Android/iOS apps** | PWA covers the need. Revisit only if a feature needs native APIs. |
| **Twi / Ga / Ewe UI** | English at launch, i18n-ready. Localize templates first when we expand. |
| **Held-balance custody at large scale** | Mitigated by gateway sub-accounts (see §6.2). |
| **Professional planner B2B accounts** | v2. |
| **Full dispute mediation center** | Gifts are final by policy (see §6.3). |
| **Fully autonomous WhatsApp agent** | Human-in-loop only in MVP. |
| **Custom domains on free tier** | Premium feature, post-MVP. |

---

## 4. Architecture & stack

### 4.1 Principle: minimize vendors
The user requested no more than two apps/services for the whole platform. Default stack:

- **App** — Next.js 15 (App Router) + TypeScript + Tailwind, hosted on **Vercel**.
- **Everything else** — **Supabase**: Postgres, Auth (custom phone-OTP via Hubtel), Storage (event photos, vendor portfolios), Realtime (live RSVP/gift wall), Edge Functions (webhooks).

Two providers. That's the rule.

### 4.2 Integrations (not "platforms")

| Concern | Provider | Notes |
|---|---|---|
| Payments (MoMo + cards) | **Paystack primary**, Flutterwave behind a thin abstraction for redundancy | Paystack has cleaner Ghana MoMo DX and sub-account support |
| WhatsApp | **Meta WhatsApp Cloud API** (direct) | Cheapest, official, template approval ~24–48h |
| SMS + Phone OTP | **Hubtel** | Strongest GH sender-ID support; reliable OTP delivery |
| AI | **Anthropic API (Claude)** | Sonnet 4.6 for cost/latency on most calls; Opus 4.7 for budget estimation and planning agent only |
| Email (optional) | **Resend** | Transactional only; not a primary channel |
| Error/perf | **Sentry** | Standard |
| Analytics | **PostHog** (self-hosted later if cost) | Product analytics + session replay |

### 4.3 Data flow tenets
- **No fund custody by Celebrate.** Gift money never sits in our bank account. Default routing is via Paystack **sub-accounts** (one per event), with two modes:
  - **Instant pass-through** (default) — funds settle directly into the couple's Paystack sub-account, paid out to their MoMo wallet on their schedule.
  - **Hold-balance** (opt-in, disclosed) — funds remain in their sub-account until the organizer requests withdrawal. Still gateway-managed; we never hold the money.
- **Phone numbers are the universal identifier.** Guests do not need accounts. RSVPs and gifts are tied to E.164 phone numbers; an account can later be claimed by verifying that number.
- **Idempotency everywhere on money paths.** Every gift, webhook, and payout carries an idempotency key.
- **Soft-fail messaging.** If WhatsApp delivery fails (no WA on number, opt-out), fall back to SMS automatically.

### 4.4 High-level architecture diagram (textual)

```
                    ┌──────────────────────────┐
                    │   Mobile PWA (Next.js)   │
                    │ Organizer + guest views  │
                    └────────────┬─────────────┘
                                 │  HTTPS
                ┌────────────────┼───────────────────┐
                │                │                   │
        ┌───────▼──────┐  ┌──────▼──────┐   ┌────────▼────────┐
        │  Vercel Edge │  │  Next.js    │   │  Edge Functions │
        │  (static +   │  │  API routes │   │  (Supabase)     │
        │   ISR pages) │  │  (server)   │   │  webhooks +     │
        └──────────────┘  └──────┬──────┘   │  cron           │
                                 │          └────────┬────────┘
                                 │                   │
                ┌────────────────┼───────────────────┘
                │                │
        ┌───────▼────────────────▼───────────────────────────┐
        │             Supabase (single backend)              │
        │   Postgres  •  Auth  •  Storage  •  Realtime       │
        └───────┬────────────────────────────────────────────┘
                │
   ┌────────────┼──────────────┬────────────┬──────────────┐
   │            │              │            │              │
┌──▼───┐   ┌────▼────┐    ┌────▼────┐   ┌───▼────┐    ┌────▼───┐
│Pay-  │   │ WA      │    │ Hubtel  │   │Claude  │    │Resend  │
│stack │   │ Cloud   │    │ SMS+OTP │   │API     │    │email   │
│+ FW  │   │ API     │    │         │   │        │    │        │
└──────┘   └─────────┘    └─────────┘   └────────┘    └────────┘
```

### 4.5 Non-functional posture
See §10 for full NFRs.

---

## 5. Data model

PostgreSQL via Supabase. All tables have `id uuid pk`, `created_at`, `updated_at`. Soft-delete via `deleted_at` where state matters. Row-Level Security (RLS) policies on every table.

### 5.1 Identity & accounts

```sql
users
  id, phone (E.164, unique), email (nullable, unique), display_name,
  avatar_url, locale ('en-GH' default), verified_phone_at,
  default_payment_phone (MoMo number for receiving)

sessions               -- managed by Supabase Auth, JWT
phone_otp_requests     -- rate-limited OTP attempts (Hubtel)

vendor_users           -- separate role; a user can be both
  id, user_id fk, role ('owner' | 'staff'), vendor_id fk
```

### 5.2 Events & membership

```sql
events
  id, owner_user_id fk, slug (unique, url-safe),
  type ('wedding' in MVP; enum extendable),
  title, event_date (date), event_time (time, nullable),
  timezone ('Africa/Accra'),
  region (enum: greater_accra, ashanti, ...), city,
  venue_name, venue_address, venue_geo (geography),
  cover_image_url, theme_template_id fk,
  visibility ('public' | 'unlisted' | 'private'),
  status ('draft' | 'published' | 'archived'),
  custom_domain (nullable, premium),
  settings jsonb  -- per-event toggles (gift wall on/off, etc.)

event_members
  id, event_id fk, user_id fk,
  role ('owner' | 'editor' | 'viewer'),
  invited_by fk, accepted_at

event_pages
  id, event_id fk, sections jsonb (ordered blocks),
  published_at, draft_sections jsonb
```

### 5.3 Guests, invitations, RSVP

```sql
guests
  id, event_id fk, phone (E.164), display_name, email (nullable),
  group_tag (text, e.g. 'family', 'bride_side', 'work'),
  table_number (nullable),
  plus_ones_allowed (int default 0),
  invitation_method (enum: 'whatsapp' | 'sms' | 'email' | 'link'),
  notes,
  UNIQUE (event_id, phone)

invitations
  id, guest_id fk, event_id fk, channel ('whatsapp' | 'sms' | 'email'),
  template_id fk, sent_at, delivered_at, read_at,
  provider_message_id, provider_status, last_error,
  short_link (e.g. celebrate.gh/r/AbCd12)

rsvps
  id, guest_id fk unique, event_id fk,
  status ('yes' | 'no' | 'maybe' | 'pending'),
  plus_ones int default 0,
  dietary text,
  message text,
  responded_at, channel ('whatsapp' | 'sms' | 'web')

reminders
  id, event_id fk, scheduled_for, audience_filter jsonb,
  template_id fk, status, sent_at
```

### 5.4 Money — gifts, payouts, fees

```sql
gift_intents
  id, event_id fk, guest_id (nullable; guest may be anonymous),
  guest_phone, guest_name,
  amount_minor int (GHS pesewas), currency 'GHS',
  fee_minor int,            -- guest-paid fee, transparent
  total_minor int,          -- amount + fee
  message text,
  is_public bool,           -- show on gift wall
  status ('initiated' | 'authorized' | 'succeeded' | 'failed' | 'reversed'),
  gateway ('paystack' | 'flutterwave'),
  gateway_ref unique,
  idempotency_key unique,
  channel ('momo_mtn' | 'momo_telecel' | 'momo_at' | 'card'),
  initiated_at, settled_at, failure_reason

gifts                       -- materialized successful gifts (denormalized for fast UX)
  id, gift_intent_id fk, event_id fk, amount_minor, settled_at,
  thanked_at, thank_you_method ('whatsapp' | 'sms' | 'manual')

event_payout_accounts
  id, event_id fk, gateway,
  gateway_subaccount_id,    -- Paystack sub-account
  mode ('instant' | 'hold'),
  payout_phone (E.164 MoMo),
  payout_provider ('mtn' | 'telecel' | 'at'),
  verified_at

payouts
  id, event_id fk, amount_minor, status,
  gateway_payout_ref, requested_at, completed_at,
  failure_reason
```

### 5.5 Vendors & leads

```sql
vendors
  id, owner_user_id fk, business_name, slug unique,
  category enum (caterer, decorator, venue, photographer,
                 videographer, mc, dj, makeup_artist, bridal_wear,
                 cake, florist, transport, ...),
  description, logo_url, gallery_urls text[],
  region, city, service_areas text[],
  price_band enum ('budget' | 'mid' | 'premium' | 'luxury'),
  styles text[],            -- 'traditional', 'modern', 'minimalist'
  verification_status ('unverified' | 'verified'),
  verified_at, verifier_user_id,
  business_reg_number, business_reg_doc_url,
  active bool default true

vendor_reviews
  id, vendor_id fk, event_id fk (nullable, where it came from),
  rating int 1..5, body, author_user_id, status ('pending' | 'published' | 'flagged')

vendor_leads
  id, vendor_id fk, event_id fk, requester_user_id fk,
  budget_band, message,
  status ('new' | 'contacted' | 'quoted' | 'booked' | 'declined'),
  lead_fee_minor int,       -- charged to vendor when status -> 'contacted' or 'quoted'
  lead_fee_status ('pending' | 'charged' | 'waived'),
  created_at, vendor_responded_at
```

### 5.6 Planning, budget, checklist

```sql
budgets
  id, event_id fk unique, total_minor, generated_by_ai bool,
  source_inputs jsonb       -- inputs used for AI estimate (region, guest count, style)

budget_line_items
  id, budget_id fk, category, label, planned_minor, actual_minor,
  vendor_id (nullable fk), notes, order_index

checklists
  id, event_id fk, template_used ('ai_wedding_default' | 'manual'),
  generated_at

checklist_items
  id, checklist_id fk, title, description, due_date,
  status ('open' | 'in_progress' | 'done' | 'skipped'),
  assignee_user_id (nullable), category, order_index
```

### 5.7 AI & messaging

```sql
ai_invocations
  id, event_id fk (nullable), user_id fk, feature
    ('budget_estimator' | 'vendor_match' | 'planning_assistant' | 'rsvp_drafter'),
  model_id, input_tokens, output_tokens, cost_usd_minor,
  latency_ms, prompt_hash, status, error

message_templates           -- WhatsApp templates (Meta-approved) + SMS variants
  id, channel ('whatsapp' | 'sms'),
  meta_template_name (for WA), language, category,
  body, variables jsonb, status ('draft' | 'approved' | 'rejected')

outbound_messages
  id, event_id fk, guest_id (nullable), channel, template_id fk,
  payload jsonb, provider_message_id, status, last_error,
  sent_at, delivered_at, read_at

inbound_messages
  id, event_id fk (resolved), guest_id (resolved), channel,
  from_phone, body, media_urls text[], received_at,
  intent (nullable; 'rsvp_yes' | 'rsvp_no' | 'rsvp_maybe' |
          'dietary' | 'plus_one' | 'other'),
  ai_draft_id (nullable fk),
  handled_by_user_id (nullable), handled_at

ai_drafts                   -- drafted replies pending organizer approval
  id, inbound_message_id fk, draft_body, model_id,
  status ('pending' | 'approved' | 'edited_and_sent' | 'rejected'),
  approver_user_id, approved_at, sent_outbound_message_id fk
```

### 5.8 Plans, billing, audit

```sql
plans
  id, name ('free' | 'pro' | 'premium'),
  max_guests, custom_domain_allowed, premium_templates_allowed,
  featured_vendor_slots, monthly_price_minor

event_subscriptions
  id, event_id fk, plan_id fk, started_at, expires_at,
  gateway_subscription_ref, status

audit_log                   -- all money + permission events
  id, actor_user_id, event_id, action, target_table, target_id,
  metadata jsonb, ip, user_agent, created_at
```

### 5.9 Index & RLS notes
- `gifts(event_id, settled_at desc)` — gift wall and totals.
- `rsvps(event_id, status)` — dashboard counts.
- `vendor_leads(vendor_id, status, created_at desc)`.
- `outbound_messages(provider_message_id)` for webhook lookups.
- RLS: organizers read/write only events where they are members; guests read public event page + their own RSVP/gift (by phone-verified short link). Vendors read only their own vendor + leads.

---

## 6. Trust, money, and compliance

This is the hardest part. Treat it as load-bearing.

### 6.1 Regulatory posture (Ghana)
- The Bank of Ghana regulates **e-money issuance** and **payment service providers** under the Payment Systems and Services Act 2019 (Act 987). Holding customer funds, even briefly, in our own bank account = likely a Payment Service Provider license.
- **We avoid this by never custodying funds.** All gift money is routed via **Paystack sub-accounts** keyed to the event. Paystack is the licensed PSP; we are a software-as-a-service layer on top.
- Vendor payments in v1 are out-of-platform (lead capture only) so no escrow exposure.
- **Data Protection Act 2012 (Act 843)** — we are a data controller. Register with the Data Protection Commission before public launch. Privacy policy + DPO contact in app.
- **Consumer Protection** — clear pricing on gift fees, clear cancellation/refund policy (gifts are final), accessible support channel (WhatsApp Business).

### 6.2 Money flow

**Gift sent by guest**
1. Guest taps gift link → enters amount → chooses MoMo network or card.
2. Client requests `/api/gifts/intent` → server creates `gift_intent`, asks Paystack to initialize transaction against the event's sub-account with a guest-paid fee `ceil(amount * 0.015) + 50 pesewas`, capped reasonably.
3. Guest completes MoMo authorization on phone.
4. Paystack webhook → Edge Function verifies signature, upserts `gift_intent.status = 'succeeded'`, materializes `gifts` row, triggers thank-you suggestion.
5. Funds settle into the event sub-account immediately. Paid out per the organizer's chosen mode (instant pass-through or hold-balance, both managed by Paystack — never by us).

**Refunds / reversals**
- Default policy: **gifts are final**. They are gifts, not purchases.
- Reverse only on (a) duplicate charge / gateway error, (b) confirmed fraud, (c) guest-side MoMo dispute upheld by the telco.
- All reversals create an `audit_log` entry.

### 6.3 Fraud & abuse
- Per-event velocity limits on new sub-accounts (max GHS payout/day until verified).
- Phone-OTP-bound gift confirmation for amounts above a threshold (e.g. GHS 1,000).
- Vendor verification gates the "Celebrate Verified" badge: business registration upload, ID, two reference checks, in-person or video walkthrough.
- Automated checks: outbound message rate caps per event; suspicious-amount alerts; sub-account verification expiry alerts.
- Abuse reporting flow on every public page and gift wall.

### 6.4 Vendor onboarding (two-tier)
- **Open tier**: self-signup, profile published immediately, marked "Unverified." Lead-capture only.
- **Verified tier**: KYB (business registration), portfolio review, two references; manual ops review. Eligible for "Celebrate Verified" badge + featured slots.
- Reviews are tied to past `vendor_leads` to reduce fake reviews.

### 6.5 Privacy
- Phone numbers are PII; encrypted at rest via Supabase column encryption for `users.phone`, `guests.phone`, `gift_intents.guest_phone`.
- Public event pages **never** expose guest phone numbers, exact amounts (unless organizer opts in), or RSVP details.
- Gift wall is opt-in per gift and per event; defaults to off for amounts, on for names.

---

## 7. AI feature specs

All AI uses the **Anthropic Claude API**. Default model **claude-sonnet-4-6** for low-latency interactive features; **claude-opus-4-7** for budget estimation and the planning agent where reasoning depth matters. Every invocation logged to `ai_invocations` with token + cost accounting.

Prompt caching enabled on the system prompt for each feature (system prompts are static and long; user inputs are short).

### 7.1 Budget estimator

**Goal:** Given event type (wedding), region, guest count, and style band, produce a realistic GHS line-item budget with low/typical/high ranges per category.

**Model:** Opus 4.7. Called rarely (once per event, regenerable). Cost acceptable.

**Inputs:**
```json
{
  "event_type": "wedding",
  "region": "greater_accra",
  "city": "Accra",
  "guest_count": 250,
  "style_band": "mid",
  "components": ["traditional", "white_wedding"],
  "preferences": { "live_band": true, "videography": true }
}
```

**System prompt (excerpt):**
> You are a Ghanaian wedding planning expert. Produce a line-item budget in GHS pesewas for a wedding with the given inputs. Use current realistic Ghana market rates (refreshed seasonally by Celebrate ops). Output strictly JSON matching the schema. Include both traditional engagement and white wedding cost lines if both are requested. Account for known regional cost differences (Accra > Kumasi > Tamale, etc.). Be conservative; under-promising is better than over-promising. Never invent vendor names.

**Output schema:**
```json
{
  "total_minor": 8500000,
  "currency": "GHS",
  "assumptions": ["..."],
  "categories": [
    {
      "category": "venue",
      "low_minor": 800000, "typical_minor": 1200000, "high_minor": 1800000,
      "notes": "..."
    }, ...
  ],
  "warnings": ["..."]
}
```

**Guardrails:** schema validation; if model returns non-JSON, retry once with a stricter reminder; clamp to sane min/max per category; surface "ranges only — get real quotes via vendor leads."

### 7.2 Vendor matching

**Goal:** Given an organizer's event + budget category line, rank existing vendors by fit.

**Model:** Sonnet 4.6. Tool-use pattern: model calls a `search_vendors` tool that hits Postgres with structured filters, then re-ranks the result set.

**Tools exposed:**
- `search_vendors(category, region, price_band, styles[], limit)` → returns up to 50 candidates with embeddings.
- Re-ranking is done by Claude over a short candidate list (≤20) with a structured rationale per candidate.

**System prompt (excerpt):**
> You match Ghanaian celebration organizers to vendors. Use ONLY the candidates returned by the tool — never invent vendors. Rank by fit on budget, region proximity, style match, and verification status. Prefer "Celebrate Verified" when quality tied. Output the top 5 with a one-sentence reason each, in English.

**Output:** ordered list of `vendor_id`s + rationales, written back to the dashboard.

**Cold-start fallback:** if fewer than 5 candidates exist for the category in the region, broaden region and label results "expanded search."

### 7.3 Planning assistant (timeline + checklist + Q&A)

**Goal:** Generate a Ghanaian-wedding-aware timeline and checklist; answer planning questions conversationally.

**Model:** Opus 4.7 for the initial checklist generation (deeper reasoning), Sonnet 4.6 for follow-up Q&A.

**Generation prompt (excerpt):**
> Generate a checklist for a Ghanaian wedding with the given event date, scope (traditional + white wedding or one of them), guest count, and region. Include culturally specific items: bride-price negotiation list, family introductions, drinks list, kente coordination, MC briefing, hire of decorators for both ceremonies if applicable. Schedule items relative to event date. Output JSON matching the schema.

**Q&A behavior:** retrieves the event's context (date, region, scope, budget summary, current checklist state) and answers in 2–4 sentences. Refuses to give legal, medical, or financial advice; defers to professionals.

### 7.4 WhatsApp RSVP agent (draft-and-approve)

**Goal:** Handle inbound WhatsApp messages from guests by drafting a reply for the organizer to approve.

**Model:** Sonnet 4.6 (latency matters).

**Flow:**
1. Inbound WA message arrives via Cloud API webhook.
2. Edge Function resolves `event_id` (via the WA business phone + thread) and `guest_id` (by sender phone).
3. Classifier prompt extracts intent (`rsvp_yes`, `rsvp_no`, `rsvp_maybe`, `dietary`, `plus_one`, `other`) and proposed structured updates.
4. Drafter prompt writes a warm, culturally appropriate reply in English (matching the organizer's tone if a sample exists).
5. Organizer sees a one-tap card in the dashboard: **Approve & Send / Edit / Reject**. On approve, message goes out via Cloud API and the structured updates are applied to `rsvps` / `guests`.

**System prompt (excerpt):**
> You draft WhatsApp replies on behalf of the wedding's organizer. Tone: warm, brief, slightly formal, Ghanaian-English. Never confirm details you are not given. Never promise refunds or money. If the guest asks something you can't answer (venue change, dress code specifics), draft a reply that says the couple will follow up.

**Hard constraints (enforced in code, not just prompt):**
- No outbound message sends without organizer approval.
- No state changes to RSVP/guest until the message is approved.
- A flagged "auto-approve" mode exists in the schema for v2, but is feature-flagged OFF in MVP.

### 7.5 Avoiding "AI as buzzword"
Every AI feature ships with a non-AI fallback: budget templates, vendor filter UI, static checklist template, manual reply box. The AI is presented as a helpful assistant, not a magic box. Every AI output is editable.

---

## 8. API surface

REST over HTTPS, JSON. All endpoints under `/api`. Server-side via Next.js Route Handlers; long-running and webhook work in Supabase Edge Functions.

Auth: Supabase JWT (phone-OTP). Webhooks: signed by provider (Paystack, Meta, Hubtel) and verified server-side. All money endpoints require idempotency keys.

### 8.1 Auth
- `POST /api/auth/otp/request` — `{ phone }` → `{ request_id }`. Rate-limited.
- `POST /api/auth/otp/verify` — `{ request_id, code }` → session.
- `POST /api/auth/logout`.
- `GET  /api/me` — current user + memberships.

### 8.2 Events
- `POST /api/events` — create.
- `GET  /api/events/:id` — fetch (member only).
- `PATCH /api/events/:id` — update.
- `POST /api/events/:id/publish` / `unpublish`.
- `GET  /api/events/:id/members` / `POST /members` / `DELETE /members/:userId`.
- `GET  /e/:slug` — **public** event page (no auth).

### 8.3 Guests, RSVP, messaging
- `POST /api/events/:id/guests` (single or bulk via CSV / paste).
- `PATCH /api/events/:id/guests/:guestId`.
- `POST /api/events/:id/invitations/send` — choose template, audience filter, channel preference.
- `POST /api/events/:id/reminders/schedule`.
- `POST /api/r/:shortLink/rsvp` — **public**, phone-OTP gated, captures RSVP.
- `GET  /api/events/:id/rsvps` — dashboard.
- `POST /api/webhooks/whatsapp` — Meta Cloud API inbound (signed).
- `POST /api/webhooks/hubtel` — SMS delivery + inbound (signed).

### 8.4 Gifts & payouts
- `POST /api/gifts/intent` — `{ event_id, amount_minor, channel, guest_phone, guest_name, is_public, message }` → returns Paystack init URL + `gift_intent_id`. Idempotency-Key required.
- `GET  /api/events/:id/gifts` — organizer view.
- `GET  /e/:slug/wall` — **public**, gift wall (opt-in items only).
- `POST /api/events/:id/gifts/:id/thank` — sends WA/SMS thank-you (uses approved template).
- `POST /api/events/:id/payout-account` — create / update event sub-account + mode.
- `POST /api/events/:id/payouts` — request withdrawal (hold-balance mode only).
- `POST /api/webhooks/paystack` — signed.

### 8.5 Vendors & leads
- `GET  /api/vendors` — public list with filters.
- `GET  /api/vendors/:slug` — public profile.
- `POST /api/vendors` — vendor self-signup (separate role).
- `POST /api/vendors/:id/leads` — organizer requests quote.
- `PATCH /api/vendors/:id/leads/:leadId` — vendor updates status.
- `POST /api/reviews` — organizer reviews vendor (must be linked to a lead).

### 8.6 AI
- `POST /api/ai/budget` — `{ event_id, inputs }` → budget JSON, persisted to `budgets`.
- `POST /api/ai/match-vendors` — `{ event_id, category, price_band }` → ranked vendors.
- `POST /api/ai/plan/generate` — `{ event_id }` → checklist + timeline.
- `POST /api/ai/plan/chat` — `{ event_id, message, history }` → assistant reply.
- `POST /api/ai/rsvp/draft` — internal; called by inbound-WA webhook handler.
- `POST /api/ai/drafts/:id/approve` — organizer approves and sends.
- `POST /api/ai/drafts/:id/reject`.

### 8.7 Plans & billing
- `GET  /api/plans`.
- `POST /api/events/:id/subscribe` — upgrade plan (Paystack subscription).
- `POST /api/webhooks/paystack/subscription` — signed.

### 8.8 Observability
- `GET  /api/health`.
- Sentry capture on every server route via wrapper.

---

## 9. Screen list

PWA, mobile-first. All screens designed at 360×800 first; scale to desktop. Lighthouse PWA score target ≥ 90.

### 9.1 Public (no auth)
1. **Marketing landing** — value props, examples, "Plan your wedding."
2. **Pricing**.
3. **Vendor directory** — search + filter.
4. **Vendor profile** — gallery, reviews, "Request quote."
5. **Event page** (`/e/:slug`) — cover, story, schedule, venue map, RSVP CTA, gift CTA, gift wall (opt-in), info pages.
6. **RSVP flow** — phone OTP → status / +1 / dietary → confirmation.
7. **Gift flow** — amount → fee disclosure → MoMo network/card → confirmation → thank-you preview.

### 9.2 Organizer (auth)
8. **Onboarding wizard** — event type (wedding), date, region, guest count → seeds budget + checklist via AI.
9. **Dashboard** — event-level overview: RSVP counts, gifts to date, next 3 checklist items, vendor leads, upcoming reminders.
10. **Event editor** — page builder (sections: cover, story, schedule, venue, FAQ, gift, RSVP).
11. **Templates picker** — 3 free, premium gated.
12. **Guest list** — table view, bulk import, group tagging, table assignment, send/resend.
13. **Invitations & reminders composer** — pick template, audience filter, schedule.
14. **RSVP inbox** — incoming WA messages with **AI-drafted replies** pending approval.
15. **Gifts** — list, totals, gift wall toggles, thank-you queue.
16. **Payout settings** — sub-account creation, mode toggle (instant vs hold), MoMo verification.
17. **Budget** — AI-generated line items, edit, link to vendor leads.
18. **Checklist & timeline** — Gantt-lite mobile view; check off items.
19. **Vendor shortlist** — AI-matched vendors per category; request quote.
20. **Vendor leads tracker** — status per vendor.
21. **Team members** — invite editors/viewers.
22. **Plan & billing** — upgrade flows.
23. **Settings** — profile, phone, notifications, language (placeholder).

### 9.3 Vendor (auth, separate role)
24. **Vendor dashboard** — leads, profile completion, verification status.
25. **Vendor profile editor**.
26. **Leads inbox** — accept/respond/quote.
27. **Verification application**.

### 9.4 Admin (internal, gated)
28. **Vendor verification queue**.
29. **Money operations** — refunds, audit log search, sub-account anomalies.
30. **Template approval status** (WA template lifecycle).
31. **AI cost dashboard** — by feature, by event.

---

## 10. Non-functional requirements

### 10.1 Performance (mobile-first GH reality)
- **First Contentful Paint** ≤ 2.0s on a Moto G Power on 3G (Lighthouse mobile throttling).
- **JS budget per route**: ≤ 170KB compressed for public event pages (gift + RSVP flows); ≤ 250KB for organizer dashboard.
- **Images**: AVIF/WEBP, responsive `srcset`, max 1600px, ≤ 200KB per hero.
- **ISR** for public event pages with 60s revalidate; on-demand revalidate on edits.
- **Offline tolerance**: organizer dashboard caches last-good state via service worker. Read-only views work offline; writes queue and retry. Public event page is fully cached after first visit; RSVP and gift flows require connectivity (money paths must be online).
- API p95 ≤ 400ms for read endpoints, ≤ 1.2s for write.

### 10.2 Reliability
- **Idempotency** on `/api/gifts/intent`, all webhooks, all message sends.
- **At-least-once webhook processing**; dedupe by provider message id.
- **Retry policy**: exponential backoff for outbound messages (max 4 attempts) with WA→SMS fallback.
- **Backups**: Supabase PITR (7-day retention MVP, 30-day post-launch).
- Target uptime 99.5% MVP, 99.9% within 6 months.

### 10.3 Security
- TLS 1.2+ everywhere; HSTS preload.
- **Money paths** (`/api/gifts/*`, `/api/payouts/*`, all webhooks): rate-limited, idempotent, signature-verified, audit-logged.
- Supabase RLS policies on every table; no service-role key in the browser.
- Secrets in Vercel + Supabase env vars; never committed.
- Phone numbers encrypted at rest (column-level) and redacted in logs.
- CSP with strict `script-src`; no inline scripts in production.
- WhatsApp Cloud API webhook signature verified on every call (HMAC-SHA256 with app secret).
- Paystack webhook signature verified on every call.
- 2FA optional for organizer accounts (phone OTP already strong); required for admin role.
- Bug bounty / responsible disclosure email from launch.

### 10.4 Observability
- Sentry on client + server. PII scrubbed.
- Structured logs (JSON) shipped to Supabase Logs; key money-path logs replicated to a 90-day store.
- Product analytics (PostHog) on key funnels: signup → first event → first invite sent → first RSVP → first gift.
- AI cost dashboard with alerts at 80% of monthly budget.

### 10.5 Compliance & legal (MVP)
- Privacy policy, Terms of Service, Gift Fee Disclosure, Vendor Terms.
- DPC (Data Protection Commission) registration before public launch.
- Cookie banner only if/when we ship third-party analytics off-PostHog.
- Clear in-app fee disclosure on every gift screen (e.g. "Guest pays a small 1.5% + GHS 0.50 service fee").

### 10.6 Accessibility & internationalization
- WCAG 2.1 AA pass on RSVP and gift flows.
- All copy through an i18n layer (`next-intl` or similar). English at launch; Twi pack staged.
- Currency formatting locked to `en-GH`/`GHS` with pesewa precision.
- Timezone fixed to `Africa/Accra` for event scheduling.

---

## 11. Phased delivery plan

Two engineers (or one engineer + Claude) full-time assumption. Adjust as needed.

### Phase 0 — Foundations (2 weeks)
- Repo, CI, Vercel + Supabase wired.
- Auth (phone OTP via Hubtel).
- Base data model, RLS scaffolding.
- Empty event create + dashboard shell.
- Sentry + PostHog + audit log.
- Brand + 1 template skeleton.

**Exit:** can sign in with phone, create an empty wedding event, see an empty dashboard.

### Phase 1 — Guests & invitations (3 weeks)
- Guest CRUD + CSV import.
- WhatsApp Cloud API integration; 3 approved templates (save-the-date, invitation, reminder).
- SMS fallback via Hubtel.
- RSVP public flow with phone OTP, +1, dietary.
- RSVP inbox (read-only; no AI yet).
- Reminders scheduler (Edge Function cron).

**Exit:** Send a real WhatsApp invitation to a real phone, capture a real RSVP, see it in the dashboard.

### Phase 2 — Money: gifts (3 weeks)
- Paystack sub-account creation flow + MoMo verification.
- Gift intent + webhook flow (instant pass-through only first).
- Gift wall (opt-in).
- Thank-you queue using a 4th WA template.
- Hold-balance mode added once instant is stable.
- Refund/fraud ops console (admin).

**Exit:** A real guest sends a real GHS 100 gift; it lands in the couple's MoMo within minutes; couple sends thank-you in two taps.

### Phase 3 — Event page builder + templates (2 weeks)
- 3 polished templates, mobile-first.
- Section blocks (cover, story, schedule, venue, FAQ, gift CTA, RSVP CTA).
- Custom slug + (premium) custom subdomain stub.
- ISR for public pages.

**Exit:** Couples can publish a beautiful, fast event page.

### Phase 4 — Vendors directory + leads (3 weeks)
- Vendor self-signup + profile editor.
- Public directory + filters.
- Lead-request flow + status tracking.
- Reviews tied to leads.
- Admin verification queue + "Celebrate Verified" badge.

**Exit:** Organizer can browse vendors, request quotes, manage leads. Initial 30–50 hand-vetted vendors live.

### Phase 5 — AI layer (3 weeks)
- Budget estimator (Opus 4.7).
- Planning assistant — checklist generation + Q&A.
- Vendor matching (tool-use + Sonnet 4.6).
- **WhatsApp RSVP drafter (human-in-loop)** in the RSVP inbox.
- AI cost dashboard.

**Exit:** All four AI features live; organizer feels Celebrate is meaningfully smarter than the alternative.

### Phase 6 — Plans, billing, polish (2 weeks)
- Free / Pro / Premium plans.
- Paystack subscriptions.
- Featured vendor placements.
- Accessibility audit + Lighthouse pass.
- Bug bash, load test, security review.

**Exit:** Public launch readiness.

### Phase 7 — Public launch + 30-day stabilization
- Beta cohort (20 weddings) before public launch.
- DPC registration filed.
- Bug bounty live.
- Support: WhatsApp Business inbox + in-app help.

### v2 candidates (post-launch, prioritized)
1. **Funerals/memorials** — memorial page, condolence cash, obituary RSVP, funeral-specific timeline + vendor categories. Likely the second wedge.
2. **In-platform vendor booking + escrow commission**.
3. **Native Android wrapper** if PWA limits hurt.
4. **Twi UI pack** + Twi WA templates.
5. **Professional planner B2B accounts** (manage multiple client events).
6. **Custom domains** widely available.
7. **Autonomous WhatsApp RSVP agent** (narrow intents) after we have data on draft-and-approve accuracy.
8. **Parties, naming ceremonies, recurring social-group events**.

---

## 12. Risks & open questions

| Risk | Mitigation |
|---|---|
| BoG regulatory creep into "any platform touching money" | Stay strictly non-custodial; document money flow; engage counsel before launch. |
| WhatsApp template approval delays | Submit all 5 MVP templates in Phase 1 week 1; SMS fallback always available. |
| Paystack MoMo reliability incidents | Flutterwave shim behind same interface, switchable per gateway code path. |
| Vendor cold start (chicken-and-egg) | Hand-sign 30–50 vendors before public launch; offer free verified status to first cohort. |
| AI cost overruns | Hard monthly budget; rate limit per event; cache identical-input budget estimates. |
| Fraud on gift wall (fake "GHS 10,000" gifts shown) | Only settled gifts appear on wall; amount visibility opt-in. |
| Low-bandwidth UX failures | Lighthouse mobile-3G in CI; performance budgets enforced. |
| Couples already used Joy/Zola — switching cost | Importers for guest list CSV; templates designed to feel premium from minute one. |

### Open questions to resolve before Phase 0
1. Domain confirmed (`celebrate.gh`?).
2. Legal entity, bank account, Paystack/Flutterwave merchant onboarding kicked off.
3. Initial vendor partnerships shortlist for hand-curated tier.
4. Brand identity / design system (template direction).
5. Beta cohort sourcing — first 20 weddings.

---

*End of SPEC.md — ready for review. Do not start implementation until the open questions in §12 are settled and any spec revisions are merged.*
