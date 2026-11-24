import { describe, expect, it } from "vitest";

import { MIN_HOURS, fillDays, hourOf, pakistanToday, summariseHistory } from "./air-history";

describe("air history", () => {
  it("rounds readings down to the hour", () => {
    expect(hourOf(Date.UTC(2026, 10, 24, 9, 59, 59) / 1000).toISOString()).toBe("2026-11-24T09:00:00.000Z");
  });

  it("knows the date in Pakistan, five hours ahead of UTC", () => {
    expect(pakistanToday(Date.UTC(2026, 10, 24, 18, 59))).toBe("2026-11-24");
    expect(pakistanToday(Date.UTC(2026, 10, 24, 19, 0))).toBe("2026-11-25");
  });

  it("lays out 30 days ending today, with gaps where readings are missing or too few", () => {
    const days = fillDays(
      [
        { day: "2026-11-24", pm25: 100, hours: 20 },
        { day: "2026-11-20", pm25: 12, hours: MIN_HOURS },
        { day: "2026-11-19", pm25: 300, hours: MIN_HOURS - 1 },
        { day: "2026-09-01", pm25: 50, hours: 24 },
      ],
      "2026-11-24",
    );
    expect(days).toHaveLength(30);
    expect(days[0].day).toBe("2026-10-26");
    expect(days[29]).toEqual({ day: "2026-11-24", aqi: 182 }); // EPA 2024 breakpoints
    expect(days.find((d) => d.day === "2026-11-20")?.aqi).toBe(56);
    expect(days.find((d) => d.day === "2026-11-19")?.aqi).toBeNull();
    expect(days.filter((d) => d.aqi !== null)).toHaveLength(2);
  });

  it("crosses month and year ends", () => {
    expect(fillDays([], "2027-01-02", 5).map((d) => d.day)).toEqual([
      "2026-12-29",
      "2026-12-30",
      "2026-12-31",
      "2027-01-01",
      "2027-01-02",
    ]);
  });

  it("sums up a month", () => {
    const summary = summariseHistory([
      { day: "2026-11-01", aqi: 80 },
      { day: "2026-11-02", aqi: null },
      { day: "2026-11-03", aqi: 210 },
      { day: "2026-11-04", aqi: 151 },
      { day: "2026-11-05", aqi: 150 },
    ]);
    expect(summary).toEqual({
      daysWithData: 4,
      average: 148,
      worst: { day: "2026-11-03", aqi: 210 },
      best: { day: "2026-11-01", aqi: 80 },
      unhealthyDays: 2,
    });
    expect(summariseHistory([{ day: "2026-11-01", aqi: null }]).average).toBeNull();
  });
});
