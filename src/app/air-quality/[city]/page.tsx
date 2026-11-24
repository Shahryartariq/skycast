import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";

import { DailyBars, DailyTable, HourlyLine, shortDate } from "@/components/AirCharts";
import { Breadcrumbs, Shell } from "@/components/Shell";
import { loadAirHistory, loadCityHours } from "@/lib/air-data";
import { fillDays, pakistanToday, summariseHistory } from "@/lib/air-history";
import { cityBySlug, cityPath, type City } from "@/lib/cities";
import { aqiBand } from "@/lib/format";
import { loadNation, loadNationAir, nationSky } from "@/lib/load";
import { airHistoryPath, airHistorySchema, airHistoryTrail, pageMeta } from "@/lib/seo";
import { SITE_NAME, jsonLd } from "@/lib/site";

async function cityFrom(params: Promise<{ city: string }>): Promise<City> {
  const city = cityBySlug((await params).city);
  if (!city) notFound();
  return city;
}

export async function generateMetadata({ params }: PageProps<"/air-quality/[city]">): Promise<Metadata> {
  const city = cityBySlug((await params).city);
  if (!city) return {};
  return pageMeta({
    title: `${city.name} AQI History: Air Quality for the Last 30 Days · ${SITE_NAME}`,
    description: `Daily and hourly air quality in ${city.name} over the last 30 days: US AQI from PM2.5, the worst and cleanest days, and how many were unhealthy. Updated every hour.`,
    path: airHistoryPath(city),
    siteImage: true,
  });
}

export default async function AirHistoryPage({ params }: PageProps<"/air-quality/[city]">) {
  await connection(); // Per request, for the CSP nonce; the data itself is cached for an hour.
  const city = await cityFrom(params);
  const [history, hours, nation, air] = await Promise.all([loadAirHistory(), loadCityHours(city.slug), loadNation(), loadNationAir()]);
  const days = history.kind === "ok" ? fillDays(history.byCity[city.slug] ?? [], pakistanToday()) : [];
  const summary = summariseHistory(days);
  const now = air.find((entry) => entry.city.slug === city.slug);
  const description = `Air quality in ${city.name} over the last 30 days.`;

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(airHistorySchema(city, description)) }} />
      <Shell sky={nationSky(nation)} region="air-quality">
        <div className="sky sky-flush">
          <Breadcrumbs trail={airHistoryTrail(city)} />
          <section className="simple-hero" aria-labelledby="air-title">
            <h1 id="air-title">{city.name} air quality, last 30 days</h1>
            <p lang="ur" dir="rtl" className="urdu">
              {city.nameUr} میں فضائی معیار
            </p>
            {summary.average !== null && summary.worst && (
              <p>
                {city.name}&apos;s air averaged AQI {summary.average} ({aqiBand(summary.average).label.toLowerCase()}) over the{" "}
                {summary.daysWithData === 1 ? "last day" : `last ${summary.daysWithData} days`}.{" "}
                {summary.unhealthyDays > 0
                  ? `${summary.unhealthyDays} ${summary.unhealthyDays === 1 ? "day was" : "days were"} unhealthy or worse, and the worst was ${shortDate(summary.worst.day)} at ${summary.worst.aqi}.`
                  : "No day reached unhealthy levels."}
              </p>
            )}
          </section>
          {summary.average !== null && summary.worst && summary.best && (
            <ul className="facts air-facts">
              {now && (
                <li>
                  <span>Right now</span>
                  AQI {now.aqi}
                </li>
              )}
              <li>
                <span>30-day average</span>
                AQI {summary.average}
              </li>
              <li>
                <span>Worst day</span>
                {shortDate(summary.worst.day)}, {summary.worst.aqi}
              </li>
              <li>
                <span>Cleanest day</span>
                {shortDate(summary.best.day)}, {summary.best.aqi}
              </li>
              <li>
                <span>Unhealthy days</span>
                {summary.unhealthyDays} of {summary.daysWithData}
              </li>
            </ul>
          )}
        </div>

        {history.kind !== "ok" ? (
          <section className="section" aria-labelledby="none-title">
            <h2 id="none-title">History isn&apos;t available right now</h2>
            <p className="prose">
              {history.kind === "no-database"
                ? "This copy of Skycast isn't saving air quality readings."
                : "The history couldn't be loaded. Please try again in a few minutes."}{" "}
              <Link prefetch={false} href="/air-quality">See air quality in every city right now</Link>.
            </p>
          </section>
        ) : summary.daysWithData === 0 ? (
          <section className="section" aria-labelledby="none-title">
            <h2 id="none-title">Collecting readings</h2>
            <p className="prose">
              Skycast saves {city.name}&apos;s air quality every hour. The chart appears once there&apos;s a day of readings.
            </p>
          </section>
        ) : (
          <>
            <section className="section" aria-labelledby="daily-title">
              <h2 id="daily-title">Daily average</h2>
              <p className="chart-caption">Each bar is one day&apos;s average on the US AQI scale, coloured by level.</p>
              <DailyBars days={days} label={`Daily average AQI in ${city.name} for the last 30 days`} />
              <DailyTable days={days} />
            </section>

            {hours.length > 1 && (
              <section className="section" aria-labelledby="hourly-title">
                <h2 id="hourly-title">Hour by hour, last 7 days</h2>
                <p className="chart-caption">US AQI each hour. Coloured bands show the levels, from good at the bottom.</p>
                <HourlyLine hours={hours} label={`Hourly AQI in ${city.name} for the last 7 days`} />
                <p className="panel-note">
                  In smog season the air is usually worst late at night and early in the morning, when cold, still air
                  holds smoke near the ground, and clearest in the afternoon.
                </p>
              </section>
            )}
          </>
        )}

        <section className="section" aria-labelledby="about-title">
          <h2 id="about-title">About these numbers</h2>
          <p className="prose">
            Skycast saves an estimate of PM2.5, the fine particles in smog, for every city once an hour, from OpenWeather&apos;s
            air quality model. Each day&apos;s average is converted to the US AQI, which officially uses a 24-hour average.
            Days with fewer than six hours of readings are left out. These are model estimates, not readings from local
            monitors.
            {history.kind === "ok" && history.sample && " This deployment is showing sample data."}
          </p>
          <p className="section-more">
            <Link prefetch={false} href="/air-quality">Air quality in every city</Link> ·{" "}
            <Link prefetch={false} href={cityPath(city)}>{city.name} weather</Link>
          </p>
        </section>
      </Shell>
    </>
  );
}
