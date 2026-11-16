import type { NextRequest } from "next/server";

import { MissingApiKeyError, searchPlaces } from "@/lib/openweather";
import { createLimiter, lookupsPerMinute } from "@/lib/rate-limit";
import { clientIp } from "@/lib/visitor";

/** Suggestions fire as people type, so this allows more than full searches do. */
const suggestions = createLimiter({ limit: () => lookupsPerMinute(30) * 2 });
const NO_STORE = { "Cache-Control": "no-store" };

/**
 * City suggestions for the search box. The browser calls this route, and this route
 * calls OpenWeather with the key, so the key never reaches the browser.
 */
export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length < 2 || q.length > 80) {
    return Response.json({ error: "Type between 2 and 80 characters." }, { status: 400, headers: NO_STORE });
  }

  const verdict = suggestions.check(clientIp(request.headers) ?? "unknown");
  if (!verdict.ok) {
    return Response.json(
      { error: "Too many searches. Wait a minute, then try again." },
      { status: 429, headers: { ...NO_STORE, "Retry-After": String(verdict.retryAfter) } },
    );
  }

  try {
    const places = await searchPlaces(q);
    return Response.json(
      { places },
      { headers: { "Cache-Control": "public, max-age=300, s-maxage=86400, stale-while-revalidate=604800" } },
    );
  } catch (error) {
    if (error instanceof MissingApiKeyError) {
      return Response.json({ error: "Search isn't configured on this server." }, { status: 503, headers: NO_STORE });
    }
    console.error(error);
    return Response.json({ error: "Search is unavailable right now." }, { status: 502, headers: NO_STORE });
  }
}
