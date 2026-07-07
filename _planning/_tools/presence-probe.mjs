// One-off presence probe: for leads classified as having NO own site
// (none | portal_only), guess candidate domains from the business name and
// verify via HTTP whether an own website actually exists. Zero external API.
// Verification is content-based: the fetched page must mention the brand core
// AND the region ("badacsony") to count as a confirmed own site — this guards
// against parked domains and unrelated squatters. Read-only diagnostic.

import { readFile } from "node:fs/promises";

const REGION_TERM = "badacsony";
const TLDS = ["hu", "com"];
const TIMEOUT_MS = 5000;
const MAX_BYTES = 120_000;
const CONCURRENCY = 12;

// Accommodation "type" words — stripped to derive a brand core, but candidates
// are generated BOTH with and without them (brand may legitimately include one).
const TYPE_WORDS = new Set([
  "vendeghaz", "haz", "panzio", "szallashely", "szallas", "guest", "guesthouse",
  "guesthaus", "house", "apartman", "apartment", "camping", "hostel", "fogado",
  "cottage", "birtok", "pinceszet", "szolobirtok", "villa", "hotel",
]);

// Parked / builder-placeholder markers → NOT a real own site.
const PARKED = [
  "domain for sale", "this domain is for sale", "eladó a domain",
  "buy this domain", "parkoló oldal", "under construction",
  "website coming soon", "domain parking",
  // Hungarian placeholder/for-sale variants.
  "ez a honlap eladó", "a honlap eladó", "ez a domain eladó",
  "az oldal eladó", "megvásárolható", "foglalt domain",
];

function deaccent(s) {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "");
}
function tokens(name) {
  return deaccent(name.toLowerCase())
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

function candidateHosts(name) {
  const t = tokens(name);
  const core = t.filter((w) => !TYPE_WORDS.has(w));
  const sets = new Set();
  const add = (arr) => {
    if (!arr.length) return;
    sets.add(arr.join(""));
    sets.add(arr.join("-"));
  };
  add(t);            // full name
  add(core);         // brand only
  add([...core, REGION_TERM]);   // brand + region
  add([...t, REGION_TERM]);
  if (core.length === 1 && core[0].length >= 5) add(core); // single strong brand
  // Drop too-short/too-generic hosts.
  return [...sets].filter((h) => h.replace(/-/g, "").length >= 5);
}

function urlCandidates(name) {
  const urls = [];
  for (const host of candidateHosts(name)) {
    for (const tld of TLDS) {
      urls.push(`https://${host}.${tld}`);
      urls.push(`https://www.${host}.${tld}`);
    }
  }
  return urls;
}

async function fetchHtml(url) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      redirect: "follow",
      headers: { "User-Agent": "citoviso-presence-probe/0.1" },
    });
    if (!res.ok || !res.body) return null;
    const reader = res.body.getReader();
    const chunks = [];
    let size = 0;
    while (size < MAX_BYTES) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      size += value.length;
    }
    await reader.cancel().catch(() => {});
    return { finalUrl: res.url, html: Buffer.concat(chunks).toString("utf8") };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function verify(name, html) {
  const text = deaccent(html.toLowerCase());
  if (PARKED.some((p) => text.includes(deaccent(p)))) return { ok: false, why: "parked" };
  const core = tokens(name).filter((w) => !TYPE_WORDS.has(w));
  const brandHit = core.some((w) => w.length >= 4 && text.includes(w));
  const regionHit = text.includes(REGION_TERM);
  // Region confirmation is MANDATORY: brand-only matches are name collisions
  // with unrelated businesses elsewhere and must NOT count as a found site.
  if (brandHit && regionHit) return { ok: true, conf: "high", why: "brand+region" };
  if (brandHit) return { ok: false, why: "brand-only-collision" };
  return { ok: false, why: "no-match" };
}

async function probeLead(lead) {
  const urls = urlCandidates(lead.name);
  const rejected = [];
  for (const url of urls) {
    const r = await fetchHtml(url);
    if (!r) continue;
    const v = verify(lead.name, r.html);
    if (v.ok) {
      return { name: lead.name, status: lead.websiteStatus, found: r.finalUrl, tried: url, ...v };
    }
    rejected.push(`${r.finalUrl} (${v.why})`); // reachable but not confirmed
  }
  return { name: lead.name, status: lead.websiteStatus, found: null, tried: urls.length, rejected };
}

const leads = JSON.parse(await readFile("./leads-badacsony.json", "utf8"));
const targets = leads.filter(
  (l) => l.websiteStatus === "none" || l.websiteStatus === "portal_only",
);

const results = [];
let next = 0;
async function worker() {
  while (next < targets.length) results.push(await probeLead(targets[next++]));
}
await Promise.all(Array.from({ length: Math.min(CONCURRENCY, targets.length) }, worker));

results.sort((a, b) => a.name.localeCompare(b.name, "hu"));
console.log("\n=== PRESENCE PROBE — állítólag 'nincs honlap' leadek ===\n");
let hits = 0;
for (const r of results) {
  if (r.found) {
    hits++;
    console.log(`✅ ${r.name}  [${r.status}]  → ${r.found}  (${r.conf}, ${r.why})`);
  } else {
    console.log(`❌ ${r.name}  [${r.status}]  → nincs megerősített saját honlap (${r.tried} jelölt)`);
    for (const rej of r.rejected) console.log(`      elutasítva: ${rej}`);
  }
}
console.log(`\nÖsszes cél: ${results.length} | Talált saját honlap: ${hits} | Valóban nincs: ${results.length - hits}`);
