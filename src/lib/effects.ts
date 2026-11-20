import type { Condition } from "./types";

/** The background effect behind a forecast. */
export type Effect = "rain" | "snow" | "hot" | "cold" | "calm";

/** At or above this it feels hot (°C). Lahore and Jacobabad pass it most of the summer. */
export const HOT_FROM = 35;
/** At or below this it feels cold (°C). Murree, Quetta and the north in winter. */
export const COLD_TO = 5;

/**
 * Rain and snow are what you see falling, so they win. Otherwise it's how the air feels:
 * the "feels like" temperature, since that's what someone stepping outside notices.
 */
export function effectFor(condition: Condition, feelsLike: number): Effect {
  if (condition === "rain" || condition === "drizzle" || condition === "thunder") return "rain";
  if (condition === "snow") return "snow";
  if (feelsLike >= HOT_FROM) return "hot";
  if (feelsLike <= COLD_TO) return "cold";
  return "calm";
}
