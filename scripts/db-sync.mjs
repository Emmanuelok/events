// Applied during Vercel build: if DATABASE_URL is set, push the Prisma schema
// to that database so its tables match the code. Without this step, fresh
// Vercel deploys point at a Postgres that has no tables, and every query
// throws.
//
// Skipped silently when DATABASE_URL is missing so local typechecks and
// disconnected builds still pass.

import { execSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";

// Load .env so local `npm run build` works without exporting envs to the shell.
// Vercel already exposes envs in process.env, so this is a local convenience.
if (existsSync(".env") && !process.env.DATABASE_URL) {
  try {
    const lines = readFileSync(".env", "utf8").split("\n");
    for (const line of lines) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (!m) continue;
      const key = m[1];
      let value = m[2];
      if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
      if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
      if (!process.env[key]) process.env[key] = value;
    }
  } catch {
    // best-effort
  }
}

if (!process.env.DATABASE_URL) {
  console.log(
    "[db-sync] DATABASE_URL not set — skipping `prisma db push`. The app will surface a clear setup error at runtime until you set it.",
  );
  process.exit(0);
}

console.log("[db-sync] DATABASE_URL detected — applying schema with `prisma db push`...");
try {
  execSync("npx prisma db push --accept-data-loss --skip-generate", {
    stdio: "inherit",
    env: process.env,
  });
  console.log("[db-sync] Schema applied successfully.");
} catch (err) {
  console.error("[db-sync] `prisma db push` failed:", err instanceof Error ? err.message : err);
  process.exit(1);
}
