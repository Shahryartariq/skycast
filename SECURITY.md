# Security

## Reporting a problem

Please report security problems privately, not in a public issue. Use GitHub's
[private vulnerability reporting](https://github.com/Shahryartariq/skycast/security/advisories/new)
for this repository. I'll reply within a week.

## What's in place

- **The OpenWeather key stays on the server.** The browser only talks to Skycast's own pages and
  `/api/places`. Errors never echo upstream URLs, which contain the key.
- **Strict Content Security Policy** with a fresh nonce per request (`src/proxy.ts`, `src/lib/csp.ts`),
  plus HSTS, `X-Frame-Options: DENY`, `nosniff`, a narrow `Permissions-Policy` and
  `Cross-Origin-Opener-Policy` (`next.config.ts`).
- **Rate limits** on lookups that reach OpenWeather: searches and coordinates on `/`, and `/api/places`.
  Counted per IP in memory on each server instance, so they stop bursts rather than enforce an exact
  global limit. For that, add a rate-limit rule in Vercel's firewall.
- **Input is validated** before use: coordinates are range-checked and rounded, searches are capped at
  80 characters, and the location headers on `/my-location` are checked before they're shown.
- **No personal data is stored.** The IP address on `/my-location` is shown only to its owner, in a
  response that is never cached. Cookies hold only the theme and °F choice.
- **Dependencies**: CI fails on high-severity advisories in production dependencies, Dependabot opens
  weekly updates, and CodeQL scans every pull request.
