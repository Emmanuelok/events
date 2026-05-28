import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { uniqueEventSlug } from "@/lib/slug";

const schema = z.object({
  brideName: z.string().min(1).max(80),
  groomName: z.string().min(1).max(80),
  eventDate: z.string().refine((s) => !Number.isNaN(Date.parse(s)), "invalid date"),
  region: z.string(),
  city: z.string().min(1).max(80),
  guestCount: z.number().int().min(10).max(5000),
  styleBand: z.enum(["budget", "mid", "premium", "luxury"]),
  components: z.array(z.enum(["traditional", "white_wedding"])).min(1),
});

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input", details: parsed.error.flatten() }, { status: 400 });
  }
  const data = parsed.data;
  const slug = await uniqueEventSlug(`${data.brideName}-${data.groomName}`);
  const title = `${data.brideName} & ${data.groomName}`;

  const event = await db.event.create({
    data: {
      slug,
      title,
      type: "wedding",
      ownerId: user.id,
      brideName: data.brideName,
      groomName: data.groomName,
      eventDate: new Date(data.eventDate),
      region: data.region as never,
      city: data.city,
      guestCount: data.guestCount,
      settings: {
        styleBand: data.styleBand,
        components: data.components,
      },
      members: {
        create: { userId: user.id, role: "owner" },
      },
    },
  });

  return NextResponse.json({ event: { id: event.id, slug: event.slug } });
}
