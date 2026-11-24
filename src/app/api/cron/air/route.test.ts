import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidateTag: vi.fn(), unstable_cache: (fn: unknown) => fn }));

const { POST } = await import("./route");

const SECRET = "c".repeat(40);
const call = (authorization?: string) =>
  POST(new Request("http://localhost/api/cron/air", { method: "POST", headers: authorization ? { authorization } : {} }));

describe("POST /api/cron/air", () => {
  beforeEach(() => {
    vi.stubEnv("WEATHER_SAMPLE_DATA", "");
    vi.stubEnv("DATABASE_URL", "");
    vi.stubEnv("POSTGRES_URL", "");
    vi.stubEnv("CRON_SECRET", SECRET);
  });

  afterEach(() => vi.unstubAllEnvs());

  it("turns away callers without a valid token, before touching anything", async () => {
    for (const header of [undefined, "Bearer nope", `Bearer ${"x".repeat(40)}`]) {
      const response = await call(header);
      expect(response.status).toBe(401);
      expect(response.headers.get("cache-control")).toBe("no-store");
    }
  });

  it("says so when no database is configured", async () => {
    const response = await call(`Bearer ${SECRET}`);
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "No database is configured." });
  });
});
