// Seed the ELEK-TESZT lead (ADR-0095, SCOPE.md előfeltétel) — DEV-SESSION tool,
// never run by Elek himself (his charter forbids DB writes; setup is ours).
//
// Strategy: CLONE the strongest real no_site lead so every raw field the mock
// pipeline expects is present and consistent, then (a) rename to the ELEK-TESZT
// prefix everywhere in raw, (b) rewrite every *mail* field to Elek's own
// address. Even if an email field slips through, the ElekRecipientGuard refuses
// non-elek recipients at the transport — the seed cannot make sends dangerous.
//
//   npx tsx scripts/seed-elek-lead.mts

import { randomUUID } from "node:crypto";
import { db } from "../src/db/client.js";

const ELEK_NAME = "ELEK-TESZT Vendégház";
const ELEK_EMAIL = "elek@citoviso.com";

const existing = await db
  .selectFrom("lead")
  .select("id")
  .where("name", "=", ELEK_NAME)
  .executeTakeFirst();
if (existing) {
  console.log(`már létezik: ${ELEK_NAME} (${existing.id}) — nem duplikálok`);
  process.exit(0);
}

// Strongest active no_site lead — measured 2026-09-04: photo count alone picked a
// portal_only lead with NO high-band portal profile, so the marketing guard
// (rightly) flagged the generated mock as data-poor and the send gate blocked it.
// Elek's send loop needs a mock that can PASS the guards, so the clone source must
// carry verified amenities: score = high-band amenities (dominant) + photos.
const candidates = await db
  .selectFrom("lead")
  .selectAll()
  .where("qualification", "=", "no_site")
  .where("lifecycle_status", "=", "qualified")
  .execute();
interface RawProfile {
  matchBand?: string;
  amenities?: unknown[];
  photos?: unknown[];
}
const scored = candidates
  .map((l) => {
    const raw = (l.raw ?? {}) as {
      material?: { placesPhotos?: number };
      photoCount?: number;
      portalProfiles?: RawProfile[];
    };
    const high = (raw.portalProfiles ?? []).filter((p) => p.matchBand === "high");
    const amenities = high.reduce((n, p) => n + (p.amenities?.length ?? 0), 0);
    const photos =
      high.reduce((n, p) => n + (p.photos?.length ?? 0), 0) +
      (raw.material?.placesPhotos ?? raw.photoCount ?? 0);
    return { l, amenities, photos, score: amenities * 10 + photos };
  })
  .sort((a, b) => b.score - a.score);
const src = scored[0];
if (!src || src.photos < 3 || src.amenities < 5) {
  console.error("nincs high-band profilos, fotós no_site forrás-lead a klónhoz");
  process.exit(1);
}

// Deep rewrite: original name → ELEK-TESZT name in every string; *mail* keys →
// Elek's address. URLs are left alone (the exact spaced name does not occur in
// them; replace is string-exact).
function rewrite(value: unknown, origName: string): unknown {
  if (typeof value === "string") {
    return value.split(origName).join(ELEK_NAME);
  }
  // The contacts array stores identity in a {kind, value} SHAPE, not in the key
  // name — the key-based email/phone rewrite was blind to it, and a real third
  // party's email survived one seed (measured 2026-09-05). Shape-aware guard.
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const kv = value as { kind?: unknown; value?: unknown };
    if (kv.kind === "email" && typeof kv.value === "string") {
      return { ...(value as object), value: ELEK_EMAIL };
    }
    if (kv.kind === "phone" && typeof kv.value === "string") {
      return { ...(value as object), value: "" };
    }
  }
  if (Array.isArray(value)) return value.map((v) => rewrite(v, origName));
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      if (/mail/i.test(k) && typeof v === "string" && v.includes("@")) {
        out[k] = ELEK_EMAIL;
      } else if (/mail/i.test(k) && Array.isArray(v)) {
        out[k] = [ELEK_EMAIL];
      } else if (/phone|telefon/i.test(k)) {
        // The clone must NOT carry the source's real phone number: on the main
        // :4600 console (no ELEK_RUN guard) the mobile-pair button would fire a
        // REAL MMS/SMS at a stranger from the machine's SIM (Elek GYANÚ,
        // FK-004). No phone → the mobile card correctly shows "not sendable".
        out[k] = typeof v === "string" ? "" : v == null ? v : Array.isArray(v) ? [] : v;
      } else {
        out[k] = rewrite(v, origName);
      }
    }
    return out;
  }
  return value;
}

const newRaw = rewrite(src.l.raw ?? {}, src.l.name) as {
  portalProfiles?: { matchBand?: string; photos?: { vouched?: boolean }[] }[];
};
// Legacy-scraped photos predate the `vouched` flag the CURRENT ingest stamps on
// high-band listings — without it the render-time photo gate applies the strict
// 800px floor and drops every 500px portal derivative, so the mock generated
// with ZERO photos (measured 2026-09-05). Same rule, applied to the clone.
for (const p of newRaw.portalProfiles ?? []) {
  if (p.matchBand === "high") {
    for (const photo of p.photos ?? []) photo.vouched = true;
  }
}
const id = randomUUID();
await db
  .insertInto("lead")
  .values({
    id,
    scrape_run_id: src.l.scrape_run_id,
    name: ELEK_NAME,
    lat: src.l.lat,
    lng: src.l.lng,
    address: src.l.address,
    category: src.l.category,
    qualification: src.l.qualification,
    weight: src.l.weight,
    match_confidence: src.l.match_confidence,
    raw: JSON.stringify(newRaw),
    lifecycle_status: src.l.lifecycle_status,
  })
  .execute();

console.log(`ELEK-TESZT lead létrehozva: ${id}`);
console.log(
  `  forrás-klón: "${src.l.name}" (${src.amenities} igazolt szolgáltatás · ${src.photos} fotó) — név/email átírva`,
);
console.log(`  kontakt: ${ELEK_EMAIL}`);
process.exit(0);
