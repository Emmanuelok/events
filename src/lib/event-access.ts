import { db } from "@/lib/db";
import { env } from "@/lib/env";

export type AccessRole = "owner" | "editor" | "viewer";

export async function canAccessEvent(
  userId: string,
  eventId: string,
  required: AccessRole = "viewer",
): Promise<boolean> {
  // Demo mode: anyone with a session can touch any event.
  if (env().DEMO_MODE) {
    const event = await db.event.findUnique({ where: { id: eventId }, select: { id: true } });
    return !!event;
  }

  const event = await db.event.findUnique({
    where: { id: eventId },
    select: { ownerId: true, members: { where: { userId }, select: { role: true } } },
  });
  if (!event) return false;
  if (event.ownerId === userId) return true;
  const role = event.members[0]?.role;
  if (!role) return false;
  if (required === "viewer") return true;
  if (required === "editor") return role === "editor" || role === "owner";
  return role === "owner";
}

export async function requireEventAccess(userId: string, eventId: string, required: AccessRole = "viewer") {
  const ok = await canAccessEvent(userId, eventId, required);
  if (!ok) throw new Error("FORBIDDEN");
}
