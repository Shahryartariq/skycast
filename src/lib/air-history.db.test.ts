import postgres, { type Sql } from "postgres";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { dailyAverages, ensureSchema, latestHours, pruneReadings, recentHours, saveReadings } from "./air-history";
import { CITIES } from "./cities";
import { BACKFILL_DAYS, collectAir, type Sources } from "./collect-air";

/**
 * Runs against a real Postgres when TEST_DATABASE_URL is set (CI starts one; locally, any
 * throwaway database). Tables are dropped and recreated, so never point it at real data.
 */
const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)("air history in Postgres", () => {
  let sql: Sql;
  const lahore = CITIES.find((c) => c.slug === "lahore")!;
  const karachi = CITIES.find((c) => c.slug === "karachi")!;
  const at = (iso: string) => new Date(iso);

  beforeAll(() => {
    sql = postgres(url!, { max: 1, onnotice: () => {} });
  });

  afterAll(async () => {
    await sql.end();
  });

  beforeEach(async () => {
    await sql`drop table if exists air_readings`;
    await ensureSchema(sql);
  });

  it("saves readings and replaces the same city and hour", async () => {
    await saveReadings(sql, [
      { city: "lahore", hour: at("2026-11-24T09:00:00Z"), pm25: 100, pm10: 150 },
      { city: "lahore", hour: at("2026-11-24T10:00:00Z"), pm25: 120, pm10: 160 },
    ]);
    await saveReadings(sql, [{ city: "lahore", hour: at("2026-11-24T10:00:00Z"), pm25: 90, pm10: 140 }]);
    const rows = await sql`select pm25 from air_readings order by hour`;
    expect(rows.map((r) => r.pm25)).toEqual([100, 90]);
    expect((await latestHours(sql)).get("lahore")?.toISOString()).toBe("2026-11-24T10:00:00.000Z");
    await ensureSchema(sql); // Safe to run on every collection.
  });

  it("averages by day in Pakistan time, not UTC", async () => {
    const now = new Date();
    // 18:00 and 19:00 UTC yesterday are different days in Pakistan (23:00 and 00:00 PKT).
    const day = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 1));
    const iso = (h: number) => new Date(day.getTime() + h * 3600_000);
    await saveReadings(sql, [
      { city: "lahore", hour: iso(18), pm25: 10, pm10: 20 },
      { city: "lahore", hour: iso(17), pm25: 30, pm10: 40 },
      { city: "lahore", hour: iso(19), pm25: 200, pm10: 300 },
    ]);
    const days = (await dailyAverages(sql, 30)).get("lahore")!;
    const pk = (d: Date) => new Date(d.getTime() + 5 * 3600_000).toISOString().slice(0, 10);
    expect(days).toEqual([
      { day: pk(iso(17)), pm25: 20, hours: 2 },
      { day: pk(iso(19)), pm25: 200, hours: 1 },
    ]);
  });

  it("returns recent hours in order and prunes old ones", async () => {
    const hour = Math.floor(Date.now() / 3600_000) * 3600_000;
    await saveReadings(sql, [
      { city: "karachi", hour: new Date(hour - 2 * 3600_000), pm25: 40, pm10: 50 },
      { city: "karachi", hour: new Date(hour), pm25: 42, pm10: 52 },
      { city: "karachi", hour: new Date(hour - 200 * 86_400_000), pm25: 99, pm10: 99 },
    ]);
    expect((await recentHours(sql, "karachi", 24)).map((h) => h.pm25)).toEqual([40, 42]);
    expect(await pruneReadings(sql)).toBe(1);
  });

  it("collects: backfills a new city, then takes one reading an hour, and heals gaps", async () => {
    // Minute 20 of the current hour: relative to today, so pruning old rows never interferes.
    const now = Math.floor(Date.now() / 3600_000) * 3600_000 + 20 * 60_000;
    const nowSec = now / 1000;
    const history = vi.fn<Sources["history"]>(async (_city, start, end) => {
      const samples = [];
      for (let t = Math.ceil(start / 3600) * 3600; t <= end; t += 3600) samples.push({ time: t, pm25: 50, pm10: 80 });
      return samples;
    });
    const current = vi.fn<Sources["now"]>(async () => [{ time: nowSec, pm25: 61, pm10: 90 }]);
    const sources = { now: current, history };

    // First run: nothing stored, so each city gets a month of history.
    const first = await collectAir(sql, [lahore, karachi], sources, now);
    expect(first.backfilled).toEqual(["karachi", "lahore"]);
    expect(history).toHaveBeenCalledTimes(2);
    expect(history.mock.calls[0][1]).toBe(nowSec - BACKFILL_DAYS * 86_400);
    // Whole hours from minute 20 a month ago up to now.
    expect(first.saved).toBe(2 * BACKFILL_DAYS * 24);

    // An hour later: one current reading each.
    const second = await collectAir(sql, [lahore, karachi], sources, now + 3600_000);
    expect(second.backfilled).toEqual([]);
    expect(current).toHaveBeenCalledTimes(2);

    // Five hours of missed runs: the gap is filled from history, starting after the last saved hour.
    history.mockClear();
    const third = await collectAir(sql, [lahore], sources, now + 6 * 3600_000);
    expect(third.backfilled).toEqual(["lahore"]);
    expect(history.mock.calls[0][1]).toBe(Math.floor(nowSec / 3600) * 3600 + 3600);

    // One city failing doesn't stop the others: Lahore is up to date and its reading fails,
    // while Karachi (last saved five hours ago) still gets its gap filled.
    const failing = { now: vi.fn().mockRejectedValue(new Error("OpenWeather is down")), history };
    const fourth = await collectAir(sql, [lahore, karachi], failing, now + 6 * 3600_000 + 600_000);
    expect(fourth.failed).toEqual(["lahore"]);
    expect(fourth.backfilled).toEqual(["karachi"]);
    expect(fourth.saved).toBeGreaterThan(0);
  });
});
