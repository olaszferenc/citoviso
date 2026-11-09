// The TOWN photo of a lead with no own photo (owner 2026-11-09: „Képek nélküli leadet nem
// küldhetünk ki … Hero városról kép”; ADR-0436, plan assets/design-refs/tenant-site/varos-hero/).
//
// Source, in order — free, no key, no paid call (ADR-0413):
//   ① the lead image of the town's Wikipedia article (the language of the lead's country, then
//      English), when it is a landscape JPEG photo of ≥ 1200 px under a free licence;
//   ② else the Wikidata image (P18) of the same town;
//   ③ else the first such Commons photo geotagged around the town centre (geosearch).
// A namesake article (a disambiguation page, or one farther than 25 km from the lead) is skipped;
// so is any file whose name says lodging, interior, statue or portrait (it would pass for the lodging).
// A coat of arms, map, flag, locator or any SVG/PNG is no town photo and is skipped. The picture
// is HOT-LINKED from upload./thumb.wikimedia.org (Wikimedia's own CDN — allowed and what it is for), so
// nothing is stored on our side; the licence asks for the credit the mock prints (render.ts).
//
// The result is persisted in the mock's siteData (SiteData.townPhoto), so a rerender never asks
// again. Any failure → null: the caller keeps the typographic hero (the 2026-11-07 behaviour).

import type { TownPhoto } from "../engine/recipe.js";

const UA = "CitovisoMockBot/1.0 (https://citoviso.com)";
const THUMB_WIDTH = 1600;
const MIN_WIDTH = 1200;
const TIMEOUT_MS = 8000;

/** Free licences only (the short names Commons prints). */
const FREE_LICENSE = /^(?:cc[ -]?by(?:[ -]sa)?(?:[ -]\d(?:\.\d)?)?(?:[ -][a-z]{2,})?|cc0(?:[ -]1\.0)?|public domain|pd(?:[ -].*)?)$/i;
/** File names that are no photo of the town. */
const NOT_A_PHOTO = /c[ií]mer|coat[ _-]?of[ _-]?arms|wappen|herb|zászl|flag|map|térkép|karte|locator|location|helyzete|elhelyezked|logo|seal|signature|aláírás|montage|collage|kollázs|cemetery|temető|friedhof|grave|sírk|sírem|panorama_?cylind|villa(?![nńc])|hotel|sz[aá]ll[oó]|szálloda|panzi|pension|apartm|vendégh|guest|motel|hostel|camping|kemping|resort|interior|belső|szoba|room|statue|szobor|portrait|portré|\.(?:svg|png|gif|tiff?)$/i;

const memo = new Map<string, TownPhoto | null>();

interface CommonsInfo {
  readonly title: string;
  readonly width: number;
  readonly height: number;
  readonly thumburl?: string;
  readonly descriptionurl: string;
  readonly mime?: string;
  readonly extmetadata?: Record<string, { value?: string } | undefined>;
}

async function getJson(url: string): Promise<unknown> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json" }, signal: ctrl.signal });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

function plain(html: string | undefined): string {
  return (html ?? "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

/** A Commons file's info → a TownPhoto, or null when it is no usable free landscape photo. */
export function townPhotoFromInfo(info: CommonsInfo, city: string): TownPhoto | null {
  const name = info.title.replace(/^(?:File|Fájl):/i, "");
  if (NOT_A_PHOTO.test(name)) return null;
  if (info.mime && info.mime !== "image/jpeg") return null;
  if (!/\.jpe?g$/i.test(name)) return null;
  if (info.width < MIN_WIDTH || info.width < info.height * 1.15) return null;
  const meta = info.extmetadata ?? {};
  const license = plain(meta.LicenseShortName?.value);
  if (!FREE_LICENSE.test(license)) return null;
  if (!info.thumburl || !/^https:\/\/(?:upload|thumb)\.wikimedia\.org\//.test(info.thumburl)) return null;
  const author = plain(meta.Artist?.value) || "Wikimedia Commons";
  const licenseUrl = plain(meta.LicenseUrl?.value);
  return {
    url: info.thumburl.replace(/\?.*$/, ""),
    city,
    pageUrl: info.descriptionurl,
    author: author.length > 80 ? `${author.slice(0, 77)}…` : author,
    license,
    ...(licenseUrl.startsWith("https://") || licenseUrl.startsWith("http://") ? { licenseUrl } : {}),
  };
}

const INFO_PARAMS = `prop=imageinfo&iiprop=url|size|mime|extmetadata&iiurlwidth=${THUMB_WIDTH}&format=json&formatversion=2`;

async function commonsInfo(fileTitle: string): Promise<CommonsInfo | null> {
  const url = `https://commons.wikimedia.org/w/api.php?action=query&titles=${encodeURIComponent(fileTitle)}&${INFO_PARAMS}`;
  const j = (await getJson(url)) as { query?: { pages?: { title: string; imageinfo?: Omit<CommonsInfo, "title">[] }[] } } | null;
  const p = j?.query?.pages?.[0];
  const ii = p?.imageinfo?.[0];
  return p && ii ? { title: p.title, ...ii } : null;
}

/** A point on the map (the lead's own coordinates, or the town article's). */
export interface GeoPoint {
  readonly lat: number;
  readonly lon: number;
}

/** Great-circle distance in km. */
function km(a: GeoPoint, b: GeoPoint): number {
  const r = Math.PI / 180;
  const h =
    Math.sin(((b.lat - a.lat) * r) / 2) ** 2 +
    Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(((b.lon - a.lon) * r) / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(h));
}

/** A town article farther than this from the lead is a namesake (Gyula the town ≠ Gyula the name). */
const ARTICLE_MAX_KM = 25;
/** The Commons geosearch radius around the town centre. */
const GEO_RADIUS_M = 4000;

interface ArticleHit {
  readonly file?: string;
  readonly wikidata?: string;
  readonly at?: GeoPoint;
}

/** The town's Wikipedia article: its lead image, Wikidata item and coordinates — or null when the
 * title is missing, a disambiguation page, or an article too far from the lead (a namesake). */
async function article(title: string, wikiLang: string, near: GeoPoint | null): Promise<ArticleHit | null> {
  const url =
    `https://${wikiLang}.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(title)}` +
    `&prop=pageimages|pageprops|coordinates&piprop=name&ppprop=disambiguation|wikibase_item&redirects=1&format=json&formatversion=2`;
  const j = (await getJson(url)) as {
    query?: {
      pages?: {
        missing?: boolean;
        pageimage?: string;
        pageprops?: { disambiguation?: string; wikibase_item?: string };
        coordinates?: { lat: number; lon: number }[];
      }[];
    };
  } | null;
  const p = j?.query?.pages?.[0];
  if (!p || p.missing || p.pageprops?.disambiguation !== undefined) return null;
  const c = p.coordinates?.[0];
  const at = c ? { lat: c.lat, lon: c.lon } : undefined;
  if (near && (!at || km(near, at) > ARTICLE_MAX_KM)) return null;
  return {
    ...(p.pageimage ? { file: p.pageimage } : {}),
    ...(p.pageprops?.wikibase_item ? { wikidata: p.pageprops.wikibase_item } : {}),
    ...(at ? { at } : {}),
  };
}

/** The Wikidata item's image (P18) file name. */
async function wikidataImage(qid: string): Promise<string | null> {
  const url = `https://www.wikidata.org/w/api.php?action=wbgetclaims&entity=${encodeURIComponent(qid)}&property=P18&format=json`;
  const j = (await getJson(url)) as { claims?: { P18?: { mainsnak?: { datavalue?: { value?: string } } }[] } } | null;
  return j?.claims?.P18?.[0]?.mainsnak?.datavalue?.value ?? null;
}

/** Commons photos taken around the town centre, the ones naming the town first, then nearest. */
async function fromCommonsGeo(city: string, at: GeoPoint): Promise<TownPhoto | null> {
  const url =
    `https://commons.wikimedia.org/w/api.php?action=query&generator=geosearch&ggsnamespace=6` +
    `&ggscoord=${at.lat}|${at.lon}&ggsradius=${GEO_RADIUS_M}&ggslimit=40&${INFO_PARAMS}`;
  const j = (await getJson(url)) as {
    query?: { pages?: { title: string; index?: number; imageinfo?: Omit<CommonsInfo, "title">[] }[] };
  } | null;
  const fold = (x: string) => x.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const named = (t: string) => fold(t).includes(fold(city));
  const pages = [...(j?.query?.pages ?? [])].sort(
    (a, b) => Number(named(b.title)) - Number(named(a.title)) || (a.index ?? 0) - (b.index ?? 0),
  );
  for (const p of pages) {
    const ii = p.imageinfo?.[0];
    if (!ii) continue;
    const t = townPhotoFromInfo({ title: p.title, ...ii }, city);
    if (t) return t;
  }
  return null;
}

/** The Wikipedia language editions to ask for a town in `country` (ISO-2). */
function wikiLangs(country: string | undefined): string[] {
  const own: Record<string, string> = { HU: "hu", AT: "de", DE: "de", SK: "sk", RO: "ro", HR: "hr", SI: "sl", PL: "pl", CZ: "cs", IT: "it" };
  const l = own[(country ?? "HU").toUpperCase()];
  return l ? [l, "en"] : ["en"];
}

/** Article titles to try in `wikiLang`: the bare name, then the namesake-proof forms
 * („Gyula (Magyarország)” on huwiki, „Gyula, Hungary” on enwiki). */
function titlesFor(city: string, wikiLang: string, country: string): string[] {
  const hu: Record<string, string> = { HU: "Magyarország", AT: "Ausztria", SK: "Szlovákia", RO: "Románia", HR: "Horvátország", SI: "Szlovénia" };
  const en: Record<string, string> = { HU: "Hungary", AT: "Austria", DE: "Germany", SK: "Slovakia", RO: "Romania", HR: "Croatia", SI: "Slovenia", PL: "Poland", CZ: "Czech Republic", IT: "Italy" };
  const out = [city];
  if (wikiLang === "hu" && hu[country]) out.push(`${city} (${hu[country]})`, `${city} (település)`);
  if (wikiLang === "en" && en[country]) out.push(`${city}, ${en[country]}`);
  return out;
}

/** The town photo of `city`, or null (no article/free photo, or the network failed). `near` is the
 * lead's own position: with it, an article of a namesake far away is never taken. */
export async function resolveTownPhoto(
  city: string | undefined | null,
  country?: string,
  near?: GeoPoint | null,
): Promise<TownPhoto | null> {
  const c = (city ?? "").trim();
  if (!c) return null;
  const cc = (country ?? "HU").toUpperCase();
  const key = `${cc}|${c.toLowerCase()}`;
  if (memo.has(key)) return memo.get(key)!;
  const pos = near && Number.isFinite(near.lat) && Number.isFinite(near.lon) ? near : null;
  let found: TownPhoto | null = null;
  let at: GeoPoint | null = null;
  const tried = new Set<string>();
  const tryFile = async (file: string | null | undefined): Promise<TownPhoto | null> => {
    if (!file || tried.has(file)) return null;
    tried.add(file);
    const info = await commonsInfo(`File:${file}`);
    return info ? townPhotoFromInfo(info, c) : null;
  };
  outer: for (const l of wikiLangs(cc)) {
    for (const title of titlesFor(c, l, cc)) {
      const a = await article(title, l, pos);
      if (!a) continue;
      at ??= a.at ?? null;
      found = (await tryFile(a.file)) ?? (a.wikidata ? await tryFile(await wikidataImage(a.wikidata)) : null);
      if (found) break outer;
      break; // the article was found — its namesake-proof titles name the same town
    }
  }
  const centre = at ?? pos;
  if (!found && centre) found = await fromCommonsGeo(c, centre);
  memo.set(key, found);
  return found;
}
