import { env } from "@/lib/env";

export interface GenerateImageParams {
  prompt: string;
  aspectRatio?: "16:9" | "4:5" | "1:1" | "9:16";
}

export interface GeneratedImage {
  url: string;          // either an https URL or a data:image/...;base64,... URL
  mimeType: string;
  width?: number;
  height?: number;
  bytes?: number;
  provider: "mock" | "gemini" | "replicate";
  modelId?: string;
}

export interface ImageProvider {
  name(): "mock" | "gemini" | "replicate";
  generate(p: GenerateImageParams): Promise<GeneratedImage>;
}

// ─── Mock ───

class MockImageProvider implements ImageProvider {
  name() {
    return "mock" as const;
  }
  async generate(p: GenerateImageParams): Promise<GeneratedImage> {
    // Deterministic-ish placeholder. Lorem Picsum is good enough for dev visuals.
    const [w, h] = ratioToSize(p.aspectRatio ?? "16:9");
    const seed = encodeURIComponent(p.prompt).slice(0, 24) || "celebrate";
    return {
      url: `https://picsum.photos/seed/${seed}/${w}/${h}`,
      mimeType: "image/jpeg",
      width: w,
      height: h,
      provider: "mock",
      modelId: "picsum",
    };
  }
}

// ─── Gemini Imagen 4 ───

class GeminiImageProvider implements ImageProvider {
  name() {
    return "gemini" as const;
  }
  async generate(p: GenerateImageParams): Promise<GeneratedImage> {
    const e = env();
    if (!e.GEMINI_API_KEY) throw new Error("GEMINI_API_KEY missing");
    const model = e.GEMINI_IMAGE_MODEL;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
      model,
    )}:predict?key=${encodeURIComponent(e.GEMINI_API_KEY)}`;

    const body = {
      instances: [{ prompt: p.prompt }],
      parameters: {
        sampleCount: 1,
        aspectRatio: p.aspectRatio ?? "16:9",
        personGeneration: "allow_adult",
      },
    };

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Gemini Imagen error ${res.status}: ${text.slice(0, 300)}`);
    }

    const data = (await res.json()) as {
      predictions?: Array<{ bytesBase64Encoded?: string; mimeType?: string }>;
    };
    const pred = data.predictions?.[0];
    if (!pred?.bytesBase64Encoded) throw new Error("Gemini returned no image");
    const mimeType = pred.mimeType ?? "image/png";
    const [w, h] = ratioToSize(p.aspectRatio ?? "16:9");
    return {
      url: `data:${mimeType};base64,${pred.bytesBase64Encoded}`,
      mimeType,
      width: w,
      height: h,
      provider: "gemini",
      modelId: model,
    };
  }
}

// ─── Helpers ───

function ratioToSize(ratio: "16:9" | "4:5" | "1:1" | "9:16"): [number, number] {
  switch (ratio) {
    case "16:9":
      return [1600, 900];
    case "4:5":
      return [1080, 1350];
    case "1:1":
      return [1024, 1024];
    case "9:16":
      return [900, 1600];
  }
}

let cached: ImageProvider | null = null;

export function getImageProvider(): ImageProvider {
  if (cached) return cached;
  const p = env().IMAGE_PROVIDER;
  cached = p === "gemini" ? new GeminiImageProvider() : new MockImageProvider();
  return cached;
}
