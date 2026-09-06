// Websupport REST API READ-ONLY probe (ADR-0103 előkészítés).
//
// GET-only by construction: the fetch helper refuses any other verb, so this
// script can never buy, pay for or mutate anything. It exists because the
// registrar switch (INWX -> Websupport) needs measured API behaviour, and
// "measured" must be reproducible — not a one-off curl in a chat log.
//
// Usage:
//   npx tsx scripts/websupport-probe.mts                 # default probe set
//   npx tsx scripts/websupport-probe.mts /v1/user/self   # explicit paths
//
// Credentials come from the local .env (WEBSUPPORT_API_KEY / _API_SECRET / _USER_ID);
// they are never printed.

import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const BASE = "https://rest.websupport.hu";

function loadEnv(): Record<string, string> {
  const out: Record<string, string> = { ...process.env } as Record<string, string>;
  try {
    const raw = readFileSync(resolve(HERE, "..", ".env"), "utf8");
    for (const line of raw.split("\n")) {
      const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line);
      if (!m) continue;
      const [, k, v] = m;
      if (!out[k]) out[k] = v.trim().replace(/^["']|["']$/g, "");
    }
  } catch {
    // .env is optional when the vars come from the environment
  }
  return out;
}

const env = loadEnv();
const API_KEY = env.WEBSUPPORT_API_KEY ?? "";
const API_SECRET = env.WEBSUPPORT_API_SECRET ?? "";
const USER_ID = env.WEBSUPPORT_USER_ID ?? "";

if (!API_KEY || !API_SECRET) {
  console.error("HIÁNYZIK: WEBSUPPORT_API_KEY / WEBSUPPORT_API_SECRET (.env)");
  process.exit(2);
}

/**
 * HMAC-SHA1 over "{METHOD} {path} {unix_ts}" -> hex, sent as Basic apiKey:signature.
 * MEASURED (2026-09-06): the signed path must NOT contain the query string — signing
 * "/v1/user/3213041/service?perPage=100" answers 401 "Incorrect api key or signature",
 * signing "/v1/user/3213041/service" and sending the query on the URL answers 200.
 */
function authHeaders(pathWithQuery: string): Record<string, string> {
  const path = pathWithQuery.split("?")[0];
  const ts = Math.floor(Date.now() / 1000);
  const sig = createHmac("sha1", API_SECRET).update(`GET ${path} ${ts}`).digest("hex");
  const basic = Buffer.from(`${API_KEY}:${sig}`).toString("base64");
  return {
    Authorization: `Basic ${basic}`,
    Date: new Date(ts * 1000).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, ""),
    Accept: "application/json",
  };
}

async function get(path: string): Promise<{ status: number; body: unknown }> {
  const res = await fetch(`${BASE}${path}`, { method: "GET", headers: authHeaders(path) });
  const text = await res.text();
  let body: unknown = text;
  try {
    body = JSON.parse(text);
  } catch {
    // non-JSON error pages stay as text
  }
  return { status: res.status, body };
}

/**
 * NARROW EXCEPTION to the GET-only rule: the availability+price endpoint is a POST by
 * protocol but read-only by effect — it creates no order, charges nothing, and changes
 * no account state. It is measured here (owner-permitted, 2026-09-06) so the registrar
 * adapter can parse the REAL price field instead of a guessed one (§B.17 forbids
 * shipping fabricated response shapes). No other POST belongs in this file.
 */
async function validateDomain(domain: string): Promise<void> {
  const path = "/v1/order/hu/validate/domain";
  const ts = Math.floor(Date.now() / 1000);
  const sig = createHmac("sha1", API_SECRET).update(`POST ${path} ${ts}`).digest("hex");
  const headers = {
    Authorization: `Basic ${Buffer.from(`${API_KEY}:${sig}`).toString("base64")}`,
    Date: new Date(ts * 1000).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, ""),
    Accept: "application/json",
    "Content-Type": "application/json",
  };
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify({ domain, period: 1 }),
  });
  const text = await res.text();
  console.log(`\n=== VALIDATE ${domain} -> ${res.status}`);
  try {
    console.log(JSON.stringify(JSON.parse(text), null, 2));
  } catch {
    console.log(text.slice(0, 2000));
  }
}

const validateArg = process.argv.indexOf("--validate");
if (validateArg !== -1) {
  for (const d of process.argv.slice(validateArg + 1)) await validateDomain(d);
  process.exit(0);
}

const paths = process.argv.slice(2).length
  ? process.argv.slice(2)
  : [
      `/v1/user/${USER_ID || "self"}`,
      `/v1/user/${USER_ID || "self"}/service?perPage=100`,
      `/v1/user/${USER_ID || "self"}/zone?perPage=100`,
      `/v1/user/${USER_ID || "self"}/domain-profile`,
    ];

for (const p of paths) {
  if (!p.startsWith("/")) {
    console.error(`KIHAGYVA (nem útvonal): ${p}`);
    continue;
  }
  const { status, body } = await get(p);
  console.log(`\n=== GET ${p} -> ${status}`);
  const json = JSON.stringify(body, null, 2) ?? "";
  console.log(json.length > 6000 ? `${json.slice(0, 6000)}\n… (levágva, ${json.length} bájt)` : json);
}
