import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { randomToken } from "@/lib/crypto";
import { env } from "@/lib/env";

const SESSION_COOKIE = "celebrate_session";
const SESSION_DAYS = 30;
const DEMO_PHONE = "+233000000000";
const DEMO_NAME = "Demo Organizer";

export async function createSession(userId: string): Promise<string> {
  const token = randomToken(32);
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await db.session.create({ data: { userId, token, expiresAt } });
  const store = await cookies();
  store.set({
    name: SESSION_COOKIE,
    value: token,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
  return token;
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) {
    await db.session.deleteMany({ where: { token } }).catch(() => {});
  }
  store.delete(SESSION_COOKIE);
}

export async function getCurrentUser() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) {
    try {
      const session = await db.session.findUnique({
        where: { token },
        include: { user: true },
      });
      if (session && session.expiresAt >= new Date()) return session.user;
      if (session) {
        await db.session.delete({ where: { id: session.id } }).catch(() => {});
      }
    } catch {
      // DB unreachable or schema missing — fall through. The demo-mode branch
      // below will return null too, which the landing page can render around.
    }
  }

  if (env().DEMO_MODE) {
    return getOrCreateDemoUser();
  }
  return null;
}

async function getOrCreateDemoUser() {
  try {
    const existing = await db.user.findUnique({ where: { phone: DEMO_PHONE } });
    if (existing) return existing;
    return await db.user.create({
      data: {
        phone: DEMO_PHONE,
        displayName: DEMO_NAME,
        verifiedAt: new Date(),
      },
    });
  } catch {
    // DB unreachable. Return null so callers (landing page, dashboard) can
    // render a friendly setup-required message instead of a crash page.
    return null;
  }
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) throw new Error("UNAUTHENTICATED");
  return user;
}

// Quick health probe used by /api/health and the setup banner.
export async function probeDb(): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await db.$queryRaw`SELECT 1`;
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
