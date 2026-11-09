// The TOWN photo of a lead with no own photo (owner 2026-11-09: „Képek nélküli leadet nem
// küldhetünk ki … Hero városról kép”; ADR-0436, plan assets/design-refs/tenant-site/varos-hero/).
//
// Source, in order — free, no key, no paid call (ADR-0413):
//   ① the lead image of the town's Wikipedia article (the language of the lead's country, then
//      English), when it is a landscape JPEG photo of ≥ 1200 px under a free licence;
//   ② else the first such picture of a Wikimedia Commons file search for the town's name.
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
const NOT_A_PHOTO = /c[ií]mer|coat[ _-]?of[ _-]?arms|wappen|herb|zászl|flag|map|térkép|karte|locator|location|helyzete|elhelyezked|logo|seal|signature|aláírás|montage|collage|kollázs|cemetery|temető|friedhof|grave|sírk|sírem|panorama_?cylind|\.(?:svg|png|gif|tiff?)$/i;

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

/** ① the Wikipedia article's lead image (pageimages → the file name). */
async function fromWikipedia(city: string, wikiLang: string): Promise<TownPhoto | null> {
  const url =
    `https://${wikiLang}.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(city)}` +
    `&prop=pageimages&piprop=name&redirects=1&format=json&formatversion=2`;
  const j = (await getJson(url)) as { query?: { pages?: { pageimage?: string; missing?: boolean }[] } } | null;
  const file = j?.query?.pages?.[0]?.pageimage;
  if (!file) return null;
  const info = await commonsInfo(`File:${file}`);
  return info ? townPhotoFromInfo(info, city) : null;
}

/** ② a Commons file search for the town's name. */
async function fromCommonsSearch(city: string): Promise<TownPhoto | null> {
  const url =
    `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrnamespace=6` +
    `&gsrsearch=${encodeURIComponent(`intitle:"${city}" filetype:bitmap`)}&gsrlimit=15&${INFO_PARAMS}`;
  const j = (await getJson(url)) as {
    query?: { pages?: { title: string; index?: number; imageinfo?: Omit<CommonsInfo, "title">[] }[] };
  } | null;
  const pages = [...(j?.query?.pages ?? [])].sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
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

/** The town photo of `city`, or null (no article/free photo, or the network failed). */
export async function resolveTownPhoto(city: string | undefined | null, country?: string): Promise<TownPhoto | null> {
  const c = (city ?? "").trim();
  if (!c) return null;
  const key = `${(country ?? "HU").toUpperCase()}|${c.toLowerCase()}`;
  if (memo.has(key)) return memo.get(key)!;
  let found: TownPhoto | null = null;
  for (const l of wikiLangs(country)) {
    found = await fromWikipedia(c, l);
    if (found) break;
  }
  found ??= await fromCommonsSearch(c);
  memo.set(key, found);
  return found;
}
