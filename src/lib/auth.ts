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
    const session = await db.session.findUnique({
      where: { token },
      include: { user: true },
    });
    if (session && session.expiresAt >= new Date()) return session.user;
    if (session) {
      await db.session.delete({ where: { id: session.id } }).catch(() => {});
    }
  }

  // Demo mode: auto-sign-in as a fixed user so reviewers can browse without OTP.
  if (env().DEMO_MODE) {
    return getOrCreateDemoUser();
  }
  return null;
}

async function getOrCreateDemoUser() {
  const existing = await db.user.findUnique({ where: { phone: DEMO_PHONE } });
  if (existing) return existing;
  return db.user.create({
    data: {
      phone: DEMO_PHONE,
      displayName: DEMO_NAME,
      verifiedAt: new Date(),
    },
  });
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) throw new Error("UNAUTHENTICATED");
  return user;
}
