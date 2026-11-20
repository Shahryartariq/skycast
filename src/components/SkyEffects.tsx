import type { Effect } from "@/lib/effects";

/** How many moving pieces each effect uses. Kept low: it's a hint of the weather, not a show. */
const PIECES: Record<Effect, number> = { rain: 26, snow: 22, cold: 10, hot: 5, calm: 3 };

/**
 * A quiet layer behind the forecast that matches the weather: rain, snow, frost, heat haze or
 * slow clouds. Pure CSS, decorative only, and still for people who ask for reduced motion.
 * Each piece's position and timing come from the stylesheet (the CSP blocks inline styles).
 */
export function SkyEffects({ effect }: { effect: Effect }) {
  return (
    <div className={`fx fx-${effect}`} aria-hidden="true" data-effect={effect}>
      {Array.from({ length: PIECES[effect] }, (_, i) => (
        <i key={i} />
      ))}
    </div>
  );
}
