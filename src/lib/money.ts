// Money helpers — all amounts are integer minor units (GHS pesewas).
// 100 pesewas = 1 GHS.

export const PESEWAS_PER_CEDI = 100;

export function ghsToMinor(cedis: number): number {
  if (!Number.isFinite(cedis)) throw new Error("ghsToMinor: not finite");
  return Math.round(cedis * PESEWAS_PER_CEDI);
}

export function minorToGhs(minor: number): number {
  if (!Number.isInteger(minor)) {
    throw new Error("minorToGhs: minor must be an integer");
  }
  return minor / PESEWAS_PER_CEDI;
}

const formatter = new Intl.NumberFormat("en-GH", {
  style: "currency",
  currency: "GHS",
  maximumFractionDigits: 2,
});

export function formatGhs(minor: number): string {
  return formatter.format(minorToGhs(minor));
}

// Guest-paid platform fee on cash gifts: 1.5% + GHS 0.50, capped at GHS 50.
// Returned in minor units. Pure function.
export function giftFeeMinor(amountMinor: number): number {
  if (!Number.isInteger(amountMinor) || amountMinor < 0) {
    throw new Error("giftFeeMinor: amount must be a non-negative integer");
  }
  const percent = Math.ceil(amountMinor * 0.015);
  const fixed = 50; // 50 pesewas
  const capped = Math.min(percent + fixed, 5000); // cap at GHS 50
  return capped;
}

export function totalWithFeeMinor(amountMinor: number): number {
  return amountMinor + giftFeeMinor(amountMinor);
}
