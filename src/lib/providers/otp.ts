import { env } from "@/lib/env";

export interface OtpProvider {
  send(phone: string, code: string): Promise<{ ok: true } | { ok: false; error: string }>;
  name(): string;
}

class MockOtpProvider implements OtpProvider {
  name() {
    return "mock";
  }
  async send(phone: string, code: string) {
    // In dev: surface the OTP via server logs so devs can sign in without a real SMS gateway.
    console.log(`[mock-otp] phone=${phone} code=${code}`);
    return { ok: true as const };
  }
}

class HubtelOtpProvider implements OtpProvider {
  name() {
    return "hubtel";
  }
  async send(phone: string, code: string) {
    const e = env();
    if (!e.HUBTEL_CLIENT_ID || !e.HUBTEL_CLIENT_SECRET) {
      return { ok: false as const, error: "Hubtel credentials missing" };
    }
    const auth = Buffer.from(`${e.HUBTEL_CLIENT_ID}:${e.HUBTEL_CLIENT_SECRET}`).toString("base64");
    const url = new URL("https://sms.hubtel.com/v1/messages/send");
    url.searchParams.set("from", e.HUBTEL_SENDER_ID);
    url.searchParams.set("to", phone.replace("+", ""));
    url.searchParams.set("content", `Your Celebrate code is ${code}. It expires in 5 minutes.`);
    const r = await fetch(url, { headers: { Authorization: `Basic ${auth}` } });
    if (!r.ok) return { ok: false as const, error: `Hubtel error ${r.status}` };
    return { ok: true as const };
  }
}

let cached: OtpProvider | null = null;

export function getOtpProvider(): OtpProvider {
  if (cached) return cached;
  cached = env().OTP_PROVIDER === "hubtel" ? new HubtelOtpProvider() : new MockOtpProvider();
  return cached;
}
