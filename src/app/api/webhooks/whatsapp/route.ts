// Meta WhatsApp Cloud API webhook.
// GET = verification handshake. POST = inbound messages.

import { NextResponse } from "next/server";
import nodeCrypto from "node:crypto";
import { env } from "@/lib/env";
import { ingestInboundMessage } from "@/lib/messaging/ingest";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");
  const e = env();
  if (mode === "subscribe" && token && e.META_WHATSAPP_VERIFY_TOKEN === token) {
    return new NextResponse(challenge ?? "", { status: 200 });
  }
  return new NextResponse("Forbidden", { status: 403 });
}

export async function POST(req: Request) {
  const e = env();
  const rawBody = await req.text();

  // Verify signature when the provider is live (Meta sets X-Hub-Signature-256)
  if (e.WHATSAPP_PROVIDER === "meta") {
    const signature = req.headers.get("x-hub-signature-256");
    if (!signature || !e.META_WHATSAPP_TOKEN) {
      return NextResponse.json({ error: "Unsigned" }, { status: 401 });
    }
    const expected =
      "sha256=" +
      nodeCrypto
        .createHmac("sha256", e.META_WHATSAPP_TOKEN)
        .update(rawBody)
        .digest("hex");
    let ok = false;
    if (expected.length === signature.length) {
      try {
        ok = nodeCrypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
      } catch {
        ok = false;
      }
    }
    if (!ok) return NextResponse.json({ error: "Bad signature" }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Bad JSON" }, { status: 400 });
  }

  const messages = extractIncomingMessages(payload);
  const ingested: Array<{ messageId: string; intent?: string }> = [];
  for (const msg of messages) {
    if (!msg.body || !msg.from) continue;
    const r = await ingestInboundMessage({
      fromPhone: msg.from,
      body: msg.body,
      providerMessageId: msg.id,
      channel: "whatsapp",
    });
    ingested.push({ messageId: r.messageId, intent: r.intent });
  }
  return NextResponse.json({ ok: true, ingested: ingested.length });
}

// Meta's payload shape: entry[].changes[].value.messages[]
function extractIncomingMessages(
  payload: unknown,
): Array<{ from: string; id: string; body: string }> {
  if (!payload || typeof payload !== "object") return [];
  const p = payload as Record<string, unknown>;
  const entries = Array.isArray(p.entry) ? (p.entry as unknown[]) : [];
  const out: Array<{ from: string; id: string; body: string }> = [];
  for (const entry of entries) {
    if (!entry || typeof entry !== "object") continue;
    const e = entry as Record<string, unknown>;
    const changes = Array.isArray(e.changes) ? (e.changes as unknown[]) : [];
    for (const ch of changes) {
      if (!ch || typeof ch !== "object") continue;
      const c = ch as Record<string, unknown>;
      const value = c.value as Record<string, unknown> | undefined;
      const messages = Array.isArray(value?.messages) ? (value!.messages as unknown[]) : [];
      for (const m of messages) {
        if (!m || typeof m !== "object") continue;
        const mm = m as Record<string, unknown>;
        const from = typeof mm.from === "string" ? mm.from : "";
        const id = typeof mm.id === "string" ? mm.id : "";
        const text = (mm.text as { body?: string } | undefined)?.body;
        if (from && id && text) out.push({ from, id, body: text });
      }
    }
  }
  return out;
}
