import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// Reset module registry per test so the cached provider singleton can pick up env changes.
beforeEach(() => {
  vi.resetModules();
  vi.unstubAllEnvs();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("image provider", () => {
  it("uses the mock provider by default and returns a usable URL", async () => {
    vi.stubEnv("IMAGE_PROVIDER", "mock");
    vi.stubEnv("DATABASE_URL", "postgresql://x:y@localhost:5432/celebrate");
    vi.stubEnv("SESSION_SECRET", "test-secret-test-secret-test-secret-1234");
    const mod = await import("./image");
    const provider = mod.getImageProvider();
    expect(provider.name()).toBe("mock");
    const out = await provider.generate({ prompt: "Ghanaian couple, kente", aspectRatio: "16:9" });
    expect(out.url).toMatch(/^https?:\/\//);
    expect(out.provider).toBe("mock");
    expect(out.width).toBeGreaterThan(0);
    expect(out.height).toBeGreaterThan(0);
  });

  it("selects the gemini provider when configured", async () => {
    vi.stubEnv("IMAGE_PROVIDER", "gemini");
    vi.stubEnv("GEMINI_API_KEY", "fake-key");
    vi.stubEnv("DATABASE_URL", "postgresql://x:y@localhost:5432/celebrate");
    vi.stubEnv("SESSION_SECRET", "test-secret-test-secret-test-secret-1234");
    const mod = await import("./image");
    const provider = mod.getImageProvider();
    expect(provider.name()).toBe("gemini");
  });
});
