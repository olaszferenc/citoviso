// Google Search Console + Site Verification client (ADR-0415) — service-account auth,
// no third-party library (the JWT is signed with node:crypto).
//
// SOURCES (fetched 2026-11-03, official Google docs):
//   sites.add        PUT  https://www.googleapis.com/webmasters/v3/sites/{siteUrl}
//                    developers.google.com/webmaster-tools/v1/sites/add
//   sitemaps.submit  PUT  https://www.googleapis.com/webmasters/v3/sites/{siteUrl}/sitemaps/{feedpath}
//                    developers.google.com/webmaster-tools/v1/sitemaps/submit
//   sitemaps.get     GET  …/sites/{siteUrl}/sitemaps/{feedpath}  (the report: lastDownloaded, errors)
//   scope            https://www.googleapis.com/auth/webmasters  (how-tos/authorizing: "Read/write access")
//   getToken         POST https://www.googleapis.com/siteVerification/v1/token
//   insert           POST https://www.googleapis.com/siteVerification/v1/webResource?verificationMethod=DNS_TXT
//                    developers.google.com/site-verification/v1/webResource/{getToken,insert}
//                    INET_DOMAIN ⇔ DNS_TXT/DNS_CNAME; "any email addresses you specify in the
//                    owners field in the request body are also recorded as verified site owners"
//   scope            https://www.googleapis.com/auth/siteverification
//   quota            sites/sitemaps: 20 QPS and 200 QPM per user (developers.google.com/webmaster-tools/limits)
// ⚠️ NOT documented anywhere (measure, do not assume): that a SERVICE ACCOUNT may verify an
// INET_DOMAIN by itself. The first real custom-domain run proves or disproves it; the
// failure surfaces as a logged `verify` error, never as a broken go-live.

import { createSign } from "node:crypto";
import { readFile } from "node:fs/promises";

export type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

/** One HTTP exchange with Google, as it goes into search_console_event. */
export interface GoogleCall {
  readonly ok: boolean;
  readonly status: number;
  /** The response body (shortened) or the transport error. */
  readonly detail: string;
}

export interface SearchConsoleClient {
  /** true = talks to Google; false = the recording mock (dev, tests). */
  readonly live: boolean;
  /** Site Verification getToken for a Domain property (DNS_TXT) → the TXT content. */
  getDomainToken(domain: string): Promise<GoogleCall & { token: string | null }>;
  /** Site Verification insert (DNS_TXT) — Google checks the TXT now. */
  verifyDomain(domain: string, owners: readonly string[]): Promise<GoogleCall>;
  /** Search Console sites.add. */
  addSite(property: string): Promise<GoogleCall>;
  /** Search Console sites.get → the service account's permissionLevel on it (null = none). */
  getSite(property: string): Promise<GoogleCall & { permission: string | null }>;
  /** Search Console sitemaps.submit. */
  submitSitemap(property: string, sitemapUrl: string): Promise<GoogleCall>;
}

const SCOPES = [
  "https://www.googleapis.com/auth/webmasters",
  "https://www.googleapis.com/auth/siteverification",
].join(" ");
const WEBMASTERS = "https://www.googleapis.com/webmasters/v3";
const SITE_VERIFICATION = "https://www.googleapis.com/siteVerification/v1";

interface ServiceAccountKey {
  readonly client_email: string;
  readonly private_key: string;
  readonly token_uri?: string;
}

const b64url = (b: Buffer | string): string =>
  Buffer.from(b).toString("base64").replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");

/** RFC 7523 JWT bearer assertion for the Google token endpoint (pure — testable). */
export function signServiceAccountJwt(key: ServiceAccountKey, nowSec: number, scope = SCOPES): string {
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = b64url(
    JSON.stringify({
      iss: key.client_email,
      scope,
      aud: key.token_uri ?? "https://oauth2.googleapis.com/token",
      iat: nowSec,
      exp: nowSec + 3600,
    }),
  );
  const signer = createSign("RSA-SHA256");
  signer.update(`${header}.${claims}`);
  return `${header}.${claims}.${b64url(signer.sign(key.private_key))}`;
}

export async function loadServiceAccountKey(file: string): Promise<ServiceAccountKey | null> {
  try {
    const k = JSON.parse(await readFile(file, "utf8")) as Partial<ServiceAccountKey>;
    if (!k.client_email || !k.private_key) return null;
    return k as ServiceAccountKey;
  } catch {
    return null;
  }
}

const short = (s: string): string => (s.length > 600 ? `${s.slice(0, 600)}…` : s);

/** The real client. Only ever constructed on the live host (searchConsoleTick decides). */
export function googleClient(key: ServiceAccountKey, fetchImpl: FetchLike = fetch): SearchConsoleClient {
  let token: { value: string; until: number } | null = null;

  async function accessToken(): Promise<string> {
    const now = Math.floor(Date.now() / 1000);
    if (token && token.until > now + 60) return token.value;
    const res = await fetchImpl(key.token_uri ?? "https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion: signServiceAccountJwt(key, now),
      }).toString(),
      signal: AbortSignal.timeout(30_000),
    });
    const body = (await res.json().catch(() => ({}))) as { access_token?: string; expires_in?: number; error?: string };
    if (!res.ok || !body.access_token) {
      throw new Error(`Google token: HTTP ${res.status} ${body.error ?? ""}`.trim());
    }
    token = { value: body.access_token, until: now + (body.expires_in ?? 3600) };
    return token.value;
  }

  async function call(method: string, url: string, body?: unknown): Promise<GoogleCall & { json: unknown }> {
    try {
      const res = await fetchImpl(url, {
        method,
        headers: {
          authorization: `Bearer ${await accessToken()}`,
          ...(body === undefined ? {} : { "content-type": "application/json" }),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        signal: AbortSignal.timeout(30_000),
      });
      const text = await res.text();
      let json: unknown = null;
      try {
        json = text ? JSON.parse(text) : null;
      } catch {
        json = null;
      }
      return { ok: res.ok, status: res.status, detail: short(text || `HTTP ${res.status}`), json };
    } catch (e) {
      return { ok: false, status: 0, detail: short((e as Error).message), json: null };
    }
  }

  const enc = encodeURIComponent;
  return {
    live: true,
    async getDomainToken(domain) {
      const r = await call("POST", `${SITE_VERIFICATION}/token`, {
        site: { type: "INET_DOMAIN", identifier: domain },
        verificationMethod: "DNS_TXT",
      });
      const t = (r.json as { token?: string } | null)?.token ?? null;
      return { ok: r.ok && !!t, status: r.status, detail: r.detail, token: t };
    },
    async verifyDomain(domain, owners) {
      return call("POST", `${SITE_VERIFICATION}/webResource?verificationMethod=DNS_TXT`, {
        site: { type: "INET_DOMAIN", identifier: domain },
        ...(owners.length ? { owners } : {}),
      });
    },
    async addSite(property) {
      return call("PUT", `${WEBMASTERS}/sites/${enc(property)}`);
    },
    async getSite(property) {
      const r = await call("GET", `${WEBMASTERS}/sites/${enc(property)}`);
      const permission = r.ok ? ((r.json as { permissionLevel?: string } | null)?.permissionLevel ?? null) : null;
      return { ok: r.ok, status: r.status, detail: r.detail, permission };
    },
    async submitSitemap(property, sitemapUrl) {
      return call("PUT", `${WEBMASTERS}/sites/${enc(property)}/sitemaps/${enc(sitemapUrl)}`);
    },
  };
}

/** One recorded call of the mock — the dev/test evidence of what WOULD have gone out. */
export interface MockCall {
  readonly op: "getDomainToken" | "verifyDomain" | "addSite" | "getSite" | "submitSitemap";
  readonly args: readonly string[];
}

/**
 * Dev/test client: answers like Google, never touches the network. `fail` makes an
 * operation fail (status 403) for the failure paths — a set of op names, or of
 * "op:arg" pairs to fail one target only.
 */
export function mockClient(opts: { fail?: Set<string> } = {}): SearchConsoleClient & { calls: MockCall[] } {
  const calls: MockCall[] = [];
  const answer = (op: MockCall["op"], args: string[]): GoogleCall => {
    calls.push({ op, args });
    const failed = opts.fail?.has(op) || args.some((a) => opts.fail?.has(`${op}:${a}`));
    return failed
      ? { ok: false, status: 403, detail: `mock: ${op} megtagadva` }
      : { ok: true, status: 200, detail: `mock: ${op} ok` };
  };
  return {
    live: false,
    calls,
    async getDomainToken(domain) {
      const r = answer("getDomainToken", [domain]);
      return { ...r, token: r.ok ? `google-site-verification=mock-${domain}` : null };
    },
    async verifyDomain(domain, owners) {
      return answer("verifyDomain", [domain, ...owners]);
    },
    async addSite(property) {
      return answer("addSite", [property]);
    },
    async getSite(property) {
      const r = answer("getSite", [property]);
      return { ...r, permission: r.ok ? "siteOwner" : null };
    },
    async submitSitemap(property, sitemapUrl) {
      return answer("submitSitemap", [property, sitemapUrl]);
    },
  };
}
