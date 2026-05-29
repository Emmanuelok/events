// SSE streaming endpoint for the Concierge.
// POST sends a user message and streams events back as Server-Sent Events.
// GET returns conversation history.

import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { canAccessEvent } from "@/lib/event-access";
import { runAgent } from "@/lib/concierge/agent";
import { getOrCreateConversation, loadHistory } from "@/lib/concierge/memory";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const postSchema = z.object({
  message: z.string().min(1).max(4000),
});

export async function POST(req: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  if (!(await canAccessEvent(user.id, eventId, "editor"))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = postSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  const conv = await getOrCreateConversation(eventId, user.id);

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const enqueue = (event: string, data: unknown) => {
        const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
        controller.enqueue(encoder.encode(payload));
      };
      try {
        for await (const e of runAgent({
          conversationId: conv.id,
          ctx: { eventId, userId: user.id },
          userMessage: parsed.data.message,
        })) {
          enqueue(e.type, e);
        }
      } catch (err) {
        enqueue("error", { error: err instanceof Error ? err.message : String(err) });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

export async function GET(_req: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  if (!(await canAccessEvent(user.id, eventId))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const conv = await getOrCreateConversation(eventId, user.id);
  const full = await loadHistory(conv.id);
  return NextResponse.json({
    conversationId: conv.id,
    summary: conv.summary,
    messages: full.messages.map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      toolName: m.toolName,
      toolResult: m.toolResult,
      createdAt: m.createdAt.toISOString(),
    })),
  });
}
