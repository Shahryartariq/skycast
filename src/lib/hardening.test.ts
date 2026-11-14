import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { findCity } from "./cities";
import { createLimiter } from "./rate-limit";

describe("rate limiter", () => {
  it("allows the limit, then blocks until the window ends", () => {
    const limiter = createLimiter({ limit: 3, windowMs: 60_000 });
    const start = 1_000_000;
    expect([1, 2, 3].map(() => limiter.check("a", start).ok)).toEqual([true, true, true]);
    expect(limiter.check("a", start + 10_000)).toEqual({ ok: false, retryAfter: 50 });
    // Other clients are counted separately.
    expect(limiter.check("b", start + 10_000).ok).toBe(true);
    // A new window starts afresh.
    expect(limiter.check("a", start + 60_000).ok).toBe(true);
  });

  it("stays bounded when there are many clients", () => {
    const limiter = createLimiter({ limit: 1, windowMs: 60_000, maxKeys: 2 });
    limiter.check("a", 0);
    limiter.check("b", 0);
    limiter.check("c", 0); // Evicts "a", the oldest.
    expect(limiter.check("a", 1).ok).toBe(true);
  });
});

describe("matching typed city names", () => {
  it("ignores the country however it's written", () => {
    for (const query of ["karachi pakistan", "Karachi, Pakistan", "karachi pk", "Karachi,PK", "  KARACHI  "]) {
      expect(findCity(query)?.slug, query).toBe("karachi");
    }
    expect(findCity("pakistan")).toBeUndefined();
  });
});

describe("proxy", async () => {
  const { proxy } = await import("../proxy");
  const call = (path: string, ip = "203.0.113.7") =>
    proxy(new NextRequest(new URL(path, "https://getskycast.vercel.app"), { headers: { "x-real-ip": ip } }));

  afterEach(() => vi.unstubAllEnvs());

  it("sends coordinates near a listed city to its page", () => {
    const near = call("/?lat=31.55&lon=74.34");
    expect(near.status).toBe(307);
    expect(near.headers.get("location")).toBe("https://getskycast.vercel.app/weather/lahore");
    const imperial = call("/?lat=31.55&lon=74.34&units=imperial");
    expect(imperial.headers.get("location")).toBe("https://getskycast.vercel.app/weather/lahore?units=imperial");
    // Far from any listed city: the page handles it.
    expect(call("/?lat=48.85&lon=2.35").status).toBe(200);
  });

  it("limits lookups per IP address, with a page that explains", async () => {
    vi.stubEnv("SKYCAST_LOOKUPS_PER_MINUTE", "2");
    const ip = "198.51.100.23";
    expect(call("/?q=berlin", ip).status).toBe(200);
    expect(call("/?lat=48.85&lon=2.35", ip).status).toBe(200);
    const blocked = call("/?q=paris", ip);
    expect(blocked.status).toBe(429);
    expect(Number(blocked.headers.get("retry-after"))).toBeGreaterThan(0);
    expect(blocked.headers.get("cache-control")).toBe("no-store");
    expect(await blocked.text()).toContain("Too many searches");
    // City pages and listed cities are cached, so they're never limited.
    expect(call("/?q=lahore", ip).status).toBe(307);
    expect(call("/weather/lahore", ip).status).toBe(200);
    // Someone else isn't affected.
    expect(call("/?q=paris", "198.51.100.99").status).toBe(200);
  });
});
