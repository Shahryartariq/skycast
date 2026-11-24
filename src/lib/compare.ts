import { CITIES, MAJOR, cityBySlug, type City } from "./cities";

/**
 * Two cities side by side live at one address, bigger city first: /compare/lahore-vs-islamabad.
 * The other order and the picker form (/compare?a=…&b=…) redirect there, so each pair has a
 * single page for search engines and for sharing.
 */
export const COMPARE_PATH = "/compare";

const SEPARATOR = "-vs-";

/** Order cities are named in: the big cities as listed in MAJOR, then everything else as listed. */
function rank(city: City): number {
  const major = MAJOR.indexOf(city.slug);
  return major >= 0 ? major : MAJOR.length + CITIES.indexOf(city);
}

/** The pair in its page's order. */
export function orderPair(a: City, b: City): [City, City] {
  return rank(a) <= rank(b) ? [a, b] : [b, a];
}

export function comparePath(a: City, b: City): string {
  const [first, second] = orderPair(a, b);
  return `${COMPARE_PATH}/${first.slug}${SEPARATOR}${second.slug}`;
}

export type PairLookup =
  | { kind: "ok"; a: City; b: City }
  /** Right cities, other order: send to `path`. */
  | { kind: "redirect"; path: string }
  /** The same city twice: its own page says it all. */
  | { kind: "same"; city: City }
  | { kind: "unknown" };

/** Reads "lahore-vs-islamabad". City slugs never contain "-vs-", so one split is enough. */
export function parsePair(pair: string): PairLookup {
  const parts = pair.toLowerCase().split(SEPARATOR);
  if (parts.length !== 2) return { kind: "unknown" };
  const a = cityBySlug(parts[0]);
  const b = cityBySlug(parts[1]);
  if (!a || !b) return { kind: "unknown" };
  if (a.slug === b.slug) return { kind: "same", city: a };
  const path = comparePath(a, b);
  return path === `${COMPARE_PATH}/${pair}` ? { kind: "ok", a, b } : { kind: "redirect", path };
}

/** Pairs people plan trips and moves around, linked from the compare page and the sitemap. */
export const POPULAR_PAIRS: [string, string][] = [
  ["lahore", "islamabad"],
  ["karachi", "lahore"],
  ["karachi", "islamabad"],
  ["islamabad", "rawalpindi"],
  ["lahore", "faisalabad"],
  ["lahore", "multan"],
  ["islamabad", "peshawar"],
  ["karachi", "hyderabad"],
  ["karachi", "quetta"],
  ["lahore", "sialkot"],
  ["islamabad", "murree"],
  ["lahore", "murree"],
  ["murree", "nathia-gali"],
  ["swat", "murree"],
  ["naran", "swat"],
  ["hunza", "skardu"],
];

export const popularPairs = (): [City, City][] =>
  POPULAR_PAIRS.flatMap(([a, b]) => {
    const first = cityBySlug(a);
    const second = cityBySlug(b);
    return first && second ? [orderPair(first, second)] : [];
  });

/** Difference in °C as people say it: "4° warmer", "about the same". */
export function warmer(diff: number): "warmer" | "cooler" | "same" {
  if (Math.abs(diff) < 1) return "same";
  return diff > 0 ? "warmer" : "cooler";
}
