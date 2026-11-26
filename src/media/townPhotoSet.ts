// THE TOWN'S PICTURE SET — stored once per town (town_photo_set), shared out among its leads
// (owner 2026-11-25, approved plan assets/design-refs/console/kepnelkuli-hero/, ADR-0479).
//
// ⛔ ONLY FOR E-MAIL LEADS (owner 2026-11-25): a town's pictures are gathered only when the town has
// at least one lead with an e-mail address and fewer than its country's minimum own photos (0155). A lead
// without an e-mail never triggers a gathering (it may still use a set another lead's town already has).
//
// Who gathers: ONLY the mock generation, just in time (owner 2026-11-25: no backfill, neither top 500 nor
// all towns) — when the chain reaches a concrete e-mail lead with no / few own photos, before its mock, and the
// town has no current set. The set is cached per town, so the town's next lead takes it from there.
//
// SHARING OUT: the town's e-mail leads are numbered (oldest first); lead #i gets hero i mod n, and its
// gallery is the town's local pool (gallery + the other heroes) rotated by i — two leads of one town
// never get the same hero while there are heroes enough, nor the same picture sequence.

import { sql } from "kysely";
import { db } from "../db/client.js";
import { CLOSED_NAME_SQL_PATTERN } from "../scraper/closedPlace.js";
import { hashDistance, NEAR_DUP_BITS } from "../engine/samePicture.js";
import { langForCountry } from "../i18n/lang.js";
import type { TownPhoto } from "../engine/recipe.js";
import { LEAD_MIN_OWN_PHOTOS_SQL, LEAD_OWN_PHOTOS_SQL } from "../outreach/mockPhotoGate.js";
import { pickTownPhotos, TOWN_PICK_THRESHOLD, TOWN_PICK_VERSION, type TownPick, type TownPickResult, type TownStyle } from "./townPick.js";

export type TownSetTrigger = "scrape" | "generate" | "backfill" | "chain";

export interface TownPhotoSetRow {
  readonly country: string;
  readonly cityKey: string;
  readonly city: string;
  readonly version: number;
  readonly threshold: string;
  readonly tier: TownPickResult["tier"];
  readonly style: TownStyle;
  readonly heroes: readonly TownPick[];
  readonly gallery: readonly TownPick[];
}

const fold = (x: string): string => x.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** The town's own name out of a stored city field: before a comma, without a street or house number. */
export function townName(city: string): string {
  return city
    .split(",")[0]!
    // An administrative prefix is no part of the town's name („Općina Brela”, „Grad Makarska”, „Gmina …”).
    .replace(/^(?:op[cć]ina|grad|gmina|obec|mesto|město|gemeinde|stadt|comune di|commune de|municipiul|comuna)\s+/i, "")
    .replace(/\s+\S+(?:\s+\S+)?\s+(?:utca|út|útja|tér|köz|sor|sétány|dűlő|puszta|ulica|cesta)\b.*$/i, "")
    .replace(/\s+\d.*$/, "")
    .trim();
}

/** The table key of a town: its folded name. */
export function townKey(city: string): string {
  return fold(townName(city)).replace(/\s+/g, " ");
}

/** Is the stored set the current pick (version + threshold) — the send gate's rule too? */
export function isCurrentPick(p: { version?: unknown; threshold?: unknown } | null | undefined): boolean {
  return p?.version === TOWN_PICK_VERSION && p?.threshold === TOWN_PICK_THRESHOLD;
}

function rowOf(r: {
  country: string;
  city_key: string;
  city: string;
  version: number;
  threshold: string;
  tier: string;
  style: string;
  heroes: unknown;
  gallery: unknown;
}): TownPhotoSetRow {
  return {
    country: r.country,
    cityKey: r.city_key,
    city: r.city,
    version: r.version,
    threshold: r.threshold,
    tier: r.tier as TownPhotoSetRow["tier"],
    style: r.style as TownStyle,
    heroes: (r.heroes ?? []) as TownPick[],
    gallery: (r.gallery ?? []) as TownPick[],
  };
}

/** The stored set of a town (any version), or null. */
export async function readTownPhotoSet(country: string, city: string): Promise<TownPhotoSetRow | null> {
  const r = await db
    .selectFrom("town_photo_set")
    .selectAll()
    .where("country", "=", country.toUpperCase())
    .where("city_key", "=", townKey(city))
    .executeTakeFirst();
  return r ? rowOf(r as never) : null;
}

/** Does any lead of this town have an e-mail and fewer than its country's minimum own photos? */
export async function townHasEmailLeadInNeed(country: string, city: string): Promise<boolean> {
  const rows = await sql<{ city: string }>`
    select l.raw->>'city' as city
      from lead l
     where btrim(coalesce(l.raw->>'email', '')) <> ''
       and l.contact_block_at is null
       and l.name !~* ${CLOSED_NAME_SQL_PATTERN}
       and upper(coalesce(l.raw->>'country', ${country.toUpperCase()})) = ${country.toUpperCase()}
       and l.raw->>'city' ilike ${`%${townName(city)}%`}
       and ${LEAD_OWN_PHOTOS_SQL} < ${LEAD_MIN_OWN_PHOTOS_SQL}
     limit 50`.execute(db);
  const key = townKey(city);
  return rows.rows.some((r) => r.city && townKey(r.city) === key);
}

const inFlight = new Map<string, Promise<TownPhotoSetRow | null>>();

export interface EnsureInput {
  readonly city: string;
  readonly country: string;
  readonly lat: number;
  readonly lon: number;
}

/**
 * The town's current set — read, or picked and stored now. `emailGate` (default on) refuses to gather
 * for a town without an e-mail lead in need (owner 2026-11-25); an existing current set is returned
 * either way. Null = no set and none gathered (gate closed, no model, no coordinate).
 */
export async function ensureTownPhotoSet(t: EnsureInput, trigger: TownSetTrigger, opts: { emailGate?: boolean } = {}): Promise<TownPhotoSetRow | null> {
  const country = t.country.toUpperCase();
  const name = townName(t.city);
  if (!name || !Number.isFinite(t.lat) || !Number.isFinite(t.lon)) return null;
  const have = await readTownPhotoSet(country, name);
  if (have && isCurrentPick(have)) return have;
  if (opts.emailGate !== false && !(await townHasEmailLeadInNeed(country, name))) return null;
  const k = `${country}|${townKey(name)}`;
  const running = inFlight.get(k);
  if (running) return running;
  const job = (async (): Promise<TownPhotoSetRow | null> => {
    const lang = langForCountry(country) ?? "en";
    const r = await pickTownPhotos({ city: name, country, lat: t.lat, lon: t.lon, lang });
    const values = townSetValues({ ...t, city: name, country }, r, trigger);
    await db
      .insertInto("town_photo_set")
      .values({ ...values, picked_at: sql`now()` } as never)
      .onConflict((oc) => oc.columns(["country", "city_key"]).doUpdateSet({ ...values, picked_at: sql`now()` } as never))
      .execute();
    return readTownPhotoSet(country, name);
  })().finally(() => inFlight.delete(k));
  inFlight.set(k, job);
  return job;
}

/** The lead's number among its town's e-mail leads (oldest first); 0 when it is not one of them. */
export async function leadSlotInTown(leadId: string, country: string, city: string): Promise<number> {
  const rows = await sql<{ id: string; city: string }>`
    select l.id, l.raw->>'city' as city
      from lead l
     where btrim(coalesce(l.raw->>'email', '')) <> ''
       and upper(coalesce(l.raw->>'country', ${country.toUpperCase()})) = ${country.toUpperCase()}
       and l.raw->>'city' ilike ${`%${townName(city)}%`}
     order by l.created_at, l.id`.execute(db);
  const key = townKey(city);
  const ids = rows.rows.filter((r) => r.city && townKey(r.city) === key).map((r) => r.id);
  const i = ids.indexOf(leadId);
  return i < 0 ? 0 : i;
}

/** A stored pick → the page's TownPhoto (with the pick stamp the send gate checks). */
export function townPhotoOf(p: TownPick, set: Pick<TownPhotoSetRow, "city" | "version" | "threshold">): TownPhoto {
  return {
    url: p.url,
    city: set.city,
    pageUrl: p.pageUrl,
    author: p.author,
    license: p.license,
    ...(p.licenseUrl ? { licenseUrl: p.licenseUrl } : {}),
    pick: {
      version: set.version,
      threshold: set.threshold,
      tier: p.tier,
      score: p.score,
      ...(p.km !== undefined ? { km: p.km } : {}),
    },
  };
}

export interface LeadTownPhotos {
  /** The lead's hero (null when the town has none). */
  readonly hero: TownPhoto | null;
  /** Local gallery pictures for this lead — never its hero, in the lead's own order. */
  readonly gallery: readonly TownPhoto[];
  readonly style: TownStyle;
}

/** Share the town's set out to the lead in `slot` (pure). */
export function shareTownSet(set: TownPhotoSetRow, slot: number, galleryMax = 6): LeadTownPhotos {
  const n = set.heroes.length;
  const hero = n ? set.heroes[slot % n]! : null;
  // One view once on a page: a near-duplicate of the hero or of an earlier pool picture leaves (a set picked
  // before the stricter dedupe of 2026-11-25 may still hold two shots of one series).
  const near = (a: TownPick, b: TownPick): boolean => {
    const d = a.dhash && b.dhash ? hashDistance(a.dhash, b.dhash) : null;
    return d !== null && d <= NEAR_DUP_BITS + 6;
  };
  const pool: TownPick[] = [];
  for (const p of [...set.gallery, ...set.heroes.filter((h) => h !== hero)]) {
    if ((hero && near(p, hero)) || pool.some((q) => near(p, q))) continue;
    pool.push(p);
  }
  const shift = pool.length ? slot % pool.length : 0;
  const rotated = [...pool.slice(shift), ...pool.slice(0, shift)];
  return {
    hero: hero ? townPhotoOf(hero, set) : null,
    gallery: rotated.slice(0, galleryMax).map((p) => townPhotoOf(p, set)),
    style: set.style,
  };
}

/** The towns of e-mail leads in need (no / few own photos) — the backfill order: most such leads first. */
export async function townsInNeed(opts: { scrapeRunId?: string; country?: string; limit?: number } = {}): Promise<
  { city: string; country: string; lat: number; lon: number; leads: number }[]
> {
  const rows = await sql<{ city: string; country: string | null; lat: number | null; lon: number | null }>`
    select l.raw->>'city' as city, upper(l.raw->>'country') as country, l.lat, l.lng as lon
      from lead l
     where btrim(coalesce(l.raw->>'email', '')) <> ''
       and coalesce(l.raw->>'city', '') <> ''
       and l.contact_block_at is null
       and l.name !~* ${CLOSED_NAME_SQL_PATTERN}
       and l.lifecycle_status not in ('disqualified', 'terminated')
       and ${LEAD_OWN_PHOTOS_SQL} < ${LEAD_MIN_OWN_PHOTOS_SQL}
       ${opts.scrapeRunId ? sql`and l.scrape_run_id = ${opts.scrapeRunId}` : sql``}
       ${opts.country ? sql`and upper(l.raw->>'country') = ${opts.country.toUpperCase()}` : sql``}`.execute(db);
  const by = new Map<string, { city: string; country: string; lats: number[]; lons: number[]; leads: number }>();
  for (const r of rows.rows) {
    if (!r.country || !r.city) continue;
    const name = townName(r.city);
    if (!name) continue;
    const k = `${r.country}|${townKey(name)}`;
    const e = by.get(k) ?? { city: name, country: r.country, lats: [], lons: [], leads: 0 };
    e.leads++;
    if (r.lat != null && r.lon != null) {
      e.lats.push(Number(r.lat));
      e.lons.push(Number(r.lon));
    }
    by.set(k, e);
  }
  const median = (xs: number[]): number => {
    const s = [...xs].sort((a, b) => a - b);
    return s.length ? s[Math.floor(s.length / 2)]! : NaN;
  };
  return [...by.values()]
    .filter((e) => e.lats.length)
    .map((e) => ({ city: e.city, country: e.country, lat: median(e.lats), lon: median(e.lons), leads: e.leads }))
    .sort((a, b) => b.leads - a.leads || a.city.localeCompare(b.city))
    .slice(0, opts.limit ?? Infinity);
}

/** The town_photo_set row of a finished pick (the generator-side upsert and the chain step share it). */
export function townSetValues(t: EnsureInput, r: TownPickResult, trigger: TownSetTrigger) {
  const country = t.country.toUpperCase();
  const name = townName(t.city);
  return {
    country,
    city_key: townKey(name),
    city: name,
    lat: t.lat,
    lon: t.lon,
    version: TOWN_PICK_VERSION,
    threshold: TOWN_PICK_THRESHOLD,
    tier: r.tier,
    style: r.style,
    heroes: JSON.stringify(r.heroes),
    gallery: JSON.stringify(r.gallery),
    stats: JSON.stringify({ ...r.stats, ...(r.wikidata ? { wikidata: r.wikidata } : {}) }),
    trigger,
  };
}

/**
 * The same upsert as plain SQL for the chain's live path (ssh + psql, like the contact apply). Every text value is
 * dollar-quoted with a tag that cannot occur in it, so no value can break out of its literal.
 */
export function townSetUpsertSql(v: ReturnType<typeof townSetValues>): string {
  const lit = (x: string): string => {
    let tag = "tp";
    while (x.includes(`$${tag}$`)) tag += "x";
    return `$${tag}$${x}$${tag}$`;
  };
  const num = (x: number): string => (Number.isFinite(x) ? String(x) : "null");
  return (
    `insert into town_photo_set (country, city_key, city, lat, lon, version, threshold, tier, style, heroes, gallery, stats, trigger, picked_at) values (` +
    [lit(v.country), lit(v.city_key), lit(v.city), num(v.lat), num(v.lon), String(Math.trunc(v.version)), lit(v.threshold), lit(v.tier), lit(v.style), `${lit(v.heroes)}::jsonb`, `${lit(v.gallery)}::jsonb`, `${lit(v.stats)}::jsonb`, lit(v.trigger), "now()"].join(", ") +
    `) on conflict (country, city_key) do update set city = excluded.city, lat = excluded.lat, lon = excluded.lon, version = excluded.version, threshold = excluded.threshold, tier = excluded.tier, style = excluded.style, heroes = excluded.heroes, gallery = excluded.gallery, stats = excluded.stats, trigger = excluded.trigger, picked_at = now();`
  );
}
