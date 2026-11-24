import { revalidateTag } from "next/cache";

import { AIR_HISTORY_TAG } from "@/lib/air-data";
import { CITIES } from "@/lib/cities";
import { collectAir } from "@/lib/collect-air";
import { authorizeCollector } from "@/lib/cron-auth";
import { db, hasDatabase } from "@/lib/db";
import { getAirHistory, getAirNow, usingSampleData } from "@/lib/openweather";

/** 50 cities, four at a time; a first run that backfills a month takes longest. */
export const maxDuration = 60;

const NO_STORE = { "Cache-Control": "no-store" };

/**
 * Saves the current air quality of every city to the database. Called once an hour by the
 * "Collect air quality" GitHub Actions workflow, which proves who it is with a GitHub OIDC token.
 */
async function collect(request: Request) {
  const verdict = await authorizeCollector(request.headers.get("authorization"));
  if (!verdict.ok) return Response.json({ error: verdict.reason }, { status: 401, headers: NO_STORE });
  if (!hasDatabase()) return Response.json({ error: "No database is configured." }, { status: 503, headers: NO_STORE });
  if (usingSampleData()) return Response.json({ error: "Sample data is on; nothing to collect." }, { status: 409, headers: NO_STORE });

  try {
    const result = await collectAir(db(), CITIES, {
      now: (city) => getAirNow(city),
      history: (city, start, end) => getAirHistory(city, start, end),
    });
    revalidateTag(AIR_HISTORY_TAG, { expire: 0 });
    // Most cities failing means something is wrong upstream: let the workflow run show red.
    const status = result.failed.length > result.cities / 2 ? 502 : 200;
    return Response.json({ via: verdict.via, ...result }, { status, headers: NO_STORE });
  } catch (error) {
    console.error("Air collection failed:", error instanceof Error ? error.message : error);
    return Response.json({ error: "Collection failed." }, { status: 500, headers: NO_STORE });
  }
}

export const POST = collect;
/** Vercel Cron calls with GET. */
export const GET = collect;
