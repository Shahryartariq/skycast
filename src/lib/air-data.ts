import "server-only";

import { unstable_cache } from "next/cache";

import { dailyAverages, pakistanToday, recentHours, type DayAverage, type HourValue } from "./air-history";
import { CITIES } from "./cities";
import { db, hasDatabase } from "./db";
import { usingSampleData } from "./openweather";

/** The collector clears this after each run, so pages show a new hour as soon as it's saved. */
export const AIR_HISTORY_TAG = "air-history";

export type AirHistory =
  | { kind: "ok"; byCity: Record<string, DayAverage[]>; sample: boolean }
  /** Not set up on this deployment. */
  | { kind: "no-database" }
  | { kind: "unavailable" };

/* ---- Sample data: stable made-up numbers for tests and local work without a database ---- */

const wave = (seed: number, i: number) => Math.sin(i / 3.1 + seed) * 0.35 + Math.sin(i / 1.7 + seed * 2) * 0.15;

function sampleDays(slug: string): DayAverage[] {
  const index = CITIES.findIndex((city) => city.slug === slug);
  const base = 25 + ((index * 37) % 120);
  const today = Date.parse(`${pakistanToday()}T00:00:00Z`);
  return Array.from({ length: 30 }, (_, i) => ({
    day: new Date(today - (29 - i) * 86_400_000).toISOString().slice(0, 10),
    pm25: Math.max(4, Math.round(base * (1 + wave(index, i)) * 10) / 10),
    // A short gap, as real data has: two days with too few readings.
    hours: i === 11 || i === 12 ? 3 : 24,
  }));
}

function sampleHours(slug: string): HourValue[] {
  const index = CITIES.findIndex((city) => city.slug === slug);
  const base = 25 + ((index * 37) % 120);
  const end = Math.floor(Date.now() / 3_600_000) * 3600;
  return Array.from({ length: 168 }, (_, i) => {
    const time = end - (167 - i) * 3600;
    const hourPk = (time / 3600 + 5) % 24;
    // Smog peaks at night and early morning, and clears in the afternoon.
    const daily = 1 + 0.45 * Math.cos(((hourPk - 4) / 24) * 2 * Math.PI);
    return { time, pm25: Math.max(3, Math.round(base * daily * (1 + wave(index, i / 24)) * 10) / 10) };
  });
}

/* ---- Real data ---- */

const cachedHistory = unstable_cache(
  async () => Object.fromEntries(await dailyAverages(db(), 30)),
  ["air-history-v1"],
  { revalidate: 3600, tags: [AIR_HISTORY_TAG] },
);

const cachedHours = unstable_cache(async (slug: string) => recentHours(db(), slug, 168), ["air-hours-v1"], {
  revalidate: 3600,
  tags: [AIR_HISTORY_TAG],
});

/** Daily average PM2.5 for every city over the last 30 days. */
export async function loadAirHistory(): Promise<AirHistory> {
  if (!hasDatabase()) {
    if (!usingSampleData()) return { kind: "no-database" };
    return { kind: "ok", sample: true, byCity: Object.fromEntries(CITIES.map((city) => [city.slug, sampleDays(city.slug)])) };
  }
  try {
    return { kind: "ok", sample: false, byCity: await cachedHistory() };
  } catch (error) {
    console.error("Air history unavailable:", error instanceof Error ? error.message : error);
    return { kind: "unavailable" };
  }
}

/** One city's hourly PM2.5 over the last 7 days. */
export async function loadCityHours(slug: string): Promise<HourValue[]> {
  if (!hasDatabase()) return usingSampleData() ? sampleHours(slug) : [];
  try {
    return await cachedHours(slug);
  } catch {
    return [];
  }
}
