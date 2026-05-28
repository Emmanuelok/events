import { env } from "@/lib/env";

export interface WhatsAppMessage {
  to: string; // E.164
  body: string;
}

export interface WhatsAppProvider {
  send(message: WhatsAppMessage): Promise<{ ok: true; messageId: string } | { ok: false; error: string }>;
  name(): string;
}

class MockWhatsAppProvider implements WhatsAppProvider {
  name() {
    return "mock";
  }
  async send(m: WhatsAppMessage) {
    console.log(`[mock-whatsapp] to=${m.to} body=${m.body}`);
    return { ok: true as const, messageId: `mock-${Date.now()}` };
  }
}

class MetaWhatsAppProvider implements WhatsAppProvider {
  name() {
    return "meta";
  }
  async send(m: WhatsAppMessage) {
    const e = env();
    if (!e.META_WHATSAPP_PHONE_NUMBER_ID || !e.META_WHATSAPP_TOKEN) {
      return { ok: false as const, error: "Meta WhatsApp credentials missing" };
    }
    const url = `https://graph.facebook.com/v21.0/${e.META_WHATSAPP_PHONE_NUMBER_ID}/messages`;
    const r = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${e.META_WHATSAPP_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: m.to.replace("+", ""),
        type: "text",
        text: { body: m.body },
      }),
    });
    if (!r.ok) {
      const err = await r.text().catch(() => "");
      return { ok: false as const, error: `Meta error ${r.status}: ${err.slice(0, 200)}` };
    }
    const data = (await r.json()) as { messages?: Array<{ id: string }> };
    const id = data.messages?.[0]?.id ?? "";
    return { ok: true as const, messageId: id };
  }
}

let cached: WhatsAppProvider | null = null;

export function getWhatsAppProvider(): WhatsAppProvider {
  if (cached) return cached;
  cached =
    env().WHATSAPP_PROVIDER === "meta" ? new MetaWhatsAppProvider() : new MockWhatsAppProvider();
  return cached;
}
