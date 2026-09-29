// One-off repair for leads matched BEFORE ADR-0258: their medium-band Places match
// wrote the matched place's phone (and website) straight onto the lead, and the
// place name was never stored — so a neighbour's contact cannot be told from the
// lead's own without asking Places again.
//
// Per lead (medium band, lifecycle 'qualified' only — anything further along is a
// live conversation or a customer, and its data is not ours to rewrite silently):
//   1. re-ask Places with the SAME request the lookup uses;
//   2. reconstruct which place the OLD picker chose (any shared word > 3 letters)
//      and which one the NEW picker chooses (brand words, own town excluded);
//   3. CONFIRMED  — the new rule (brand similarity + place type + distance, calibrated
//                   in places-match-check ⑨) picks the same place as HIGH: keep.
//      DEMOTED    — otherwise, and only for the contact that IS the old pick's
//                   (phone equal by number / website equal by host): it leaves the
//                   lead and stays in the ledger as a REJECTED row with the reason.
//                   A phone/website that differs from the old pick came from
//                   elsewhere (curator, test prep, own site) and is not touched.
//   4. the evidence is recorded on every processed lead (raw.placesMatch).
//
// Dry-run by default. --apply writes, after saving every touched row's raw to
// --backup <file> (required with --apply). --cache <file> keeps the Places answers
// (read if present, written if not) so a dry run and the apply pay only once.
//
// Usage: npx tsx scripts/places-medium-backfill.mts [--apply --backup <file>] [--cache <file>] [--limit N]

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { sql } from "kysely";
import { config } from "../src/config.js";
import { db } from "../src/db/client.js";
import { scoreMatch } from "../src/scraper/confidence.js";
import { phoneKey } from "../src/scraper/contactLedger.js";
import { resolveChannel } from "../src/scraper/enrichContact.js";
import { qualificationOf } from "../src/scraper/persist.js";
import { classifyWebsite, isMvpLead } from "../src/scraper/qualify.js";
import {
  LOOKUP_BOX_DEG,
  nameSimilarity,
  pickPlacesCandidate,
  placeKindOf,
  placesSearchText,
} from "../src/scraper/sources/googleMaps.js";
import type { ContactCandidate, QualifiedLead } from "../src/scraper/types.js";

const args = process.argv.slice(2);
const APPLY = args.includes("--apply");
const backupAt = args.indexOf("--backup");
const BACKUP = backupAt >= 0 ? args[backupAt + 1] : undefined;
const limitAt = args.indexOf("--limit");
const LIMIT = limitAt >= 0 ? Number(args[limitAt + 1]) : Infinity;
const cacheAt = args.indexOf("--cache");
const CACHE = cacheAt >= 0 ? args[cacheAt + 1] : undefined;
const cache = new Map<string, Place[]>(
  CACHE && existsSync(CACHE)
    ? (JSON.parse(readFileSync(CACHE, "utf8")) as { id: string; places: Place[] }[]).map((c) => [c.id, c.places])
    : [],
);
if (APPLY && !BACKUP) {
  console.error("--apply mellé kötelező a --backup <fájl> (a módosított sorok eredeti raw-ja)");
  process.exit(2);
}
if (!config.googleMapsApiKey) {
  console.error("nincs GOOGLE_MAPS_API_KEY — a Places nem kérdezhető");
  process.exit(2);
}

type Place = {
  id?: string;
  displayName?: { text?: string };
  location?: { latitude: number; longitude: number };
  nationalPhoneNumber?: string;
  websiteUri?: string;
  types?: string[];
};

function norm(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
}
function metres(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const R = 6371000;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLon = ((bLon - aLon) * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((aLat * Math.PI) / 180) * Math.cos((bLat * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
/** The picker as it was before ADR-0258 — reproduced ONLY to learn what it chose then. */
function oldPick(name: string, lat: number, lon: number, places: readonly Place[]): Place | undefined {
  const toks = norm(name).split(" ").filter((t) => t.length > 3);
  let best: Place | undefined;
  let bestD = Infinity;
  for (const p of places) {
    if (!p.location) continue;
    const d = metres(lat, lon, p.location.latitude, p.location.longitude);
    if (d >= bestD) continue;
    const cand = norm(p.displayName?.text ?? "");
    if (toks.length && !toks.some((t) => cand.includes(t))) continue;
    best = p;
    bestD = d;
  }
  return best;
}
function host(u?: string): string | undefined {
  if (!u) return undefined;
  try {
    return new URL(u).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return undefined;
  }
}
const samePhone = (a?: string, b?: string) => Boolean(a && b && phoneKey(a) === phoneKey(b));

const rows = await db
  .selectFrom("lead")
  .select(["id", "name", "lat", "lng", "raw"])
  .where("lifecycle_status", "=", "qualified")
  .where(sql<boolean>`(raw->>'matchConfidence')::float >= 0.45 and (raw->>'matchConfidence')::float < 0.7`)
  .where("lat", "is not", null)
  .orderBy("name")
  .execute();

console.log(`${APPLY ? "ÍRÁS" : "SZÁRAZ FUTÁS"} — ${rows.length} közepes sávú, qualified lead\n`);

const backup: { id: string; raw: unknown }[] = [];
const tally = { confirmed: 0, demotedPhone: 0, demotedSite: 0, untouched: 0, nomatch: 0, failed: 0 };
let n = 0;
for (const r of rows) {
  if (n++ >= LIMIT) break;
  const raw = (typeof r.raw === "string" ? JSON.parse(r.raw) : r.raw) as QualifiedLead & Record<string, unknown>;
  const lat = r.lat!;
  const lon = r.lng!;
  let places: Place[];
  try {
    const cached = cache.get(r.id);
    if (cached) {
      places = cached;
    } else {
    const data = await placesSearchText(
      {
        textQuery: r.name,
        locationRestriction: {
          rectangle: {
            low: { latitude: lat - LOOKUP_BOX_DEG, longitude: lon - LOOKUP_BOX_DEG },
            high: { latitude: lat + LOOKUP_BOX_DEG, longitude: lon + LOOKUP_BOX_DEG },
          },
        },
        maxResultCount: 5,
      },
      config.googleMapsApiKey,
      "places.id,places.displayName,places.location,places.types,places.nationalPhoneNumber,places.websiteUri",
    );
    places = (data.places ?? []) as Place[];
    cache.set(r.id, places);
    }
  } catch (e) {
    tally.failed++;
    console.log(`  ⚠ ${r.name}: a Places nem válaszolt (${(e as Error).message}) — kihagyva`);
    continue;
  }

  const old = oldPick(r.name, lat, lon, places);
  const neu = pickPlacesCandidate(r.name, lat, lon, places, raw.city);
  const neuName = neu?.place.displayName?.text ?? "";
  const conf = neu
    ? scoreMatch({
        distanceMeters: neu.distanceMeters,
        nameSimilarity: nameSimilarity(r.name, neuName, raw.city),
        corroboratedByOsm: (raw.sources ?? []).includes("osm"),
        placeKind: placeKindOf(neu.place.types),
      })
    : undefined;
  const confirmed = Boolean(neu && old && neu.place.id === old.id && conf?.band === "high");

  const oldName = old?.displayName?.text ?? "—";
  const oldDist = old?.location ? Math.round(metres(lat, lon, old.location.latitude, old.location.longitude)) : undefined;
  const phoneIsOld = samePhone(raw.phone, old?.nationalPhoneNumber);
  const siteIsOld = Boolean(host(raw.website) && host(raw.website) === host(old?.websiteUri));

  const evidence = {
    placeName: neu ? neuName : oldName,
    distanceMeters: Math.round(neu ? neu.distanceMeters : (oldDist ?? 0)),
    nameSimilarity: Number(nameSimilarity(r.name, neu ? neuName : oldName, raw.city).toFixed(2)),
    band: conf?.band ?? ("low" as const),
    backfill: "2026-09-28 (ADR-0258)",
  };

  if (!old) {
    tally.nomatch++;
    console.log(`  · ${r.name}: ma már nincs régi-szabályú találat sem — nem nyúlok hozzá`);
    continue;
  }
  if (confirmed) {
    tally.confirmed++;
    console.log(`  ✓ ${r.name} ⇐ „${oldName}” ${oldDist} m — az új szabály is ezt adja, magas (${conf!.score.toFixed(2)}) → marad`);
    if (APPLY) {
      backup.push({ id: r.id, raw });
      await db.updateTable("lead").set({ raw: sql`${JSON.stringify({ ...raw, matchConfidence: conf!.score, placesMatch: evidence })}::jsonb` }).where("id", "=", r.id).execute();
    }
    continue;
  }
  if (!phoneIsOld && !siteIsOld) {
    tally.untouched++;
    console.log(`  · ${r.name} ⇐ „${oldName}” ${oldDist ?? "?"} m — a lead elérhetősége nem ettől a helytől van → nem nyúlok hozzá`);
    continue;
  }

  const why =
    `közepes Places-egyezésből jött („${oldName}”, ${oldDist ?? "?"} m) — a szomszédé is lehet, ` +
    `ellenőrizd, mielőtt átveszed (visszamenőleges rendezés, ADR-0258)`;
  let contacts: ContactCandidate[] = [...(raw.contacts ?? [])];
  let phone = raw.phone;
  let website = raw.website;
  let email = raw.email;
  const held: { heldPhone?: string; heldWebsite?: string } = {};

  if (phoneIsOld) {
    tally.demotedPhone++;
    held.heldPhone = raw.phone;
    const hasRow = contacts.some((c) => c.kind === "phone" && samePhone(c.value, raw.phone));
    contacts = contacts.map((c) =>
      c.kind === "phone" && samePhone(c.value, raw.phone) ? { ...c, accepted: false, rejectedReason: why } : c,
    );
    if (!hasRow) contacts.push({ kind: "phone", value: raw.phone!, source: "places", accepted: false, rejectedReason: why, firstSeen: new Date().toISOString().slice(0, 10) });
    phone = contacts.find((c) => c.kind === "phone" && c.accepted)?.value;
  }
  if (siteIsOld) {
    tally.demotedSite++;
    held.heldWebsite = raw.website;
    website = undefined;
    // Addresses read OFF that website inherit its doubt.
    contacts = contacts.map((c) =>
      c.kind === "email" && c.source === "own_site" && c.accepted
        ? { ...c, accepted: false, rejectedReason: `a honlapról olvastuk, ami ${why}` }
        : c,
    );
    if (email && !contacts.some((c) => c.kind === "email" && c.accepted && c.value.trim().toLowerCase() === email!.trim().toLowerCase())) {
      email = contacts.find((c) => c.kind === "email" && c.accepted)?.value;
    }
  }
  const websiteStatus = website ? raw.websiteStatus : classifyWebsite(undefined);
  const next: QualifiedLead = {
    ...raw,
    phone,
    website,
    email,
    websiteStatus,
    isLead: isMvpLead(websiteStatus),
    contactChannel: resolveChannel(email, phone),
    contacts,
    placesMatch: { ...evidence, ...held },
  } as QualifiedLead;
  console.log(
    `  ⚠ ${r.name} ⇐ „${oldName}” ${oldDist ?? "?"} m (új szabály: ${neu ? `„${neuName}” ${conf!.band}` : "nincs találat"})` +
      ` → le: ${phoneIsOld ? `telefon ${raw.phone}` : ""}${phoneIsOld && siteIsOld ? " + " : ""}${siteIsOld ? `honlap ${host(raw.website)}` : ""}` +
      `${phone ? ` · marad: ${phone}` : ""}${raw.email !== email ? ` · e-mail: ${raw.email ?? "—"} → ${email ?? "—"}` : ""}`,
  );
  if (APPLY) {
    backup.push({ id: r.id, raw });
    await db
      .updateTable("lead")
      .set({ raw: sql`${JSON.stringify(next)}::jsonb`, qualification: qualificationOf(next) })
      .where("id", "=", r.id)
      .execute();
  }
}

if (APPLY && BACKUP) writeFileSync(BACKUP, JSON.stringify(backup, null, 1));
if (CACHE) writeFileSync(CACHE, JSON.stringify([...cache].map(([id, places]) => ({ id, places }))));
console.log(
  `\nmegerősítve ${tally.confirmed} · telefon le ${tally.demotedPhone} · honlap le ${tally.demotedSite} · ` +
    `nem innen való, érintetlen ${tally.untouched} · régi találat sincs ${tally.nomatch} · Places-hiba ${tally.failed}` +
    (APPLY ? `\nmentés: ${BACKUP} (${backup.length} sor)` : "\n(száraz futás — semmi nem íródott)"),
);
await db.destroy();
