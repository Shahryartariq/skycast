import "server-only";

import postgres, { type Sql } from "postgres";

/**
 * The Postgres database for air quality history. Vercel's Neon integration sets DATABASE_URL
 * (and POSTGRES_URL); without either, the site works as before and the history pages say so.
 */
export function databaseUrl(): string | undefined {
  return (process.env.DATABASE_URL ?? process.env.POSTGRES_URL)?.trim() || undefined;
}

export const hasDatabase = () => databaseUrl() !== undefined;

const isLocal = (url: string) => /@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(url);

let client: Sql | undefined;

/**
 * One small connection per server instance: serverless functions each get their own, and Neon's
 * pooled URL multiplexes them. Prepared statements stay off, as poolers in transaction mode need.
 */
export function db(): Sql {
  const url = databaseUrl();
  if (!url) throw new Error("DATABASE_URL is not set.");
  client ??= postgres(url, {
    max: 1,
    idle_timeout: 20,
    connect_timeout: 10,
    ssl: isLocal(url) ? false : "require",
    prepare: false,
  });
  return client;
}
