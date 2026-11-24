import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GET } from "./route";

const call = (layer: string, z: string, x: string, y: string, ip = "198.51.100.7") =>
  GET(new NextRequest(`http://localhost/api/map/${layer}/${z}/${x}/${y}`, { headers: { "x-real-ip": ip } }), {
    params: Promise.resolve({ layer, z, x, y }),
  });

describe("GET /api/map/[layer]/[z]/[x]/[y]", () => {
  beforeEach(() => {
    vi.stubEnv("WEATHER_SAMPLE_DATA", "");
    vi.stubEnv("OPENWEATHER_API_KEY", "secret-key");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("fetches the tile from OpenWeather on the server, with the key, and caches it", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(new Uint8Array([137, 80, 78, 71]), { headers: { "content-type": "image/png" } }));
    vi.stubGlobal("fetch", fetchMock);
    const response = await call("rain", "7", "90", "52");
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/png");
    expect(response.headers.get("cache-control")).toContain("s-maxage=600");
    expect(String(fetchMock.mock.calls[0][0])).toBe(
      "https://tile.openweathermap.org/map/precipitation_new/7/90/52.png?appid=secret-key",
    );
  });

  it("refuses layers, zooms and places the map doesn't use, without calling OpenWeather", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    for (const [layer, z, x, y] of [
      ["wind", "7", "90", "52"],
      ["rain", "12", "90", "52"],
      ["rain", "7", "1", "1"],
      ["rain", "07", "90", "52"],
      ["rain", "7", "90", "52.png"],
      ["rain", "7", "-1", "52"],
    ]) {
      expect((await call(layer, z, x, y)).status, `${layer}/${z}/${x}/${y}`).toBe(404);
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("never passes on what OpenWeather says, which could include the key", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("Invalid API key secret-key", { status: 401 })));
    const response = await call("clouds", "7", "90", "52");
    expect(response.status).toBe(502);
    expect(await response.text()).not.toContain("secret-key");
  });

  it("serves an empty tile with sample data, so the map still works locally", async () => {
    vi.stubEnv("WEATHER_SAMPLE_DATA", "1");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const response = await call("rain", "7", "90", "52");
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/png");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
