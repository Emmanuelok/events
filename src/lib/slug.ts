import { db } from "@/lib/db";
import { generateSlug } from "@/lib/crypto";

const RESERVED = new Set([
  "api",
  "login",
  "logout",
  "dashboard",
  "onboarding",
  "e",
  "r",
  "admin",
  "vendors",
  "vendor",
  "pricing",
  "about",
  "privacy",
  "terms",
  "help",
  "settings",
]);

export function slugify(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

export async function uniqueEventSlug(desired: string): Promise<string> {
  const base = slugify(desired) || "event";
  for (let i = 0; i < 5; i++) {
    const candidate = i === 0 ? base : `${base}-${generateSlug().slice(0, 4)}`;
    if (RESERVED.has(candidate)) continue;
    const existing = await db.event.findUnique({ where: { slug: candidate } });
    if (!existing) return candidate;
  }
  return `${base}-${generateSlug().slice(0, 6)}`;
}
