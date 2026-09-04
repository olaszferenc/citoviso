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

// Strongest active no_site lead by real photo material.
const candidates = await db
  .selectFrom("lead")
  .selectAll()
  .where("qualification", "=", "no_site")
  .where("lifecycle_status", "=", "qualified")
  .execute();
const scored = candidates
  .map((l) => {
    const raw = (l.raw ?? {}) as { material?: { placesPhotos?: number }; photoCount?: number };
    return { l, photos: raw.material?.placesPhotos ?? raw.photoCount ?? 0 };
  })
  .sort((a, b) => b.photos - a.photos);
const src = scored[0];
if (!src || src.photos < 3) {
  console.error("nincs elég fotós no_site forrás-lead a klónhoz");
  process.exit(1);
}

// Deep rewrite: original name → ELEK-TESZT name in every string; *mail* keys →
// Elek's address. URLs are left alone (the exact spaced name does not occur in
// them; replace is string-exact).
function rewrite(value: unknown, origName: string): unknown {
  if (typeof value === "string") {
    return value.split(origName).join(ELEK_NAME);
  }
  if (Array.isArray(value)) return value.map((v) => rewrite(v, origName));
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      if (/mail/i.test(k) && typeof v === "string" && v.includes("@")) {
        out[k] = ELEK_EMAIL;
      } else if (/mail/i.test(k) && Array.isArray(v)) {
        out[k] = [ELEK_EMAIL];
      } else {
        out[k] = rewrite(v, origName);
      }
    }
    return out;
  }
  return value;
}

const newRaw = rewrite(src.l.raw ?? {}, src.l.name) as object;
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
console.log(`  forrás-klón: "${src.l.name}" (${src.photos} fotó) — név/email átírva`);
console.log(`  kontakt: ${ELEK_EMAIL}`);
process.exit(0);
