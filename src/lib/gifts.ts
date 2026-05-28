// Pure, client-safe helpers for the gift flow. No DB, no node-only modules.
// Server-only helpers (random-ref generation) live in gifts-server.ts.

import { giftFeeMinor, totalWithFeeMinor } from "@/lib/money";

export const GIFT_CHANNELS = ["momo_mtn", "momo_telecel", "momo_at", "card"] as const;
export type GiftChannel = (typeof GIFT_CHANNELS)[number];

export const GIFT_CHANNEL_LABEL: Record<GiftChannel, string> = {
  momo_mtn: "MTN MoMo",
  momo_telecel: "Telecel Cash",
  momo_at: "AirtelTigo Money",
  card: "Card",
};

// Map our internal channel to Paystack's expected `mobile_money[provider]`.
// Card flows do not need a mobile_money block.
export function paystackMomoProvider(channel: GiftChannel): "mtn" | "vod" | "atl" | null {
  switch (channel) {
    case "momo_mtn":
      return "mtn";
    case "momo_telecel":
      return "vod";       // Telecel was previously Vodafone Cash; Paystack still uses 'vod'
    case "momo_at":
      return "atl";
    case "card":
      return null;
  }
}

// Minimum and maximum gift amounts (in pesewas). These are platform-level
// guardrails; the gateway has its own limits too.
export const MIN_GIFT_MINOR = 500;       // GHS 5.00
export const MAX_GIFT_MINOR = 5_000_000; // GHS 50,000 — anything larger needs ops review

export function clampGiftAmountMinor(amountMinor: number): {
  ok: true;
  amountMinor: number;
} | { ok: false; reason: "too_small" | "too_large" | "not_integer" } {
  if (!Number.isInteger(amountMinor)) return { ok: false, reason: "not_integer" };
  if (amountMinor < MIN_GIFT_MINOR) return { ok: false, reason: "too_small" };
  if (amountMinor > MAX_GIFT_MINOR) return { ok: false, reason: "too_large" };
  return { ok: true, amountMinor };
}

// Compose the totals a guest will see before they confirm.
export function quoteGift(amountMinor: number): {
  amountMinor: number;
  feeMinor: number;
  totalMinor: number;
} {
  const fee = giftFeeMinor(amountMinor);
  const total = totalWithFeeMinor(amountMinor);
  return { amountMinor, feeMinor: fee, totalMinor: total };
}

// State machine: which transitions are valid?
export type IntentStatus = "initiated" | "authorized" | "succeeded" | "failed" | "reversed";

const ALLOWED: Record<IntentStatus, IntentStatus[]> = {
  initiated: ["authorized", "succeeded", "failed"],
  authorized: ["succeeded", "failed"],
  succeeded: ["reversed"],
  failed: [], // terminal
  reversed: [], // terminal
};

export function canTransition(from: IntentStatus, to: IntentStatus): boolean {
  if (from === to) return true; // idempotent re-application of the same status
  return ALLOWED[from].includes(to);
}
