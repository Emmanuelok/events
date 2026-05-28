import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { canAccessEvent } from "@/lib/event-access";
import { db } from "@/lib/db";
import { getImageProvider } from "@/lib/providers/image";
import { pageDesignSchema, SECTION_TYPES, type PageDesign } from "@/lib/design/types";

const schema = z.object({
  prompt: z.string().min(5).max(1000),
  aspectRatio: z.enum(["16:9", "4:5", "1:1", "9:16"]).default("16:9"),
  attachTo: z
    .object({
      sectionType: z.enum(SECTION_TYPES),
    })
    .optional(),
});

export async function POST(req: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  if (!(await canAccessEvent(user.id, eventId, "editor"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const event = await db.event.findUnique({ where: { id: eventId } });
  if (!event) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  let generated;
  try {
    const provider = getImageProvider();
    generated = await provider.generate({
      prompt: parsed.data.prompt,
      aspectRatio: parsed.data.aspectRatio,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Image generation failed" },
      { status: 502 },
    );
  }

  const asset = await db.mediaAsset.create({
    data: {
      eventId: event.id,
      kind: "image",
      url: generated.url,
      prompt: parsed.data.prompt,
      provider: generated.provider,
      modelId: generated.modelId,
      mimeType: generated.mimeType,
      width: generated.width,
      height: generated.height,
      bytes: generated.bytes,
    },
  });

  // Optionally attach to a section in the current design.
  if (parsed.data.attachTo) {
    const existing = pageDesignSchema.safeParse(event.pageDesign);
    if (existing.success) {
      const design: PageDesign = existing.data;
      const target = parsed.data.attachTo.sectionType;
      const sections = design.sections.map((s) => {
        if (s.type !== target) return s;
        if (s.type === "hero" || s.type === "story") {
          return { ...s, imageUrl: generated.url };
        }
        return s;
      });
      const nextDesign: PageDesign = {
        ...design,
        sections,
        updatedAt: new Date().toISOString(),
      };
      await db.event.update({
        where: { id: event.id },
        data: {
          pageDesign: nextDesign as unknown as object,
          designVersion: { increment: 1 },
        },
      });
    }
  }

  return NextResponse.json({
    asset: {
      id: asset.id,
      url: asset.url,
      provider: asset.provider,
      modelId: asset.modelId,
      width: asset.width,
      height: asset.height,
    },
  });
}
