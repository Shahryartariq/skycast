import type { Sql } from "postgres";

import { aqiBand, usAqi } from "./format";

/**
 * Hourly PM2.5 and PM10 for every listed city, one row per city per hour. The collector writes it
 * every hour (see collect-air.ts); the air quality pages read daily averages back.
 */
export const SCHEMA = `
  create table if not exists air_readings (
    city text not null,
    hour timestamptz not null,
    pm25 real not null,
    pm10 real not null,
    primary key (city, hour)
  )
`;

/** Pakistan doesn't use daylight saving, so a day is always these 24 hours. */
export const PAKISTAN_TZ = "Asia/Karachi";

/** Older rows are deleted: the pages show 30 days, and a little more covers gaps and late runs. */
export const KEEP_DAYS = 120;

export interface Reading {
  city: string;
  /** Start of the hour, UTC. */
  hour: Date;
  pm25: number;
  pm10: number;
}

/** The start of the hour a Unix time falls in. */
export const hourOf = (unixSeconds: number) => new Date(Math.floor(unixSeconds / 3600) * 3600 * 1000);

export async function ensureSchema(sql: Sql) {
  await sql.unsafe(SCHEMA);
}

/** Saves readings, replacing any already stored for the same city and hour. */
export async function saveReadings(sql: Sql, readings: Reading[]): Promise<number> {
  if (readings.length === 0) return 0;
  const result = await sql`
    insert into air_readings (city, hour, pm25, pm10)
    select * from unnest(
      ${readings.map((r) => r.city)}::text[],
      ${readings.map((r) => r.hour.toISOString())}::timestamptz[],
      ${readings.map((r) => r.pm25)}::real[],
      ${readings.map((r) => r.pm10)}::real[]
    )
    on conflict (city, hour) do update set pm25 = excluded.pm25, pm10 = excluded.pm10
  `;
  return result.count;
}

/** The newest stored hour for each city. */
export async function latestHours(sql: Sql): Promise<Map<string, Date>> {
  const rows = await sql<{ city: string; hour: Date }[]>`select city, max(hour) as hour from air_readings group by city`;
  return new Map(rows.map((row) => [row.city, new Date(row.hour)]));
}

export async function pruneReadings(sql: Sql, keepDays = KEEP_DAYS): Promise<number> {
  const result = await sql`delete from air_readings where hour < now() - make_interval(days => ${keepDays}::int)`;
  return result.count;
}

export interface DayAverage {
  /** Local date in Pakistan, YYYY-MM-DD. */
  day: string;
  pm25: number;
  /** How many hours the average is built from. */
  hours: number;
}

/**
 * Daily average PM2.5 per city in Pakistan time, for the last `days` days including today. The
 * official AQI is a 24-hour average, so daily averages are the right numbers to put on the scale.
 */
export async function dailyAverages(sql: Sql, days = 30): Promise<Map<string, DayAverage[]>> {
  const rows = await sql<{ city: string; day: string; pm25: number; hours: number }[]>`
    select city,
           to_char(hour at time zone ${PAKISTAN_TZ}, 'YYYY-MM-DD') as day,
           avg(pm25)::float8 as pm25,
           count(*)::int as hours
    from air_readings
    where hour >= date_trunc('day', now() at time zone ${PAKISTAN_TZ}) at time zone ${PAKISTAN_TZ}
                  - make_interval(days => ${days - 1}::int)
    group by 1, 2
    order by 1, 2
  `;
  const byCity = new Map<string, DayAverage[]>();
  for (const { city, day, pm25, hours } of rows) {
    const list = byCity.get(city) ?? [];
    list.push({ day, pm25, hours });
    byCity.set(city, list);
  }
  return byCity;
}

export interface HourValue {
  /** Unix seconds. */
  time: number;
  pm25: number;
}

/** One city's hourly PM2.5 for the last `hours` hours. */
export async function recentHours(sql: Sql, city: string, hours = 168): Promise<HourValue[]> {
  const rows = await sql<{ time: number; pm25: number }[]>`
    select extract(epoch from hour)::float8 as time, pm25::float8 as pm25
    from air_readings
    where city = ${city} and hour >= now() - make_interval(hours => ${hours}::int)
    order by hour
  `;
  return rows.map((row) => ({ time: Number(row.time), pm25: Number(row.pm25) }));
}

/* ---- Turning the numbers into what the page says ---- */

/** A day needs this many hours of readings before its average is shown. */
export const MIN_HOURS = 6;

export interface HistoryDay {
  day: string;
  /** US AQI of the day's average PM2.5, or null when there aren't enough readings. */
  aqi: number | null;
}

/** The last `days` local dates up to `today`, oldest first, each with its AQI or a gap. */
export function fillDays(averages: DayAverage[], today: string, days = 30): HistoryDay[] {
  const byDay = new Map(averages.map((a) => [a.day, a]));
  const end = Date.parse(`${today}T00:00:00Z`);
  return Array.from({ length: days }, (_, i) => {
    const day = new Date(end - (days - 1 - i) * 86_400_000).toISOString().slice(0, 10);
    const average = byDay.get(day);
    return { day, aqi: average && average.hours >= MIN_HOURS ? usAqi(average.pm25) : null };
  });
}

export interface HistorySummary {
  daysWithData: number;
  average: number | null;
  worst: HistoryDay | null;
  best: HistoryDay | null;
  /** Days at "Unhealthy" (AQI over 150) or worse. */
  unhealthyDays: number;
}

export function summariseHistory(days: HistoryDay[]): HistorySummary {
  const known = days.filter((d): d is HistoryDay & { aqi: number } => d.aqi !== null);
  if (known.length === 0) return { daysWithData: 0, average: null, worst: null, best: null, unhealthyDays: 0 };
  const sorted = [...known].sort((a, b) => a.aqi - b.aqi);
  return {
    daysWithData: known.length,
    average: Math.round(known.reduce((sum, d) => sum + d.aqi, 0) / known.length),
    worst: sorted[sorted.length - 1],
    best: sorted[0],
    unhealthyDays: known.filter((d) => aqiBand(d.aqi).level >= 4).length,
  };
}

/** Today's date in Pakistan, YYYY-MM-DD. */
export const pakistanToday = (now = Date.now()) => new Date(now + 5 * 3600 * 1000).toISOString().slice(0, 10);
