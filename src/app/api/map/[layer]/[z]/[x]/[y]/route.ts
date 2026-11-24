import type { NextRequest } from "next/server";

import { usingSampleData } from "@/lib/openweather";
import { createLimiter } from "@/lib/rate-limit";
import { LAYERS, isLayer, isServedTile } from "@/lib/tiles";
import { clientIp } from "@/lib/visitor";

/** One map view is about a dozen tiles, and zooming loads another dozen. */
const tiles = createLimiter({ limit: 400 });

/** A fully transparent 1×1 PNG: "no weather here" for sample data and local work. */
const EMPTY_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
  "base64",
);

/** OpenWeather refreshes these layers about every 10 minutes. */
const CACHED = "public, max-age=300, s-maxage=600, stale-while-revalidate=600";

const png = (body: BodyInit, cacheControl: string) =>
  new Response(body, { headers: { "Content-Type": "image/png", "Cache-Control": cacheControl, "X-Content-Type-Options": "nosniff" } });

const fail = (status: number, message: string, extra: Record<string, string> = {}) =>
  new Response(message, { status, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store", ...extra } });

/**
 * Weather map tiles (rain, clouds) for the map on weather pages. The browser asks this route, and
 * this route asks OpenWeather with the key, so the key never reaches the browser. Only tiles near
 * Pakistan at the zooms the map uses are served.
 */
export async function GET(request: NextRequest, { params }: RouteContext<"/api/map/[layer]/[z]/[x]/[y]">) {
  const { layer, z, x, y } = await params;
  const [zoom, tx, ty] = [z, x, y].map((part) => (/^(0|[1-9]\d{0,3})$/.test(part) ? Number(part) : NaN));
  if (!isLayer(layer) || !isServedTile(zoom, tx, ty)) return fail(404, "No such tile.");

  const verdict = tiles.check(clientIp(request.headers) ?? "unknown");
  if (!verdict.ok) return fail(429, "Too many map tiles.", { "Retry-After": String(verdict.retryAfter) });

  const key = process.env.OPENWEATHER_API_KEY?.trim();
  if (usingSampleData() || !key) return png(EMPTY_PNG, "public, max-age=60");

  try {
    const upstream = await fetch(`https://tile.openweathermap.org/map/${LAYERS[layer]}/${zoom}/${tx}/${ty}.png?appid=${key}`, {
      signal: AbortSignal.timeout(8000),
      cache: "no-store",
    });
    // Never pass on upstream text or the URL: the URL carries the key.
    if (!upstream.ok || !upstream.headers.get("content-type")?.startsWith("image/")) {
      return fail(502, "The weather map is unavailable right now.");
    }
    return png(await upstream.arrayBuffer(), CACHED);
  } catch {
    return fail(502, "The weather map is unavailable right now.");
  }
}
