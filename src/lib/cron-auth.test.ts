import { SignJWT, createLocalJWKSet, exportJWK, generateKeyPair } from "jose";
import { beforeAll, describe, expect, it } from "vitest";

import { AUDIENCE, GITHUB_ISSUER, REPOSITORY, authorizeCollector } from "./cron-auth";

const WORKFLOW_REF = `${REPOSITORY}/.github/workflows/air-history.yml@refs/heads/main`;

let keys: ReturnType<typeof createLocalJWKSet>;
let sign: (claims?: Record<string, unknown>, options?: { audience?: string; issuer?: string; expires?: string }) => Promise<string>;
let otherSign: typeof sign;

async function signer() {
  const { privateKey, publicKey } = await generateKeyPair("RS256");
  const jwk = { ...(await exportJWK(publicKey)), kid: crypto.randomUUID(), alg: "RS256" };
  const make: typeof sign = (claims = {}, { audience = AUDIENCE, issuer = GITHUB_ISSUER, expires = "5m" } = {}) =>
    new SignJWT({ repository: REPOSITORY, ref: "refs/heads/main", job_workflow_ref: WORKFLOW_REF, ...claims })
      .setProtectedHeader({ alg: "RS256", kid: jwk.kid })
      .setIssuer(issuer)
      .setAudience(audience)
      .setIssuedAt()
      .setExpirationTime(expires)
      .sign(privateKey);
  return { jwk, make };
}

beforeAll(async () => {
  const github = await signer();
  const stranger = await signer();
  keys = createLocalJWKSet({ keys: [github.jwk] });
  sign = github.make;
  otherSign = stranger.make;
});

const check = (token: string | null, cronSecret?: string) =>
  authorizeCollector(token === null ? null : `Bearer ${token}`, { keys, cronSecret });

describe("who may run the air collector", () => {
  it("accepts this repository's collector workflow on main", async () => {
    expect(await check(await sign())).toEqual({ ok: true, via: "github-actions" });
  });

  it("refuses everything else", async () => {
    const refused = [
      await check(null),
      await authorizeCollector("Basic abc", { keys }),
      await check("not-a-token"),
      await check(await otherSign()), // signed by someone other than GitHub
      await check(await sign({ repository: "someone/skycast" })),
      await check(await sign({ ref: "refs/heads/feature" })),
      await check(await sign({ job_workflow_ref: `${REPOSITORY}/.github/workflows/ci.yml@refs/heads/main` })),
      await check(await sign({}, { audience: "sts.amazonaws.com" })),
      await check(await sign({}, { issuer: "https://evil.example" })),
      await check(await sign({}, { expires: "-1m" })),
    ];
    for (const verdict of refused) expect(verdict.ok).toBe(false);
  });

  it("takes a long CRON_SECRET when one is set, and never a short or wrong one", async () => {
    const secret = "s".repeat(40);
    expect(await check(secret, secret)).toEqual({ ok: true, via: "cron-secret" });
    expect((await check("x".repeat(40), secret)).ok).toBe(false);
    expect((await check("short", "short")).ok).toBe(false);
  });
});
