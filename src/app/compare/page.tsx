import type { Metadata } from "next";
import Link from "next/link";

import { ComparePicker } from "@/components/Compare";
import { Breadcrumbs, Shell } from "@/components/Shell";
import { COMPARE_PATH, comparePath, popularPairs } from "@/lib/compare";
import { formatTemp } from "@/lib/format";
import { loadNation, nationSky } from "@/lib/load";
import { parseUnits } from "@/lib/query";
import { pageMeta, simplePageSchema } from "@/lib/seo";
import { SITE_NAME, jsonLd } from "@/lib/site";

const DESCRIPTION =
  "Compare the weather in any two Pakistani cities: temperature, rain chance, air quality, the 5-day forecast and monthly averages side by side.";

export const metadata: Metadata = pageMeta({
  title: `Compare Weather in Two Pakistani Cities · ${SITE_NAME}`,
  description: DESCRIPTION,
  path: COMPARE_PATH,
  siteImage: true,
});

export default async function CompareIndex({ searchParams }: PageProps<"/compare">) {
  const units = parseUnits(await searchParams);
  const nation = await loadNation(); // Cached for all cities, so the list below costs one read.
  const tempOf = (slug: string) => nation.find((entry) => entry.city.slug === slug)?.temp;
  const suffix = units === "imperial" ? "?units=imperial" : "";

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLd(simplePageSchema(COMPARE_PATH, "Compare weather", DESCRIPTION)) }}
      />
      <Shell sky={nationSky(nation)} units={units} unitPath={COMPARE_PATH} region="compare">
        <div className="sky sky-flush">
          <Breadcrumbs
            trail={[
              { name: "Pakistan", path: "/" },
              { name: "Compare", path: COMPARE_PATH },
            ]}
          />
          <section className="simple-hero" aria-labelledby="compare-title">
            <h1 id="compare-title">Compare weather in two cities</h1>
            <p>Pick two places to see today&apos;s weather, air quality, the next five days and monthly averages side by side.</p>
          </section>
          <ComparePicker units={units} />
        </div>

        <section className="section" aria-labelledby="popular-title">
          <h2 id="popular-title">Popular comparisons</h2>
          <ul className="pair-grid">
            {popularPairs().map(([a, b]) => {
              const ta = tempOf(a.slug);
              const tb = tempOf(b.slug);
              return (
                <li key={`${a.slug}-${b.slug}`}>
                  <Link prefetch={false} href={`${comparePath(a, b)}${suffix}`}>
                    <span className="pair-name">
                      {a.name} vs {b.name}
                    </span>
                    {ta !== undefined && tb !== undefined && (
                      <span className="pair-temps">
                        {formatTemp(ta, units)} · {formatTemp(tb, units)}
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      </Shell>
    </>
  );
}
