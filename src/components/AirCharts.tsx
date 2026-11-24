import type { HistoryDay, HourValue } from "@/lib/air-history";
import { aqiBand, usAqi } from "@/lib/format";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** "Nov 3" from "2026-11-03". */
export function shortDate(day: string): string {
  const [, month, date] = day.split("-").map(Number);
  return `${MONTHS[month - 1]} ${date}`;
}

/** AQI levels drawn as guide lines, up to the top of the chart. */
const GUIDES = [50, 100, 150, 200, 300, 400];

/** The chart's top: the next level above the highest value, and never below 200. */
function scaleTop(values: number[]): number {
  const highest = Math.max(0, ...values);
  return [200, 300, 400, 500].find((top) => top >= highest) ?? 500;
}

/**
 * Charts are drawn twice, wide for big screens and narrow for phones, and CSS shows one. An SVG
 * scaled down to a phone would shrink its labels to unreadable sizes; this keeps them at 11px.
 */
interface Frame {
  W: number;
  H: number;
  LEFT: number;
  TOP: number;
  PLOT_W: number;
  PLOT_H: number;
  /** Label every n-th day on the bar chart. */
  every: number;
}

function frame(W: number, H: number, every: number): Frame {
  const LEFT = 34;
  const TOP = 10;
  const BOTTOM = 26;
  return { W, H, LEFT, TOP, PLOT_W: W - LEFT - 4, PLOT_H: H - BOTTOM - TOP, every };
}

const WIDE = frame(720, 240, 7);
const NARROW = frame(340, 230, 10);

function Guides({ top, f }: { top: number; f: Frame }) {
  const { W, LEFT, TOP, PLOT_H } = f;
  const y = (aqi: number) => TOP + PLOT_H - (aqi / top) * PLOT_H;
  return (
    <g className="chart-guides">
      {GUIDES.filter((g) => g <= top).map((g) => (
        <g key={g}>
          <line x1={LEFT} x2={W - 4} y1={y(g)} y2={y(g)} />
          <text x={LEFT - 6} y={y(g) + 4} textAnchor="end">
            {g}
          </text>
        </g>
      ))}
      <line className="chart-axis" x1={LEFT} x2={W - 4} y1={TOP + PLOT_H} y2={TOP + PLOT_H} />
    </g>
  );
}

/** Daily average AQI as bars, coloured by level. Days without enough readings show as gaps. */
export function DailyBars({ days, label }: { days: HistoryDay[]; label: string }) {
  return (
    <>
      <DailyBarsIn days={days} label={label} f={WIDE} className="chart-wide" />
      <DailyBarsIn days={days} label={label} f={NARROW} className="chart-narrow" />
    </>
  );
}

function DailyBarsIn({ days, label, f, className }: { days: HistoryDay[]; label: string; f: Frame; className: string }) {
  const { W, H, LEFT, TOP, PLOT_W, PLOT_H, every } = f;
  const top = scaleTop(days.map((d) => d.aqi ?? 0));
  const slot = PLOT_W / days.length;
  const barW = Math.max(slot - 4, 2);
  return (
    <svg className={`air-chart ${className}`} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label}>
      <Guides top={top} f={f} />
      {days.map((d, i) => {
        const x = LEFT + i * slot + (slot - barW) / 2;
        if (d.aqi === null) {
          return <rect key={d.day} className="chart-gap" x={x} y={TOP + PLOT_H - 3} width={barW} height={3} rx="1" />;
        }
        const h = Math.max((Math.min(d.aqi, top) / top) * PLOT_H, 2);
        const band = aqiBand(d.aqi);
        return (
          <rect key={d.day} className={`chart-bar aqi-fill-${band.level}`} x={x} y={TOP + PLOT_H - h} width={barW} height={h} rx="2">
            <title>{`${shortDate(d.day)}: AQI ${d.aqi}, ${band.label.toLowerCase()}`}</title>
          </rect>
        );
      })}
      <g className="chart-labels">
        {days.map((d, i) =>
          (days.length - 1 - i) % every === 0 ? (
            <text key={d.day} x={LEFT + i * slot + slot / 2} y={H - 6} textAnchor="middle">
              {i === days.length - 1 ? "Today" : shortDate(d.day)}
            </text>
          ) : null,
        )}
      </g>
    </svg>
  );
}

/** The same numbers as the bar chart, for screen readers and anyone who wants the figures. */
export function DailyTable({ days }: { days: HistoryDay[] }) {
  return (
    <details className="chart-data">
      <summary>Show the numbers</summary>
      <div className="climate-scroll" tabIndex={0} role="region" aria-label="Daily average air quality">
        <table className="climate-table">
          <thead>
            <tr>
              <th scope="col">Day</th>
              <th scope="col">US AQI</th>
              <th scope="col">Level</th>
            </tr>
          </thead>
          <tbody>
            {[...days].reverse().map((d) => (
              <tr key={d.day}>
                <th scope="row">{shortDate(d.day)}</th>
                <td>{d.aqi ?? "–"}</td>
                <td>{d.aqi === null ? "Not enough readings" : aqiBand(d.aqi).label}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

/** Hourly AQI as a line over coloured level bands, with a tick at each local midnight. */
export function HourlyLine({ hours, label }: { hours: HourValue[]; label: string }) {
  if (hours.length < 2) return null;
  return (
    <>
      <HourlyLineIn hours={hours} label={label} f={WIDE} className="chart-wide" />
      <HourlyLineIn hours={hours} label={label} f={NARROW} className="chart-narrow" />
    </>
  );
}

function HourlyLineIn({ hours, label, f, className }: { hours: HourValue[]; label: string; f: Frame; className: string }) {
  const { W, H, LEFT, TOP, PLOT_W, PLOT_H } = f;
  const values = hours.map((h) => usAqi(h.pm25));
  const top = scaleTop(values);
  const first = hours[0].time;
  const span = Math.max(hours[hours.length - 1].time - first, 1);
  const x = (time: number) => LEFT + ((time - first) / span) * PLOT_W;
  const y = (aqi: number) => TOP + PLOT_H - (Math.min(aqi, top) / top) * PLOT_H;

  // Break the line where an hour is missing rather than drawing across the gap.
  let path = "";
  hours.forEach((h, i) => {
    const jump = i === 0 || h.time - hours[i - 1].time > 3 * 3600;
    path += `${jump ? "M" : "L"}${x(h.time).toFixed(1)} ${y(values[i]).toFixed(1)}`;
  });

  const bands = [0, 50, 100, 150, 200, 300, 500].filter((b) => b < top);
  const midnights: number[] = [];
  const PKT = 5 * 3600;
  for (let t = Math.ceil((first + PKT) / 86_400) * 86_400 - PKT; t <= first + span; t += 86_400) midnights.push(t);

  return (
    <svg className={`air-chart ${className}`} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label}>
      <g className="chart-bands">
        {bands.map((b, i) => {
          const upper = Math.min([50, 100, 150, 200, 300, 500][i], top);
          return (
            <rect key={b} className={`aqi-fill-${i + 1}`} x={LEFT} y={y(upper)} width={PLOT_W} height={y(b) - y(upper)} />
          );
        })}
      </g>
      <Guides top={top} f={f} />
      <g className="chart-days">
        {midnights.map((t) => (
          <g key={t}>
            <line x1={x(t)} x2={x(t)} y1={TOP} y2={TOP + PLOT_H} />
            <text x={x(t) + 4} y={H - 6}>
              {WEEKDAYS[new Date((t + PKT) * 1000).getUTCDay()]}
            </text>
          </g>
        ))}
      </g>
      <path className="chart-line" d={path} />
    </svg>
  );
}

/** A month of daily AQI in a few pixels, for the ranking table. */
export function Sparkline({ days }: { days: HistoryDay[] }) {
  const w = 90;
  const h = 22;
  const slot = w / days.length;
  const top = scaleTop(days.map((d) => d.aqi ?? 0));
  return (
    <svg className="sparkline" viewBox={`0 0 ${w} ${h}`} width={w} height={h} aria-hidden="true">
      {days.map((d, i) =>
        d.aqi === null ? null : (
          <rect
            key={d.day}
            className={`aqi-fill-${aqiBand(d.aqi).level}`}
            x={i * slot + 0.4}
            y={h - Math.max((Math.min(d.aqi, top) / top) * h, 1.5)}
            width={Math.max(slot - 0.8, 1)}
            height={Math.max((Math.min(d.aqi, top) / top) * h, 1.5)}
          />
        ),
      )}
    </svg>
  );
}
