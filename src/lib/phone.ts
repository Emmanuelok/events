// Normalize a Ghanaian phone number to E.164 (+233XXXXXXXXX).
// Accepts: 0244123456, 233244123456, +233244123456, with spaces/dashes.
const GH_LOCAL_LEN = 10; // 0XX XXX XXXX
const GH_NATIONAL_LEN = 9; // 24 XXX XXXX
const GH_CC = "233";

export function normalizeGhPhone(input: string): string | null {
  if (!input) return null;
  const digits = input.replace(/[^\d+]/g, "");
  const noPlus = digits.startsWith("+") ? digits.slice(1) : digits;
  if (/[^\d]/.test(noPlus)) return null;

  let national: string;
  if (noPlus.startsWith(GH_CC) && noPlus.length === GH_CC.length + GH_NATIONAL_LEN) {
    national = noPlus.slice(GH_CC.length);
  } else if (noPlus.length === GH_LOCAL_LEN && noPlus.startsWith("0")) {
    national = noPlus.slice(1);
  } else if (noPlus.length === GH_NATIONAL_LEN && !noPlus.startsWith("0")) {
    national = noPlus;
  } else {
    return null;
  }

  // Ghanaian mobile prefixes start with 2 or 5; first national digit is one of 2,5.
  // (Landline 3 numbers exist but we don't need them for SMS/WA targeting.)
  const first = national[0];
  if (first !== "2" && first !== "5" && first !== "3") return null;

  return `+${GH_CC}${national}`;
}

export function isE164Gh(input: string): boolean {
  return /^\+233[235]\d{8}$/.test(input);
}
