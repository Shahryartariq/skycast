import Link from "next/link";

import { CITIES, PROVINCES, cityPath, type City } from "@/lib/cities";
import { MONTHS, climateOf } from "@/lib/climate";
import { COMPARE_PATH, comparePath, warmer } from "@/lib/compare";
import { conditionLabel } from "@/lib/conditions";
import { aqiBand, formatPercent, formatTemp, formatWind, usAqi } from "@/lib/format";
import { dayLabel, formatClock, localDay } from "@/lib/time";
import type { Snapshot, Units } from "@/lib/types";

import { WeatherIcon } from "./WeatherIcon";

export interface Side {
  city: City;
  snapshot: Snapshot | null;
}

const suffixFor = (units: Units) => (units === "imperial" ? "?units=imperial" : "");

/** Highest chance of rain in the next 24 hours (eight 3-hour slots). */
const rainNext24h = (snapshot: Snapshot) => Math.max(0, ...snapshot.hourly.slice(0, 8).map((slot) => slot.pop));

const aqiOf = (snapshot: Snapshot) => (snapshot.air ? usAqi(snapshot.air.pm25) : null);

/** Absolute temperature difference in the reader's units: "4°". */
function tempGap(celsius: number, units: Units): string {
  const value = units === "imperial" ? (Math.abs(celsius) * 9) / 5 : Math.abs(celsius);
  return `${Math.round(value)}°`;
}

/**
 * The comparison in a sentence or two, from the numbers on the page: temperature, then air and
 * rain only when the difference is worth saying.
 */
export function compareSummary(a: Side, b: Side, units: Units): string | null {
  if (!a.snapshot || !b.snapshot) return null;
  const diff = b.snapshot.current.temp - a.snapshot.current.temp;
  const direction = warmer(diff);
  const parts: string[] = [];
  parts.push(
    direction === "same"
      ? `${b.city.name} and ${a.city.name} are about the same temperature right now (${formatTemp(b.snapshot.current.temp, units)} and ${formatTemp(a.snapshot.current.temp, units)}).`
      : `${b.city.name} is ${tempGap(diff, units)} ${direction} than ${a.city.name} right now (${formatTemp(b.snapshot.current.temp, units)} against ${formatTemp(a.snapshot.current.temp, units)}).`,
  );

  const airA = aqiOf(a.snapshot);
  const airB = aqiOf(b.snapshot);
  if (airA !== null && airB !== null && Math.abs(airA - airB) >= 25) {
    const [cleaner, dirtier, clean, dirty] = airA < airB ? [a, b, airA, airB] : [b, a, airB, airA];
    parts.push(`The air is cleaner in ${cleaner.city.name} (AQI ${clean} against ${dirty} in ${dirtier.city.name}).`);
  }

  const rainA = rainNext24h(a.snapshot);
  const rainB = rainNext24h(b.snapshot);
  if (Math.max(rainA, rainB) >= 0.3 && Math.abs(rainA - rainB) >= 0.2) {
    const [wetter, chance] = rainA > rainB ? [a, rainA] : [b, rainB];
    parts.push(`Rain is more likely in ${wetter.city.name} in the next 24 hours (${formatPercent(chance)}).`);
  }
  return parts.join(" ");
}

function NowCard({ side, units }: { side: Side; units: Units }) {
  const { city, snapshot } = side;
  return (
    <li className="duel-card">
      <Link prefetch={false} href={`${cityPath(city)}${suffixFor(units)}`} className="duel-name">
        {city.name}
      </Link>
      <span className="duel-region">{city.region}</span>
      {snapshot ? (
        <>
          <span className="duel-reading">
            <span className="duel-temp">{formatTemp(snapshot.current.temp, units)}</span>
            <WeatherIcon condition={snapshot.current.condition} isDay={snapshot.current.isDay} size={34} />
          </span>
          <span className="duel-condition">
            {conditionLabel(snapshot.current.condition, snapshot.current.isDay)} · Feels{" "}
            {formatTemp(snapshot.current.feelsLike, units)}
          </span>
        </>
      ) : (
        <span className="duel-condition">Live weather isn&apos;t available right now.</span>
      )}
    </li>
  );
}

function daylight(snapshot: Snapshot): string {
  const minutes = Math.round((snapshot.current.sunset - snapshot.current.sunrise) / 60);
  return `${Math.floor(minutes / 60)} h ${minutes % 60} min`;
}

function Cell({ snapshot, render }: { snapshot: Snapshot | null; render: (s: Snapshot) => React.ReactNode }) {
  return <td>{snapshot ? render(snapshot) : "–"}</td>;
}

function AirCell({ snapshot }: { snapshot: Snapshot }) {
  const aqi = aqiOf(snapshot);
  if (aqi === null) return <>–</>;
  const band = aqiBand(aqi);
  return (
    <span className="aqi-label">
      <span className={`aqi aqi-${band.level}`} aria-hidden="true" />
      <span className="aqi-value">{aqi}</span>
      <span className="aqi-band">{band.label}</span>
    </span>
  );
}

export function CompareNow({ a, b, units }: { a: Side; b: Side; units: Units }) {
  return <ul className="duel">{[a, b].map((side) => <NowCard key={side.city.slug} side={side} units={units} />)}</ul>;
}

/** Today's numbers, one row each, the two cities in columns. */
export function CompareTable({ a, b, units }: { a: Side; b: Side; units: Units }) {
  const rows: { label: string; render: (s: Snapshot) => React.ReactNode }[] = [
    { label: "Temperature", render: (s) => formatTemp(s.current.temp, units) },
    { label: "Feels like", render: (s) => formatTemp(s.current.feelsLike, units) },
    { label: "Today's high and low", render: (s) => `${formatTemp(s.current.high, units)} / ${formatTemp(s.current.low, units)}` },
    { label: "Sky", render: (s) => conditionLabel(s.current.condition, s.current.isDay) },
    { label: "Rain chance, next 24 h", render: (s) => formatPercent(rainNext24h(s)) },
    { label: "Humidity", render: (s) => `${Math.round(s.current.humidity)}%` },
    { label: "Wind", render: (s) => formatWind(s.current.windSpeed, units) },
    { label: "Air quality (US AQI)", render: (s) => <AirCell snapshot={s} /> },
    { label: "Sunrise", render: (s) => formatClock(s.current.sunrise, s.timezoneOffset) },
    { label: "Sunset", render: (s) => formatClock(s.current.sunset, s.timezoneOffset) },
    { label: "Daylight", render: daylight },
  ];
  return (
    <div className="climate-scroll" tabIndex={0} role="region" aria-label={`${a.city.name} and ${b.city.name} today`}>
      <table className="climate-table compare-table">
        <thead>
          <tr>
            <th scope="col">
              <span className="visually-hidden">Measure</span>
            </th>
            <th scope="col">{a.city.name}</th>
            <th scope="col">{b.city.name}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ label, render }) => (
            <tr key={label}>
              <th scope="row">{label}</th>
              <Cell snapshot={a.snapshot} render={render} />
              <Cell snapshot={b.snapshot} render={render} />
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** The next five days, matched by date. */
export function CompareDays({ a, b, units }: { a: Side; b: Side; units: Units }) {
  const lead = a.snapshot ?? b.snapshot;
  if (!lead) return null;
  const today = localDay(lead.observedAt, lead.timezoneOffset);
  const dates = lead.daily.map((day) => day.date);
  const dayCell = (side: Side, date: string) => {
    const day = side.snapshot?.daily.find((d) => d.date === date);
    if (!day) return <td>–</td>;
    return (
      <td>
        <span className="compare-day">
          <WeatherIcon condition={day.condition} size={22} />
          <span className="visually-hidden">{conditionLabel(day.condition)}, </span>
          {formatTemp(day.min, units)} / {formatTemp(day.max, units)}
        </span>
      </td>
    );
  };
  return (
    <div className="climate-scroll" tabIndex={0} role="region" aria-label="Next five days">
      <table className="climate-table compare-table">
        <thead>
          <tr>
            <th scope="col">Day</th>
            <th scope="col">
              {a.city.name} <span className="long-label">low / high</span>
            </th>
            <th scope="col">
              {b.city.name} <span className="long-label">low / high</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {dates.map((date) => (
            <tr key={date}>
              <th scope="row">{dayLabel(date, today)}</th>
              {dayCell(a, date)}
              {dayCell(b, date)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Average highs and lows by month, for planning a trip. */
export function CompareMonths({ a, b, units, month }: { a: Side; b: Side; units: Units; month: number }) {
  const climateA = climateOf(a.city.slug);
  const climateB = climateOf(b.city.slug);
  if (!climateA || !climateB) return null;
  return (
    <div className="climate-scroll" tabIndex={0} role="region" aria-label="Average weather by month">
      <table className="climate-table compare-table">
        <thead>
          <tr>
            <th scope="col">Month</th>
            <th scope="col">
              {a.city.name} <span className="long-label">high / low</span>
            </th>
            <th scope="col">
              {b.city.name} <span className="long-label">high / low</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {MONTHS.map((name, i) => (
            <tr key={name} aria-current={i === month ? "true" : undefined}>
              <th scope="row">
                <span className="long-label">{name}</span>
                <span className="short-label" aria-hidden="true">
                  {name.slice(0, 3)}
                </span>
              </th>
              <td>
                {formatTemp(climateA.months[i].high, units)} / {formatTemp(climateA.months[i].low, units)}
              </td>
              <td>
                {formatTemp(climateB.months[i].high, units)} / {formatTemp(climateB.months[i].low, units)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CitySelect({ name, label, value }: { name: "a" | "b"; label: string; value?: string }) {
  const islamabad = CITIES.filter((city) => !city.province);
  return (
    <label className="picker-field">
      <span>{label}</span>
      <select name={name} defaultValue={value} required>
        {islamabad.map((city) => (
          <option key={city.slug} value={city.slug}>
            {city.name}
          </option>
        ))}
        {PROVINCES.map((province) => (
          <optgroup key={province.slug} label={province.name}>
            {CITIES.filter((city) => city.province === province.slug).map((city) => (
              <option key={city.slug} value={city.slug}>
                {city.name}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
    </label>
  );
}

/** Two drop-downs and a button. A plain GET form, so it works before any JavaScript loads. */
export function ComparePicker({ a = "lahore", b = "islamabad", units }: { a?: string; b?: string; units: Units }) {
  return (
    <form className="picker" action={COMPARE_PATH} method="get">
      <CitySelect name="a" label="First city" value={a} />
      <CitySelect name="b" label="Second city" value={b} />
      {units === "imperial" && <input type="hidden" name="units" value="imperial" />}
      <button type="submit" className="button">
        Compare
      </button>
    </form>
  );
}

/** "Compare Lahore with Islamabad, Karachi, …" on a city page. */
export function CompareLinks({ city, others, units }: { city: City; others: City[]; units: Units }) {
  if (others.length === 0) return null;
  return (
    <p className="compare-links">
      Compare {city.name} with{" "}
      {others.map((other, i) => (
        <span key={other.slug}>
          <Link prefetch={false} href={`${comparePath(city, other)}${suffixFor(units)}`}>
            {other.name}
          </Link>
          {i < others.length - 2 ? ", " : i === others.length - 2 ? " or " : ""}
        </span>
      ))}
    </p>
  );
}
