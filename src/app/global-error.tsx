"use client";

import "./globals.css";

/**
 * Shown only when the root layout itself fails, so it brings its own <html> and <body>.
 * Kept plain: nothing here may depend on what just broke.
 */
export default function GlobalError({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <html lang="en-PK">
      <head>
        <title>Something went wrong · Skycast</title>
        <meta name="robots" content="noindex" />
      </head>
      <body>
        <div className="page" data-sky="clouds">
          <main id="main" className="sky sky-short">
            <section className="notice" aria-labelledby="global-error-title">
              <h1 id="global-error-title">Something went wrong</h1>
              <p>Skycast couldn&apos;t load. Try again in a moment.</p>
              <p className="notice-actions">
                <button type="button" className="button" onClick={() => retry()}>
                  Try again
                </button>
                {/* A plain link on purpose: a full page load starts everything afresh. */}
                {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
                <a href="/" className="button button-quiet">
                  Home
                </a>
              </p>
            </section>
          </main>
        </div>
      </body>
    </html>
  );
}
