import type { Sql } from "postgres";

import { ensureSchema, hourOf, latestHours, pruneReadings, saveReadings, type Reading } from "./air-history";
import type { City } from "./cities";
import type { AirSample } from "./openweather";

/** A city whose newest reading is older than this gets its gap filled from the history API. */
const GAP_HOURS = 3;
/** How far back a city with no readings at all is filled. */
export const BACKFILL_DAYS = 31;
/** Requests to OpenWeather at once: 50 cities in a few seconds, well under its 60 a minute. */
const CONCURRENCY = 4;

export interface Sources {
  now(city: City): Promise<AirSample[]>;
  history(city: City, start: number, end: number): Promise<AirSample[]>;
}

export interface CollectResult {
  cities: number;
  saved: number;
  /** Cities whose gap was filled from the history API. */
  backfilled: string[];
  failed: string[];
  pruned: number;
}

/** Runs `work` over `items`, `limit` at a time. */
async function inBatches<T>(items: T[], limit: number, work: (item: T) => Promise<void>) {
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) await work(items[next++]);
    }),
  );
}

/**
 * Saves this hour's air for every city. One request per city: the current reading normally, or,
 * when the stored history has a gap (the first run, or runs that didn't happen), the hourly
 * history from the last saved hour up to now. So missed runs heal themselves on the next one.
 */
export async function collectAir(sql: Sql, cities: City[], sources: Sources, now = Date.now()): Promise<CollectResult> {
  await ensureSchema(sql);
  const latest = await latestHours(sql);
  const nowSeconds = Math.floor(now / 1000);
  const readings: Reading[] = [];
  const backfilled: string[] = [];
  const failed: string[] = [];

  await inBatches(cities, CONCURRENCY, async (city) => {
    try {
      const last = latest.get(city.slug);
      const gap = !last || now - last.getTime() > GAP_HOURS * 3600 * 1000;
      const start = last ? last.getTime() / 1000 + 3600 : nowSeconds - BACKFILL_DAYS * 86_400;
      const samples = gap ? await sources.history(city, start, nowSeconds) : await sources.now(city);
      if (gap) backfilled.push(city.slug);
      for (const sample of samples) {
        if (!Number.isFinite(sample.pm25) || !Number.isFinite(sample.pm10) || sample.pm25 < 0) continue;
        readings.push({ city: city.slug, hour: hourOf(sample.time), pm25: sample.pm25, pm10: sample.pm10 });
      }
    } catch (error) {
      failed.push(city.slug);
      console.error(`Air reading for ${city.slug} failed:`, error instanceof Error ? error.message : error);
    }
  });

  // A history call can return the same hour twice; the last one wins, as the insert needs.
  const unique = [...new Map(readings.map((r) => [`${r.city}@${r.hour.getTime()}`, r])).values()];
  const saved = await saveReadings(sql, unique);
  const pruned = await pruneReadings(sql);
  return { cities: cities.length, saved, backfilled: backfilled.sort(), failed: failed.sort(), pruned };
}
