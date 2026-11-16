"use client";

import { useEffect } from "react";

/** Registers public/sw.js, which only provides the offline page. Not in development. */
export function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Private windows and some browsers refuse; the site works the same without it.
    });
  }, []);
  return null;
}
