"use client";

import Link from "next/link";

import { Brand } from "@/components/Brand";
import { SearchBox } from "@/components/SearchBox";

/**
 * OpenWeather was down, slow or rate-limited. `retry` fetches the page again from the server;
 * `reset` would only redraw what already failed.
 */
export default function ErrorPage({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <div className="page" data-sky="clouds">
      {/* Hoisted into <head>: an error is not a page search engines should keep. */}
      <meta name="robots" content="noindex" />
      <header className="topbar">
        <Brand />
        <div className="tools">
          <SearchBox units="metric" />
        </div>
      </header>
      <main id="main" className="sky sky-short">
        <section className="notice" aria-labelledby="error-title">
          <h1 id="error-title">The forecast didn&apos;t load</h1>
          <p>The weather service didn&apos;t answer in time. This is usually brief.</p>
          <p className="notice-actions">
            <button type="button" className="button" onClick={() => retry()}>
              Try again
            </button>
            <Link prefetch={false} href="/" className="button button-quiet">
              All Pakistan weather
            </Link>
          </p>
        </section>
      </main>
    </div>
  );
}
