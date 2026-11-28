/**
 * SAJÁT-OLDAL ÚJRAELLENŐRZÉS — a leadhez már kiírt „saját honlap” képtársítások (portalProfiles, portal "own_site")
 * újraolvasása a mai identitás-szabállyal (ADR-XXXX, 2026-11-28), és a már nem igazolhatók levétele, mentéssel.
 *
 * MIÉRT: a saját-oldal igazolás egy turisztikai oldalt is elfogadott, ha a domain a lead nevének egy szavát viselte,
 * és az oldalon ott volt a település. Földrajzi nevű leadnél ez helynév: „Insel Brac” ↔ bracinfo.com/de/sutivan,
 * 17 kép; „Villa Lapis Hvar” ↔ hvar.com/hvar-beaches/dubovica. A rossz kép rosszabb a hiányzónál
 * (koordinátor 2026-11-28).
 *
 * MIT CSINÁL: minden kiválasztott lead minden own_site profilját újraolvassa ugyanazzal a függvénnyel, amit a
 * photo-links hív (readOwnSitePhotos). Ha az oldal ma nem igazolja a leadet, a profilt leveszi, és a material-t
 * újraszámolja. A leadnél TÁROLT honlap profilja érinthetetlen. Olvasási hiba (időtúllépés, 5xx) → marad, csak jelzi.
 *
 *   npx tsx scripts/own-site-recheck.mts --country HR                # DRY-RUN: mit venne le
 *   npx tsx scripts/own-site-recheck.mts --country HR --go           # levesz, mentéssel
 *   … --file ids.txt                                                 # csak ezek a leadek (soronként egy id)
 * Mentés (--go): <CIT_BACKUP_DIR | /opt/citoviso/backups | ./backups>/own-site-recheck-<ts>.jsonl — leadenként a teljes
 * előző portalProfiles + material; visszaállítás: a sor `before` mezőit vissza kell írni a lead raw-jába.
 */
import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { sql } from "kysely";

import { db } from "../src/db/client.js";
import { OWN_SITE_UNPROVEN, ownSitePlaceRule, readOwnSitePhotos, sameStoredSite } from "../src/scraper/attachPhotoLinks.js";
import { buildMaterial } from "../src/scraper/enrichMaterial.js";
import { getRegion, loadRegions } from "../src/scraper/regions.js";
import type { PortalProfile, QualifiedLead } from "../src/scraper/types.js";

const GO = process.argv.includes("--go");
const arg = (k: string): string | undefined => (process.argv.includes(k) ? process.argv[process.argv.indexOf(k) + 1] : undefined);
const COUNTRY = arg("--country")?.toUpperCase();
const FILE = arg("--file");
if (!COUNTRY && !FILE) {
  console.error("usage: npx tsx scripts/own-site-recheck.mts (--country HR | --file ids.txt) [--go]"); // i18n-exempt: operator CLI
  process.exit(2);
}
const ids = FILE ? readFileSync(FILE, "utf8").split(/\s+/).filter((x) => /^[0-9a-f-]{36}$/i.test(x)) : null;

let q = db
  .selectFrom("lead")
  .select(["id", "raw"])
  .where(sql<boolean>`exists (select 1 from jsonb_array_elements(case when jsonb_typeof(raw->'portalProfiles')='array' then raw->'portalProfiles' else '[]' end) p where p->>'portal' = 'own_site')`);
if (ids) q = q.where("id", "in", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);
if (COUNTRY) q = q.where(sql<boolean>`upper(coalesce(raw->>'country','')) = ${COUNTRY}`);
const rows = await q.execute();

await loadRegions(true);
const dir = process.env.CIT_BACKUP_DIR ?? (existsSync("/opt/citoviso/backups") ? "/opt/citoviso/backups" : path.resolve("backups"));
const backup = path.join(dir, `own-site-recheck-${new Date().toISOString().replace(/[:.]/g, "").slice(0, 15)}.jsonl`);
const tally = { leads: rows.length, profiles: 0, kept: 0, removed: 0, readError: 0, stored: 0, photosRemoved: 0 };
for (const row of rows) {
  const lead = (typeof row.raw === "string" ? JSON.parse(row.raw) : row.raw) as QualifiedLead;
  let region;
  try { region = getRegion(lead.region); } catch { continue; }
  const drop: PortalProfile[] = [];
  for (const p of lead.portalProfiles ?? []) {
    if (p.portal !== "own_site") continue;
    tally.profiles++;
    if (lead.website && sameStoredSite(lead.website, p.url)) { tally.stored++; continue; }
    // Only what THIS rule changed is taken off: a profile the place rule does not touch stays, whatever a re-read says
    // today (a page that changed is no reason to undo an earlier, valid decision).
    const rule = ownSitePlaceRule(lead, p.url, p.url, (lead.country ?? "").toUpperCase() || null);
    if (!rule.hardOnly) { tally.kept++; continue; }
    const r = await readOwnSitePhotos(p.url, lead, region).catch((e: Error) => ({ skipped: `hiba: ${e.message}` }) as { profile?: PortalProfile; skipped?: string });
    if (r.profile) { tally.kept++; continue; }
    // Only the identity verdict removes; a page that could not be read keeps its profile (not a fact about the lead).
    if (r.skipped !== OWN_SITE_UNPROVEN && !/csupa általános szó/.test(r.skipped ?? "")) { tally.readError++; console.log(`  marad (olvasási hiba)  ${row.id}  ${p.url}  ${r.skipped ?? ""}`); continue; } // i18n-exempt: operator log
    console.log(`  ok: ${rule.why}`); // i18n-exempt: operator log
    drop.push(p);
  }
  if (!drop.length) continue;
  tally.removed += drop.length;
  tally.photosRemoved += drop.reduce((n, p) => n + p.photos.length, 0);
  for (const p of drop) console.log(`${GO ? "levéve" : "levenné"}  ${row.id}  ${lead.name}  ${p.url}  (${p.photos.length} kép)`); // i18n-exempt: operator log
  if (!GO) continue;
  mkdirSync(dir, { recursive: true });
  appendFileSync(backup, JSON.stringify({ lead: row.id, at: new Date().toISOString(), removed: drop.map((p) => p.url), before: { portalProfiles: lead.portalProfiles, material: lead.material } }) + "\n");
  const keep = (lead.portalProfiles ?? []).filter((p) => !drop.includes(p));
  const after: QualifiedLead = { ...lead, portalProfiles: keep };
  const material = buildMaterial(after, lead.material?.streetView ?? false);
  await db
    .updateTable("lead")
    .set({
      raw: sql`jsonb_set(jsonb_set(raw, '{portalProfiles}', ${JSON.stringify(keep)}::jsonb), '{material}',
        coalesce(case when jsonb_typeof(raw->'material') = 'object' then raw->'material' end, '{}'::jsonb) || ${JSON.stringify(material)}::jsonb)` as never,
    })
    .where("id", "=", row.id)
    .execute();
}
console.log(
  `${GO ? "KÉSZ" : "DRY-RUN"} — lead: ${tally.leads}, own_site profil: ${tally.profiles} (tárolt honlap, érintetlen: ${tally.stored}), ` + // i18n-exempt: operator log
    `marad: ${tally.kept}, ${GO ? "levéve" : "levenné"}: ${tally.removed} (${tally.photosRemoved} kép), olvasási hiba miatt marad: ${tally.readError}` +
    (GO && tally.removed ? ` · mentés: ${backup}` : ""),
);
await db.destroy();
