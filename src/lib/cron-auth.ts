import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from "jose";

/**
 * Who may run the hourly air collector. GitHub Actions signs a short-lived token (OIDC) for each
 * run of our workflow; we check GitHub's signature and that the token is for this repository's
 * collector workflow on main. No shared secret exists to leak or rotate.
 * https://docs.github.com/en/actions/security-for-github-actions/security-hardening-your-deployments/about-security-hardening-with-openid-connect
 */
export const GITHUB_ISSUER = "https://token.actions.githubusercontent.com";
export const AUDIENCE = "skycast-air-collector";
export const REPOSITORY = "Shahryartariq/skycast";
export const WORKFLOW = ".github/workflows/air-history.yml";

const githubKeys = createRemoteJWKSet(new URL(`${GITHUB_ISSUER}/.well-known/jwks`));

export type Verdict = { ok: true; via: string } | { ok: false; reason: string };

/** Constant-time comparison, so response timing says nothing about a secret. */
function sameSecret(a: string, b: string): boolean {
  const left = new TextEncoder().encode(a);
  const right = new TextEncoder().encode(b);
  if (left.length !== right.length) return false;
  let diff = 0;
  for (let i = 0; i < left.length; i++) diff |= left[i] ^ right[i];
  return diff === 0;
}

export async function authorizeCollector(
  authorization: string | null,
  { keys = githubKeys, cronSecret = process.env.CRON_SECRET?.trim() }: { keys?: JWTVerifyGetKey; cronSecret?: string } = {},
): Promise<Verdict> {
  const token = /^Bearer (\S+)$/i.exec(authorization ?? "")?.[1];
  if (!token) return { ok: false, reason: "Missing bearer token." };

  // Vercel Cron sends CRON_SECRET this way when it's set. Optional, and off unless configured.
  if (cronSecret && cronSecret.length >= 32 && sameSecret(token, cronSecret)) return { ok: true, via: "cron-secret" };

  try {
    const { payload } = await jwtVerify(token, keys, { issuer: GITHUB_ISSUER, audience: AUDIENCE, algorithms: ["RS256"] });
    if (payload.repository !== REPOSITORY) return { ok: false, reason: "Token is for another repository." };
    if (payload.ref !== "refs/heads/main") return { ok: false, reason: "Only runs from main may collect." };
    const workflow = String(payload.job_workflow_ref ?? payload.workflow_ref ?? "");
    if (!workflow.startsWith(`${REPOSITORY}/${WORKFLOW}@`)) return { ok: false, reason: "Token is for another workflow." };
    return { ok: true, via: "github-actions" };
  } catch {
    return { ok: false, reason: "Invalid token." };
  }
}
