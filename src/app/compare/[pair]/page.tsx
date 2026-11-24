import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { CompareDays, CompareMonths, CompareNow, ComparePicker, CompareTable, compareSummary, type Side } from "@/components/Compare";
import { Breadcrumbs, Shell } from "@/components/Shell";
import { parsePair } from "@/lib/compare";
import { skyFor } from "@/lib/conditions";
import { loadPlace, type Outcome } from "@/lib/load";
import { parseUnits } from "@/lib/query";
import { compareSchema, compareTrail, pageMeta } from "@/lib/seo";
import { SITE_NAME, jsonLd } from "@/lib/site";

const snapshotOf = (outcome: Outcome) => (outcome.kind === "ok" ? outcome.snapshot : null);

/** The proxy sends other orders and unknown cities elsewhere, so only real pairs get here. */
function pairFrom(pair: string) {
  const lookup = parsePair(pair);
  return lookup.kind === "ok" ? lookup : null;
}

async function load(pair: string): Promise<[Side, Side] | null> {
  const lookup = pairFrom(pair);
  if (!lookup) return null;
  const [a, b] = await Promise.all([loadPlace(lookup.a), loadPlace(lookup.b)]);
  return [
    { city: lookup.a, snapshot: snapshotOf(a) },
    { city: lookup.b, snapshot: snapshotOf(b) },
  ];
}

export async function generateMetadata({ params, searchParams }: PageProps<"/compare/[pair]">): Promise<Metadata> {
  const { pair } = await params;
  const sides = await load(pair);
  if (!sides) return {};
  const [a, b] = sides;
  const units = parseUnits(await searchParams);
  const summary = compareSummary(a, b, "metric");
  return pageMeta({
    title: `${a.city.name} vs ${b.city.name} Weather Today: Side by Side · ${SITE_NAME}`,
    description: `${summary ? `${summary} ` : ""}Temperature, rain chance, air quality, 5-day forecast and monthly averages for ${a.city.name} and ${b.city.name}.`,
    path: `/compare/${pair}`,
    noindex: units === "imperial" || (!a.snapshot && !b.snapshot),
    siteImage: true,
  });
}

export default async function ComparePage({ params, searchParams }: PageProps<"/compare/[pair]">) {
  const { pair } = await params;
  const sides = await load(pair);
  if (!sides) notFound();
  const [a, b] = sides;
  const units = parseUnits(await searchParams);
  const path = `/compare/${pair}`;
  const lead = a.snapshot ?? b.snapshot;
  const sky = lead ? skyFor(lead.current.condition, lead.observedAt, lead.current.sunrise, lead.current.sunset) : "clouds";
  const month = lead ? new Date((lead.observedAt + lead.timezoneOffset) * 1000).getUTCMonth() : new Date().getUTCMonth();
  const summary = compareSummary(a, b, units);
  const description = `Weather in ${a.city.name} and ${b.city.name} side by side.`;

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLd(compareSchema(a.city, b.city, path, description)) }}
      />
      <Shell sky={sky} units={units} unitPath={path} region="compare">
        <div className="sky sky-flush">
          <Breadcrumbs trail={compareTrail(a.city, b.city, path)} />
          <section className="simple-hero compare-hero" aria-labelledby="compare-title">
            <h1 id="compare-title">
              {a.city.name} vs {b.city.name} weather
            </h1>
            <p lang="ur" dir="rtl" className="urdu">
              {a.city.nameUr} اور {b.city.nameUr} کا موسم
            </p>
            {summary && <p>{summary}</p>}
          </section>
          <CompareNow a={a} b={b} units={units} />
        </div>

        <section className="section" aria-labelledby="today-title">
          <h2 id="today-title">Today, side by side</h2>
          <CompareTable a={a} b={b} units={units} />
          <p className="panel-note">Air quality is an estimate from a global model, converted to the US AQI scale.</p>
        </section>

        {lead && (
          <section className="section" aria-labelledby="days-title">
            <h2 id="days-title">Next 5 days</h2>
            <CompareDays a={a} b={b} units={units} />
          </section>
        )}

        <section className="section" aria-labelledby="months-title">
          <h2 id="months-title">Average weather by month</h2>
          <CompareMonths a={a} b={b} units={units} month={month} />
          <p className="panel-note">Averages from the ERA5 climate model, not local weather stations.</p>
        </section>

        <section className="section" aria-labelledby="picker-title">
          <h2 id="picker-title">Compare other cities</h2>
          <ComparePicker a={a.city.slug} b={b.city.slug} units={units} />
        </section>
      </Shell>
    </>
  );
}
