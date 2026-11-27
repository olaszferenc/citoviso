/**
 * MAPS-KÁRTYA FOTÓ → LEAD — the photo the scout READ off a place's own Google Maps card goes onto
 * the lead as its stored Places answer (`lead_places_cache`, via "maps_card"), at $0.
 *
 * MIÉRT (koordinátor 2026-11-27, HR lead-képek): élesen a 354 e-mailes HR leadből egynek sincs
 * Places-fotója (a Places-fotó API fizetős, ADR-0413), pedig a felderítő a lánc elején MINDEN szállás
 * Maps-kártyáját megnyitja. Bejelentkezés nélkül a Google „korlátozott nézetet” ad (mérve 2026-11-27:
 * a kártya galériája nem nyílik, a „Fotografije” sávban csak a Street View), így a kártyáról a
 * NYITÓKÉP olvasható: kártyánként legfeljebb egy kép. A felderítő (maps_crawl.mjs) ezt jegyzi fel,
 * ez a szkript teszi a leadre.
 *
 * Bemenet (fájl vagy stdin, TSV): `<lead_id> \t <kép-URL> \t <owner|guest>` — soronként egy kép.
 *   owner = a szállás saját fiókja töltötte fel (a kártya adatában „bizbuilder”) → jogállás `places`
 *   guest = vendég / más felhasználó töltötte fel → jogállás `guest` (ADR §A.3, demóra mindkettő mehet)
 *   A partner-portál képét (Booking.com-proxy, vízjeles) a felderítő már ki sem írja.
 *
 * Szabályok:
 *   · a FIZETETT Places-válasz érinthetetlen: ha a leadnek már van más forrású tárolt válasza, kimarad;
 *   · a kép-URL a Google képszerverén 1200 px-re kérve kerül tárolásra (kulcs nélkül szolgálja ki);
 *   · `material.placesPhotos` a tárolt képek száma lesz (a lánc fotószámlálója ebből és a hirdetés-
 *     képekből adódik, ADR-0504) — a generátor mért száma a tárolt szám változásával érvényét veszti,
 *     és a következő terv újramér.
 *
 * Futtatás:
 *   npx tsx scripts/maps-card-photos.mts --file kartya.tsv          # DRY-RUN: mit írna
 *   npx tsx scripts/maps-card-photos.mts --file kartya.tsv --go     # ír (élesen csak a lánc --go-jával)
 *   … --file -                                                      # a TSV a stdin-en
 */
import { readFileSync } from "node:fs";

import { sql } from "kysely";

import { db } from "../src/db/client.js";
import { loadLead } from "../src/generator/persist.js";
import { placesIdentityOf, readPlacesCache, writePlacesCache, type CachedPlaces } from "../src/generator/placesCache.js";

const GO = process.argv.includes("--go");
const fileArg = process.argv.indexOf("--file");
const FILE = fileArg > 0 ? process.argv[fileArg + 1] : undefined;
if (!FILE) {
  console.error("usage: npx tsx scripts/maps-card-photos.mts --file <tsv|-> [--go]"); // i18n-exempt: operator CLI
  process.exit(2);
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Google's image server: a contributed Maps photo, never the partner proxy (Booking.com, watermarked). */
const CONTRIB = /^https:\/\/lh\d\.googleusercontent\.com\/(?!grass-proxy\/)[^?#\s]+$/i;

/** The same picture at 1200 px on the long edge — the size the generator assumes for a Places photo. */
function mapsPhotoUrl1200(url: string): string {
  return url.replace(/=[^/=]*$/, "") + "=w1200";
}

const byLead = new Map<string, { url: string; kind: "places" | "guest" }[]>();
const text = readFileSync(FILE === "-" ? 0 : FILE, "utf8");
let bad = 0;
for (const line of text.split("\n")) {
  const [id, rawUrl, who] = line.trim().split("\t");
  if (!id) continue;
  if (!UUID.test(id) || !rawUrl || !CONTRIB.test(rawUrl.trim())) {
    bad++;
    continue;
  }
  const url = mapsPhotoUrl1200(rawUrl.trim());
  const list = byLead.get(id) ?? [];
  if (!list.some((p) => p.url === url)) list.push({ url, kind: who === "owner" ? "places" : "guest" });
  byLead.set(id, list);
}

const tally = { written: 0, paid: 0, noLead: 0, noCoords: 0, same: 0 };
for (const [id, photos] of byLead) {
  const loaded = await loadLead(id).catch(() => null);
  if (!loaded || loaded.id !== id) {
    tally.noLead++;
    continue;
  }
  const identity = placesIdentityOf(loaded.lead);
  if (!identity) {
    tally.noCoords++;
    continue;
  }
  const stored = await readPlacesCache(id).catch(() => null);
  if (stored && stored.via !== "maps_card") {
    tally.paid++;
    continue;
  }
  const urls = photos.map((p) => p.url);
  if (stored?.match && stored.match.photoUrls.join(" ") === urls.join(" ")) {
    tally.same++;
    continue;
  }
  const entry: CachedPlaces = {
    v: 1,
    identity,
    via: "maps_card",
    match: {
      placeName: loaded.lead.name,
      distanceMeters: 0,
      nameSimilarity: 1,
      score: 1,
      band: "high",
      reasons: ["a felderítő a hely saját Térkép-kártyáját nyitotta meg"], // i18n-exempt: operator audit trail
      photoUrls: urls,
      photoProvenance: Object.fromEntries(photos.map((p) => [p.url, p.kind])),
    },
  };
  if (GO) {
    await writePlacesCache(id, entry);
    await db
      .updateTable("lead")
      .set({
        raw: sql`jsonb_set(raw, '{material}', coalesce(case when jsonb_typeof(raw->'material') = 'object' then raw->'material' end, '{}'::jsonb)
          || jsonb_build_object('placesPhotos', ${urls.length}::int))` as never,
      })
      .where("id", "=", id)
      .execute();
  }
  tally.written++;
  console.log(`${GO ? "írva" : "írná"}  ${id}  ${urls.length} kép (${photos.map((p) => p.kind).join(",")})  ${loaded.lead.name}`); // i18n-exempt: operator log
}
console.log(
  `${GO ? "KÉSZ" : "DRY-RUN"} — lead: ${byLead.size}, ${GO ? "írva" : "írná"}: ${tally.written}, fizetett válasz marad: ${tally.paid}, ` + // i18n-exempt: operator log
    `változatlan: ${tally.same}, nincs lead: ${tally.noLead}, koordináta nélkül: ${tally.noCoords}, rossz sor: ${bad}`,
);
await db.destroy();
