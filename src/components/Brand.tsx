import Link from "next/link";

/** The logo link, shared by the page shell and the error pages. */
export function Brand({ href = "/" }: { href?: string }) {
  return (
    <Link prefetch={false} href={href} className="brand" aria-label="Skycast Pakistan home">
      <svg viewBox="0 0 32 32" aria-hidden="true">
        <circle cx="12" cy="13" r="6" className="brand-sun" />
        <path d="M9 24h14a5 5 0 0 0 .6-9.96A6.5 6.5 0 0 0 11.3 16.1 4 4 0 0 0 9 24Z" className="brand-cloud" />
      </svg>
      Skycast <span className="brand-tag">Pakistan</span>
    </Link>
  );
}
