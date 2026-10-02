// Re-apply TODAY's website rules to the stored lead stock.
// Usage: npx tsx scripts/requalify-websites.mts [--apply]
//   (no flag = DRY-RUN; on prod `--apply` is a live write → owner permission, §0)
//
// WHY: the portal catalogue grew all through 2026-08-19/20 (each new region
// surfaced more listing hosts, ADR-0037). Leads scraped BEFORE a host was known
// kept the verdict made under the old rules — so a lead whose only "website" is
// an apartman.hu / hungaryhotel.net / lake-balaton.com listing page still sits
// there as `modern`, i.e. "has a modern site, not a target". That is the FALSE
// NEGATIVE direction of the §F credibility bug: we silently drop a real
// customer instead of contacting them.
//
// Deterministic and offline: no search, no fetch, no API cost — it only re-runs
// classifyWebsite() over what is already stored. The assessment block is dropped
// when the site turns out to be a portal, because it describes that portal page
// (its "outdated" verdict says nothing about a business with no site at all).
//
// Only pre-outreach leads are rewritten; anything already contacted is listed
// for the operator instead of being silently requalified.
//
// The outreach letter reads prospect.segment — a COPY of the qualification taken
// when the tracked link was created (segmentFromQualification). Requalifying the
// lead alone would leave such a link saying "we looked at your current site" to a
// lead that has none (A1, 2026-10-02). So a not-yet-sent prospect whose segment is
// still the AUTO value of the old qualification follows the lead; a segment the
// operator chose by hand, or one already sent, is left alone.

import { sql } from "kysely";
import { db } from "../src/db/client.js";
import {
  classifyWebsite,
  isMvpLead,
  isShortLink,
  sharedHostCandidates,
} from "../src/scraper/qualify.js";
import { qualificationOf } from "../src/scraper/persist.js";
import { segmentFromQualification } from "../src/console/data.js";
import type { QualifiedLead } from "../src/scraper/types.js";

// Unknown flags fail loudly: a near-miss (`--aply`, `--dry`) must never silently
// pick a mode the operator did not ask for.
const args = process.argv.slice(2);
const unknown = args.filter((a) => a !== "--apply");
if (unknown.length) {
  console.error(`Ismeretlen kapcsoló: ${unknown.join(" ")} — használat: [--apply]`);
  process.exit(2);
}
const apply = args.includes("--apply");
const UPDATABLE = ["qualified", "mock_curation"];

const rows = await db
  .selectFrom("lead")
  .select(["id", "name", "qualification", "lifecycle_status", "raw"])
  .where("lifecycle_status", "not in", ["terminated", "disqualified"])
  .execute();

let changed = 0;
let skipped = 0;
let prospectsFollowed = 0;
const lines: string[] = [];
// "from → to" and per-host tallies: the operator approves numbers, not a scroll.
const transitions = new Map<string, number>();
const hosts = new Map<string, number>();
const tally = (m: Map<string, number>, k: string) => m.set(k, (m.get(k) ?? 0) + 1);
const hostOf = (url: string): string => {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "(nem URL)";
  }
};

/**
 * Follow a short link's redirects (no body, at most 5 hops) to the page it really
 * opens: tinyurl.com/3fzd2tet → redirect.viglink.com → admin.booking.com (measured
 * 2026-10-02). Unresolvable → null, and the link keeps its host verdict.
 */
async function resolveShortLink(url: string): Promise<string | null> {
  let cur = url;
  for (let hop = 0; hop < 5 && isShortLink(cur); hop++) {
    try {
      const res = await fetch(cur, { method: "HEAD", redirect: "manual", signal: AbortSignal.timeout(10_000) });
      const loc = res.headers.get("location");
      if (!loc) return null;
      cur = new URL(loc, cur).toString();
    } catch {
      return null;
    }
  }
  return isShortLink(cur) ? null : cur;
}

const resolvedLines: string[] = [];
for (const r of rows) {
  const raw = (typeof r.raw === "string" ? JSON.parse(r.raw) : r.raw) as QualifiedLead;
  if (!raw.website) continue;
  let verdictUrl = raw.website;
  if (isShortLink(raw.website)) {
    const target = await resolveShortLink(raw.website);
    resolvedLines.push(`  ${r.name}: ${raw.website} → ${target ?? "(nem oldható fel — a host szerint marad)"}`);
    if (target) verdictUrl = target;
  }
  const status = classifyWebsite(verdictUrl);
  if (status === raw.websiteStatus) continue; // verdict unchanged

  const next: QualifiedLead = { ...raw, websiteStatus: status };
  if (status !== "has_own") {
    // The assessment measured a portal page — it cannot speak for this business.
    delete (next as { assessment?: unknown }).assessment;
  }
  (next as { isLead?: boolean }).isLead =
    isMvpLead(status) || Boolean(next.assessment?.outdated);
  const q = qualificationOf(next);
  tally(transitions, `${r.qualification} → ${q}${UPDATABLE.includes(r.lifecycle_status) ? "" : " (KÉZI)"}`);
  tally(hosts, hostOf(raw.website).split(".").slice(-2).join("."));

  if (!UPDATABLE.includes(r.lifecycle_status)) {
    skipped++;
    lines.push(`  ⚠️ KÉZI  ${r.name} (${r.lifecycle_status}): ${r.qualification} → ${q}`);
    continue;
  }
  lines.push(
    `  ${r.qualification.padEnd(8)} → ${q.padEnd(8)} ${r.name} · ${raw.website.slice(0, 52)}`,
  );
  changed++;
  const autoOld = segmentFromQualification(r.qualification);
  const autoNew = segmentFromQualification(q);
  const followQuery = db
    .selectFrom("prospect")
    .select("id")
    .where("lead_id", "=", r.id)
    .where("sent_at", "is", null)
    .where("segment", "=", autoOld);
  const follow = autoOld === autoNew ? [] : await followQuery.execute();
  prospectsFollowed += follow.length;
  if (!apply) continue;
  await db.transaction().execute(async (tx) => {
    await tx
      .updateTable("lead")
      .set({ raw: sql`${JSON.stringify(next)}::jsonb`, qualification: q })
      .where("id", "=", r.id)
      .execute();
    if (follow.length) {
      await tx
        .updateTable("prospect")
        .set({ segment: autoNew })
        .where("id", "in", follow.map((f) => f.id))
        .execute();
    }
  });
}

console.log(
  `Honlap-újraminősítés a mai szabályokkal — ${apply ? "ÉLES ÍRÁS" : "DRY-RUN (--apply írna)"}\n`,
);
console.log(lines.length ? lines.join("\n") : "  (nincs eltérés)");
console.log(
  `\n${changed} lead ${apply ? "átminősítve" : "átminősítendő"}` +
    (skipped ? ` · ${skipped} outreach után — kézi átnézésre jelölve` : "") +
    ` · ${prospectsFollowed} ki nem küldött link szegmense ${apply ? "követte" : "követné"} a leadet`,
);
if (resolvedLines.length) {
  console.log("\nRövidített linkek (a célhost szerint sorolva):");
  console.log(resolvedLines.join("\n"));
}
// RULE A candidates (qualify.ts): hosts several DIFFERENT businesses reach without
// their name in the host. Listed for a rule-B check (front page), NEVER auto-applied —
// measured, about a third of them are a chain's or a multi-unit owner's own site.
const stock = rows.map((r) => {
  const raw = (typeof r.raw === "string" ? JSON.parse(r.raw) : r.raw) as QualifiedLead;
  return { name: r.name, website: raw.website };
});
const candidates = [...sharedHostCandidates(stock)].filter(
  (h) => classifyWebsite(`https://${h}/`) === "has_own",
);
if (candidates.length) {
  console.log(
    `\nA-szabály jelöltjei (${candidates.length} host, ≥2 különböző szállás, nevük nincs a hostban) — ` +
      "a nyitólap (B-szabály) dönt, a mért verdikt a qualify.ts listájába kerül:",
  );
  console.log("  " + candidates.sort().join(" · "));
}
if (transitions.size) {
  const sorted = (m: Map<string, number>) => [...m].sort((a, b) => b[1] - a[1]);
  console.log("\nÁtmenetek (régi → új szegmens):");
  for (const [k, v] of sorted(transitions)) console.log(`  ${String(v).padStart(5)}  ${k}`);
  console.log("\nHostok szerint:");
  console.log("  " + sorted(hosts).map(([k, v]) => `${k} ${v}`).join(" · "));
}
process.exit(0);
