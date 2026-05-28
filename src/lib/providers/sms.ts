import { env } from "@/lib/env";

export interface SmsMessage {
  to: string; // E.164
  body: string;
}

export interface SmsProvider {
  name(): "mock" | "hubtel";
  send(m: SmsMessage): Promise<{ ok: true; messageId: string } | { ok: false; error: string }>;
}

class MockSmsProvider implements SmsProvider {
  name() {
    return "mock" as const;
  }
  async send(m: SmsMessage) {
    console.log(`[mock-sms] to=${m.to} body="${m.body.slice(0, 80)}${m.body.length > 80 ? "…" : ""}"`);
    return { ok: true as const, messageId: `mock-sms-${Date.now()}` };
  }
}

class HubtelSmsProvider implements SmsProvider {
  name() {
    return "hubtel" as const;
  }
  async send(m: SmsMessage) {
    const e = env();
    if (!e.HUBTEL_CLIENT_ID || !e.HUBTEL_CLIENT_SECRET) {
      return { ok: false as const, error: "Hubtel credentials missing" };
    }
    const auth = Buffer.from(`${e.HUBTEL_CLIENT_ID}:${e.HUBTEL_CLIENT_SECRET}`).toString("base64");
    const url = new URL("https://sms.hubtel.com/v1/messages/send");
    url.searchParams.set("from", e.HUBTEL_SENDER_ID);
    url.searchParams.set("to", m.to.replace("+", ""));
    url.searchParams.set("content", m.body);
    const r = await fetch(url.toString(), { headers: { Authorization: `Basic ${auth}` } });
    if (!r.ok) return { ok: false as const, error: `Hubtel returned ${r.status}` };
    const data = (await r.json().catch(() => ({}))) as { messageId?: string };
    return { ok: true as const, messageId: data.messageId ?? `hubtel-${Date.now()}` };
  }
}

// Reuses OTP_PROVIDER env (Hubtel covers both OTP and bulk SMS via the same account).
let cached: SmsProvider | null = null;
export function getSmsProvider(): SmsProvider {
  if (cached) return cached;
  cached = env().OTP_PROVIDER === "hubtel" ? new HubtelSmsProvider() : new MockSmsProvider();
  return cached;
}
