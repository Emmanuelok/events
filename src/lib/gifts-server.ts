// Server-only gift helpers — anything that needs node-only modules lives here.

import { randomToken } from "@/lib/crypto";

// Generate a stable gift reference — used as both the gateway reference and
// our idempotency key on retry. Format: GIFT-<eventShort>-<rand>.
export function generateGiftRef(eventId: string): string {
  const eventShort = eventId.slice(-6).toUpperCase();
  const rand = randomToken(6).toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
  return `GIFT-${eventShort}-${rand}`;
}
