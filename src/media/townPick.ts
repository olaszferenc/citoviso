// TOWN PHOTO PICKER — the pictures of a lead's TOWN for a mock without (enough) own photos
// (owner 2026-11-25, approved plan assets/design-refs/console/kepnelkuli-hero/, ADR-0479).
//
// Country-agnostic, automatic, no human curation, $0:
//   SOURCE  Wikimedia Commons only, free licences only (CC0 / CC BY / CC BY-SA / public domain);
//           licence, author and file page are kept and printed. Hot-linked from Wikimedia's CDN.
//   TIERS   ① the town: its Wikidata item (exact name, ≤ 25 km, most sitelinks) — image P18, the
//             Commons category tree (P373), title / full-text / Quality-image searches;
//           ② the landscape around the coordinate (Commons geosearch at the centre and 4 rings
//             ~12 km out) — ONLY a picture taken in the lead's OWN country (decided from the
//             picture's coordinate; no coordinate → not taken);
//           ③ the administrative region (Wikidata P131 chain, 2 levels; a whole country excluded).
//   JUDGE   the production CLIP model (media/photoKind.ts, local ONNX) — ONE embedding per photo,
//           scored against townPickLabels.json: round 1 = subject (town / landscape / 29 forbidden
//           subjects) + quality; round 2 = five yes/no questions (outdoors, wide, a view not a road,
//           not a sports ground, daylight) + the GPS rule (≤ 15 km from the town when the file has one).
//           Thresholds „Laza” (T 0.50 · Q 0.40 · B 0.25) — the second round does the strictness.
//   OUTPUT  3–6 hero candidates (shared out among the town's leads) and 4–6 LOCAL gallery pictures
//           (beach, main square, sight, landscape — round-robin), plus the sample-room STYLE of the
//           place (coast → mediterranean, mountains → alpine, city → urban, else rural).
//
// Measured on the 22-town plan sample (2026-11-24): 18 own town picture, 3 fallback, 1 none.

import { dHashFromBuffer } from "../generator/photoHash.js";
import { hashDistance, NEAR_DUP_BITS } from "../engine/samePicture.js";
import { reverseGeocode } from "../scraper/enrichGeo.js";
import { namesTown } from "../generator/townPhoto.js";
import { clipImageEmbedding, photoKindAvailable } from "./photoKind.js";
import LABELS from "./townPickLabels.json" with { type: "json" };
import { judgeTownCandidates, type JudgeItem, type JudgeVerdict } from "./townJudge.js";

/** Bump when the labels, the rules or the thresholds change: the send gate refuses an older pick. */
export const TOWN_PICK_VERSION = 6;
/** The approved threshold variant (owner 2026-11-25: „Laza” + the second round). */
export const TOWN_PICK_THRESHOLD = "laza";
const T_MIN = 0.5;
const Q_MIN = 0.4;
const BAD_MAX = 0.25;

const UA = "CitovisoMockBot/1.0 (https://citoviso.com)";
const TIMEOUT_MS = 20000;
const HERO_MIN_W = 1600;
const HERO_MIN_RATIO = 1.3;
const GALLERY_MIN_W = 1200;
const GALLERY_MIN_RATIO = 1.2;
const TOWN_MAX_KM = 15;
const WIKIDATA_MAX_KM = 25;
export const HEROES_MAX = 6;
export const HEROES_WANT = 3;
export const GALLERY_MAX = 6;
export const GALLERY_WANT = 4;

export type TownTier = "town" | "land" | "region";
export type TownStyle = "mediterranean" | "alpine" | "rural" | "urban";
export type GalleryBucket = "strand" | "square" | "sight" | "landscape";

/** One picked picture, as stored in town_photo_set and printed on the page. */
export interface TownPick {
  /** Hot-linked Wikimedia thumbnail (1920 px for a hero when the file is that wide, else 1280 px). */
  readonly url: string;
  readonly title: string;
  readonly pageUrl: string;
  readonly author: string;
  readonly license: string;
  readonly licenseUrl?: string;
  readonly tier: TownTier;
  /** Rank score (0.6 × subject + 0.4 × quality + bonuses). */
  readonly score: number;
  /** Distance of the file's GPS from the town centre, when the file has one. */
  readonly km?: number;
  readonly bucket: GalleryBucket;
  readonly dhash?: string;
  /** May stand as the hero (≥ 1600 px, ≥ 1.3:1)? Gallery pictures may be smaller. */
  readonly heroOk: boolean;
  /** v6: the final judge's verdict on this picture (media/townJudge.ts), when it was judged. */
  readonly judge?: { readonly verdict: JudgeVerdict; readonly reason: string };
}

export interface TownPickInput {
  readonly city: string;
  /** ISO-2 of the lead's country. */
  readonly country: string;
  readonly lat: number;
  readonly lon: number;
  /** Wikipedia/Wikidata language of the country („hu”, „hr”…). */
  readonly lang: string;
}

export interface TownPickStats {
  apiCalls: number;
  bytes: number;
  clipRuns: number;
  candidates: number;
  seconds: number;
  judgeCalls?: number;
  judgeCostUsd?: number;
  judgeError?: string;
  rejected: Record<string, number>;
}

export interface TownPickResult {
  readonly tier: TownTier | "none";
  readonly heroes: readonly TownPick[];
  readonly gallery: readonly TownPick[];
  readonly style: TownStyle;
  readonly wikidata?: string;
  readonly stats: TownPickStats;
}

/** Round-1 + round-2 scores of one picture. */
export interface TownScores {
  readonly town: number;
  readonly land: number;
  readonly bad: number;
  readonly q: number;
  readonly top: string;
  readonly topKind: string;
  readonly topBad: string;
  readonly topBadP: number;
  readonly bucket: GalleryBucket;
  /** Round-2 pair probabilities: outdoor, wide, view, day, sport, sky. */
  readonly x: Readonly<Record<string, number>>;
}

interface Label {
  readonly label: string;
  readonly kind: string;
  readonly embed: readonly number[];
}
interface Pair {
  readonly key: string;
  readonly yesEmbed: readonly number[];
  readonly noEmbed: readonly number[];
}
const L = LABELS as unknown as { labels: Label[]; pairs: Pair[] };

const BUCKET_OF: Record<string, GalleryBucket> = {
  "a lake shore with a promenade": "strand",
  "a harbour with boats and an old town by the sea": "strand",
  "a beach with clear sea water": "strand",
  "a calm lake landscape": "strand",
  "a sea coast with mountains": "strand",
  "a historic town square with old buildings": "square",
  "a sunny street with historic houses": "square",
  "a city skyline": "square",
  "a scenic panorama of a town": "square",
  "an aerial view of a town": "square",
  "a small village in the countryside seen from above": "square",
  "a beautiful church in a town centre": "sight",
  "a castle on a hill": "sight",
  "a thermal spa building": "sight",
  "a river flowing through a town": "sight",
};

const dot = (a: readonly number[], b: Float32Array): number => {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i]! * (b[i] ?? 0);
  return s;
};

/** Score a CLIP image embedding against the town labels (both rounds). Pure. */
export function scoreTownEmbedding(emb: Float32Array): TownScores {
  const n = Math.hypot(...emb) || 1;
  const sim = L.labels.map((l) => (100 * dot(l.embed, emb)) / n);
  const subj = L.labels.map((l, i) => ({ l, i })).filter((x) => !x.l.kind.startsWith("q"));
  const mx = Math.max(...subj.map((x) => sim[x.i]!));
  const ex = subj.map((x) => Math.exp(sim[x.i]! - mx));
  const sum = ex.reduce((a, b) => a + b, 0);
  const prob = new Map(subj.map((x, k) => [x.i, ex[k]! / sum]));
  const mass = (kind: string): number => subj.reduce((a, x) => a + (x.l.kind === kind ? prob.get(x.i)! : 0), 0);
  const top = subj.reduce((b, x) => (prob.get(x.i)! > prob.get(b.i)! ? x : b), subj[0]!);
  const bads = subj.filter((x) => x.l.kind === "bad");
  const topBad = bads.reduce((b, x) => (prob.get(x.i)! > prob.get(b.i)! ? x : b), bads[0]!);
  const goods = subj.filter((x) => x.l.kind === "town" || x.l.kind === "land");
  const topGood = goods.reduce((b, x) => (prob.get(x.i)! > prob.get(b.i)! ? x : b), goods[0]!);
  const qg = sim[L.labels.findIndex((l) => l.kind === "qgood")]!;
  const qb = sim[L.labels.findIndex((l) => l.kind === "qbad")]!;
  const x: Record<string, number> = {};
  for (const p of L.pairs) {
    const sa = (100 * dot(p.yesEmbed, emb)) / n;
    const sb = (100 * dot(p.noEmbed, emb)) / n;
    x[p.key] = +(1 / (1 + Math.exp(sb - sa))).toFixed(3);
  }
  return {
    town: +mass("town").toFixed(3),
    land: +mass("land").toFixed(3),
    bad: +mass("bad").toFixed(3),
    q: +(1 / (1 + Math.exp(-(qg - qb)))).toFixed(3),
    top: top.l.label,
    topKind: top.l.kind,
    topBad: topBad.l.label,
    topBadP: +prob.get(topBad.i)!.toFixed(3),
    bucket: BUCKET_OF[topGood.l.label] ?? "landscape",
    x,
  };
}

/**
 * The approved rule („Laza” + round 2). `km` = the file's GPS distance from the town (undefined = no GPS).
 * Returns null when accepted, else the Hungarian, operator-facing reason.
 */
export function townVerdict(s: TownScores, tier: TownTier, km?: number): string | null {
  if (s.topKind === "bad") return `CLIP: ${s.top}`;
  if (s.topBadP >= BAD_MAX) return `CLIP tiltott téma: ${s.topBad} (${s.topBadP.toFixed(2)})`;
  if (tier !== "town" && (s.land <= s.town || s.town >= 0.3)) return "tartalékban csak táj mehet";
  if (tier === "town" && km !== undefined && km > TOWN_MAX_KM) return `máshol készült: ${km.toFixed(1)} km-re`;
  const x = s.x;
  if ((x.sky ?? 1) < 0.5) return "belső tér";
  if ((x.view ?? 1) < 0.3) return "nem látkép (út, autó, vezeték)";
  if ((x.sport ?? 1) < 0.5) return "sportpálya / játszótér";
  if ((x.wide ?? 1) < 0.5) return "közeli részlet";
  if ((x.day ?? 1) < 0.4) return "sötét / alkonyi";
  // v2 (coordinator 2026-11-25, Fertőrákos: the Községháza with its lettering as the hero).
  if ((x.facade ?? 1) < 0.5) return "egyetlen (feliratos) épület homlokzata";
  // v3 (blind run of 20 unseen towns, 2026-11-25: a thatched house, a tree-top walkway, a roof against the sky —
  // pictures a guest would take for the lodging itself): never a single ordinary house, roof or structure up close.
  if ((x.house ?? 1) < 0.5) return "egyetlen ház / tető / szerkezet közelről";
  const subject = tier === "town" ? s.town + s.land : s.land;
  if (subject < T_MIN) return `gyenge téma-pont ${subject.toFixed(2)}`;
  if (s.q < Q_MIN) return `gyenge minőség ${s.q.toFixed(2)}`;
  return null;
}

/**
 * Judge picture bytes as a town hero with the approved rule — the render gate re-judges the page's
 * town hero with it. Null = the model is missing (the caller decides; the send gate refuses).
 */
export async function judgeTownPicture(
  buf: Buffer,
  tier: TownTier = "town",
  asHero = false,
): Promise<{ ok: boolean; reason: string | null; scores: TownScores } | null> {
  const emb = await clipImageEmbedding(buf);
  if (!emb) return null;
  const scores = scoreTownEmbedding(emb);
  const reason = townVerdict(scores, tier) ?? (asHero && !heroView(scores, tier) ? "a nyitókép-padló alatt (felülnézet, fakó, tető közelről vagy sima vidék)" : null);
  return { ok: reason === null, reason, scores };
}

// ── network ──────────────────────────────────────────────────────────────────

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

class Net {
  readonly stats: TownPickStats = { apiCalls: 0, bytes: 0, clipRuns: 0, candidates: 0, seconds: 0, rejected: {} };

  async json(url: string): Promise<any> {
    for (let i = 0; i < 4; i++) {
      this.stats.apiCalls++;
      try {
        const r = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json" }, signal: AbortSignal.timeout(TIMEOUT_MS) });
        if (r.ok) {
          const t = await r.text();
          this.stats.bytes += t.length;
          return JSON.parse(t);
        }
        if (r.status === 429 || r.status >= 500) await sleep(4000 * (i + 1));
        else return null;
      } catch {
        await sleep(1500 * (i + 1));
      }
    }
    return null;
  }

  async buf(url: string): Promise<Buffer | null> {
    for (let i = 0; i < 4; i++) {
      try {
        const r = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(TIMEOUT_MS) });
        if (r.ok) {
          const b = Buffer.from(await r.arrayBuffer());
          this.stats.bytes += b.length;
          return b;
        }
        if (r.status === 429 || r.status >= 500) await sleep(4000 * (i + 1));
        else return null;
      } catch {
        await sleep(1500 * (i + 1));
      }
    }
    return null;
  }

  commons(p: Record<string, string>): Promise<any> {
    return this.json("https://commons.wikimedia.org/w/api.php?" + new URLSearchParams({ format: "json", formatversion: "2", ...p }).toString());
  }

  wikidata(p: Record<string, string>): Promise<any> {
    return this.json("https://www.wikidata.org/w/api.php?" + new URLSearchParams({ format: "json", formatversion: "2", ...p }).toString());
  }

  reject(reason: string): void {
    const k = reason.replace(/[\d.]+( km)?/g, "").replace(/\(.*\)/, "").trim();
    this.stats.rejected[k] = (this.stats.rejected[k] ?? 0) + 1;
  }
}

const plain = (h: string | undefined): string =>
  (h ?? "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();

export function kmBetween(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const r = Math.PI / 180;
  const h = Math.sin(((b.lat - a.lat) * r) / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(((b.lon - a.lon) * r) / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(h));
}

/** Free licences only (the short names Commons prints). */
export const FREE_LICENSE = /^(?:cc[ -]?by(?:[ -]sa)?(?:[ -]\d(?:\.\d)?)?(?:[ -][a-z]{2,})?|cc0(?:[ -]1\.0)?|public domain|pd(?:[ -].*)?)$/i;
/** File names of forbidden subjects (many languages — the files are named by their uploaders). */
export const BAD_FILE_NAME =
  /c[ií]mer|coat[ _-]?of[ _-]?arms|wappen|\bgrb\b|zastava|flag|\bmap\b|térkép|karta|locator|location|logo|montage|collage|kollázs|cemetery|temető|groblje|friedhof|grave|interior|belső|unutra|statue|szobor|\bkip\b|portrait|\bbust\b|plaque|tábla|ploča|train|vonat|vlak|locomotive|mozdony|\bbus\b|busz|\btram\b|^File:ISS\d|astronaut|view of earth|station|állomás|kolodvor|bahnhof|stadium|night|éjszak|\bnoć|nacht|hotel|apartm|szálló|panzió|pension|vendégház|\bsign\b|községház|polgármester|városház|rathaus|gemeindeamt|zgrada op[cć]ine|op[cć]inska zgrada|hivatal|town hall|city hall|fortepan/i;

interface Cand {
  readonly title: string;
  readonly tier: TownTier;
  readonly origin: string;
  readonly w: number;
  readonly h: number;
  readonly thumb330: string;
  readonly pageUrl: string;
  readonly license: string;
  readonly licenseUrl?: string;
  readonly author: string;
  readonly lat?: number;
  readonly lon?: number;
  readonly quality: boolean;
  /** The file's (visible) category names, joined — the „does it name the town?” test. */
  readonly cats: string;
}

const INFO: Record<string, string> = {
  prop: "imageinfo|categories|coordinates",
  iiprop: "url|size|mime|extmetadata",
  iiurlwidth: "330",
  clshow: "!hidden",
  cllimit: "max",
  colimit: "max",
};
const QUALITY_CATS = /^Category:(Quality images|Featured pictures|Valued images)/;

/** A Commons page → a candidate, or null with the rejection counted (hard filters, no download). */
function toCand(net: Net, p: any, tier: TownTier, origin: string): Cand | null {
  const ii = p?.imageinfo?.[0];
  if (!ii) return null;
  const md = ii.extmetadata ?? {};
  const license = plain(md.LicenseShortName?.value);
  const fail = (r: string): null => {
    net.reject(r);
    return null;
  };
  if (ii.mime !== "image/jpeg") return fail("nem JPEG");
  if (!FREE_LICENSE.test(license)) return fail("nem szabad licenc");
  if (BAD_FILE_NAME.test(p.title)) return fail("fájlnév: tiltott téma");
  if (ii.width < GALLERY_MIN_W) return fail("kicsi");
  if (ii.width < ii.height * GALLERY_MIN_RATIO) return fail("nem fekvő");
  if (!ii.thumburl || !/^https:\/\/(?:upload|thumb)\.wikimedia\.org\//.test(ii.thumburl)) return fail("nincs bélyegkép");
  const co = p.coordinates?.[0];
  const lat = co ? Number(co.lat) : Number(plain(md.GPSLatitude?.value));
  const lon = co ? Number(co.lon) : Number(plain(md.GPSLongitude?.value));
  const author = plain(md.Artist?.value) || "Wikimedia Commons";
  const licenseUrl = plain(md.LicenseUrl?.value);
  return {
    title: p.title,
    tier,
    origin,
    w: ii.width,
    h: ii.height,
    thumb330: String(ii.thumburl).replace(/\?.*$/, ""),
    pageUrl: ii.descriptionurl,
    license,
    ...(/^https?:\/\//.test(licenseUrl) ? { licenseUrl } : {}),
    author: author.length > 80 ? `${author.slice(0, 77)}…` : author,
    ...(Number.isFinite(lat) && Number.isFinite(lon) && (lat !== 0 || lon !== 0) ? { lat, lon } : {}),
    quality: (p.categories ?? []).some((c: { title: string }) => QUALITY_CATS.test(c.title)),
    cats: (p.categories ?? []).map((c: { title: string }) => c.title.replace(/^Category:/, "")).join(" | "),
  };
}

const claim = (it: any, p: string): any[] => (it?.claims?.[p] ?? []).map((c: any) => c.mainsnak?.datavalue?.value).filter(Boolean);

async function wikidataTown(net: Net, t: TownPickInput): Promise<{ id: string; it: any } | null> {
  const s = await net.wikidata({ action: "wbsearchentities", search: t.city, language: t.lang, uselang: t.lang, type: "item", limit: "10" });
  const hits: any[] = s?.search ?? [];
  if (!hits.length) return null;
  const norm = (x: string | undefined) => (x ?? "").toLocaleLowerCase();
  const exact = new Set(hits.filter((x) => norm(x.label) === norm(t.city) || norm(x.match?.text) === norm(t.city)).map((x) => x.id as string));
  const e = await net.wikidata({ action: "wbgetentities", ids: hits.map((x) => x.id).join("|"), props: "claims|sitelinks" });
  let best: { id: string; it: any; links: number } | null = null;
  for (const h of hits) {
    const it = e?.entities?.[h.id];
    const co = claim(it, "P625")[0];
    if (!co || !exact.has(h.id)) continue;
    if (kmBetween(t, { lat: co.latitude, lon: co.longitude }) > WIKIDATA_MAX_KM) continue;
    const links = Object.keys(it.sitelinks ?? {}).length;
    if (!best || links > best.links) best = { id: h.id, it, links };
  }
  return best ? { id: best.id, it: best.it } : null;
}

async function byTitles(net: Net, titles: string[], tier: TownTier, origin: string): Promise<Cand[]> {
  if (!titles.length) return [];
  const r = await net.commons({ action: "query", titles: titles.map((x) => `File:${x}`).join("|"), ...INFO });
  return (r?.query?.pages ?? []).map((p: any) => toCand(net, p, tier, origin)).filter(Boolean);
}
async function bySearch(net: Net, q: string, tier: TownTier, origin: string, limit = 50): Promise<Cand[]> {
  const r = await net.commons({ action: "query", generator: "search", gsrnamespace: "6", gsrlimit: String(limit), gsrsearch: q, ...INFO });
  return (r?.query?.pages ?? []).map((p: any) => toCand(net, p, tier, origin)).filter(Boolean);
}
async function byGeo(net: Net, lat: number, lon: number, tier: TownTier, origin: string): Promise<Cand[]> {
  // Commons geosearch caps the radius at 10 km and (with extmetadata) the page count at 50.
  const r = await net.commons({ action: "query", generator: "geosearch", ggsnamespace: "6", ggscoord: `${lat}|${lon}`, ggsradius: "10000", ggslimit: "50", ...INFO });
  return (r?.query?.pages ?? []).map((p: any) => toCand(net, p, tier, origin)).filter(Boolean);
}

// ── the lead's own country for a fallback picture ─────────────────────────────

const countryMemo = new Map<string, string | null>();
let lastGeocode = 0;

/** ISO-2 country of a point (Nominatim, OSM's own service: ≤ 1 req/s, cached per ~5 km cell). */
export async function countryAtPoint(lat: number, lon: number): Promise<string | null> {
  const key = `${lat.toFixed(2)}|${lon.toFixed(2)}`;
  if (countryMemo.has(key)) return countryMemo.get(key)!;
  const wait = lastGeocode + 1100 - Date.now();
  if (wait > 0) await sleep(wait);
  lastGeocode = Date.now();
  const cc = (await reverseGeocode(lat, lon).catch(() => ({ country: undefined }))).country ?? null;
  countryMemo.set(key, cc);
  return cc;
}

/** The settlement a point lies in (Nominatim zoom 14: city / town / village / municipality), ≤ 1 req/s, cached. */
const settlementMemo = new Map<string, string | null>();
export async function settlementAtPoint(lat: number, lon: number): Promise<string | null> {
  const key = `${lat.toFixed(3)}|${lon.toFixed(3)}`;
  if (settlementMemo.has(key)) return settlementMemo.get(key)!;
  const wait = lastGeocode + 1100 - Date.now();
  if (wait > 0) await sleep(wait);
  lastGeocode = Date.now();
  let name: string | null = null;
  try {
    const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=14&lat=${lat}&lon=${lon}`, {
      headers: { "User-Agent": "citoviso-scraper/0.1 (+https://github.com/olaszferenc/citoviso)", Accept: "application/json" },
      signal: AbortSignal.timeout(10000),
    });
    if (r.ok) {
      const a = ((await r.json()) as { address?: Record<string, string> }).address ?? {};
      name = a.city ?? a.town ?? a.village ?? a.municipality ?? null;
    }
  } catch {
    name = null;
  }
  settlementMemo.set(key, name);
  return name;
}

const fold = (x: string): string => x.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

// ── the style of the place (which sample rooms fit) ───────────────────────────

const OVERPASS_HOSTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];

/** The sample-room style of a town alone (the backfill's --restyle): its Wikidata item, then the rule below. */
export async function townStyleOf(t: TownPickInput, wikidataId?: string): Promise<TownStyle> {
  const net = new Net();
  let it: any = null;
  if (wikidataId) it = (await net.wikidata({ action: "wbgetentities", ids: wikidataId, props: "claims" }))?.entities?.[wikidataId] ?? null;
  return styleOf(net, t, it, []);
}

async function styleOf(net: Net, t: TownPickInput, wd: any, accepted: readonly { s: TownScores; c: Cand }[]): Promise<TownStyle> {
  // Coast: an OSM coastline within 5 km (Overpass, free; four public instances, three rounds — on 2026-11-25 two timed out and one answered HTML). No answer
  // → not called a coast: a guess from the pictures took the Danube for a harbour (Budapest, 2026-11-25).
  // First the town's own Wikidata item: „located in or next to body of water” (P206) naming a sea, a bay,
  // a gulf, a strait or an ocean (Makarska → Adriatic Sea, a sea). Overpass only when Wikidata says nothing.
  const SEA_CLASSES = new Set(["Q165", "Q9430", "Q39594", "Q1322134", "Q37901", "Q1210", "Q166620", "Q31615"]);
  const waters = claim(wd, "P206").map((v: { id?: string }) => v.id).filter(Boolean) as string[];
  if (waters.length) {
    const e = await net.wikidata({ action: "wbgetentities", ids: waters.slice(0, 10).join("|"), props: "claims" });
    for (const id of waters) {
      if (claim(e?.entities?.[id], "P31").some((c: { id?: string }) => c.id && SEA_CLASSES.has(c.id))) return "mediterranean";
    }
  }
  let coast = false;
  const q = `[out:json][timeout:25];way["natural"="coastline"](around:5000,${t.lat},${t.lon});out ids 1;`;
  outer: for (const host of [...OVERPASS_HOSTS, ...OVERPASS_HOSTS, ...OVERPASS_HOSTS]) {
    for (let i = 0; i < 1; i++) {
      try {
        net.stats.apiCalls++;
        const r = await fetch(host, {
          method: "POST",
          headers: { "User-Agent": UA, "Content-Type": "application/x-www-form-urlencoded" },
          body: "data=" + encodeURIComponent(q),
          signal: AbortSignal.timeout(15000),
        });
        if (r.ok) {
          coast = (((await r.json()) as { elements?: unknown[] }).elements ?? []).length > 0;
          break outer;
        }
      } catch {
        // next try
      }
      await sleep(3000);
    }
  }
  void accepted;
  if (coast) return "mediterranean";
  const amount = (v: any): number => Number(String(v?.amount ?? "").replace(/^\+/, ""));
  let elevation = claim(wd, "P2044").map(amount).find((x) => Number.isFinite(x));
  if (elevation === undefined) {
    // No elevation on Wikidata (Mátraszentimre, ~700 m): the free OpenTopoData SRTM answer for the point.
    net.stats.apiCalls++;
    const j = await net.json(`https://api.opentopodata.org/v1/srtm90m?locations=${t.lat},${t.lon}`).catch(() => null);
    const e = Number(j?.results?.[0]?.elevation);
    if (Number.isFinite(e)) elevation = e;
  }
  if (elevation !== undefined && elevation >= 600) return "alpine";
  const pops = claim(wd, "P1082").map(amount).filter((x) => Number.isFinite(x));
  const population = pops.length ? Math.max(...pops) : undefined;
  if (population !== undefined && population >= 20000) return "urban";
  return "rural";
}

// ── the pick ─────────────────────────────────────────────────────────────────

function rankOf(s: TownScores, c: Cand): number {
  const subject = c.tier === "town" ? s.town + s.land : s.land;
  return 0.6 * subject + 0.4 * s.q + (c.quality ? 0.1 : 0) + (c.origin === "wikidata P18" ? 0.05 : 0) + brightBonus(s);
}

/** v2: a grey, overcast, washed-out picture goes back in the rank (Hegykő, 2026-11-25) — never out. */
export function brightBonus(s: TownScores): number {
  // v3: a frame of mostly empty sky goes back too (blind run 2026-11-25) — never out.
  return 0.25 * ((s.x.bright ?? 1) - 1) + 0.2 * ((s.x.skyfill ?? 1) - 1);
}

/**
 * v2: may this picture OPEN the page? A top-down, map-like aerial reads as no townscape (Sopron,
 * 2026-11-25) — it may stay in the gallery; an oblique aerial panorama (Primošten) opens fine.
 */
export function heroView(s: TownScores, tier: TownTier = "town"): boolean {
  return (s.x.aerial ?? 1) >= 0.3 && heroQuality(s, tier);
}

/** Plain countryside a hero must not be (v4): its best label is one of these and the town is hardly in it. */
const PLAIN_LAND = new Set(["a forest landscape", "green meadows and fields", "a wheat field under blue sky", "rolling hills countryside"]);

/**
 * v4 QUALITY FLOOR for the hero, calibrated on the two blind runs of 2026-11-25 (33 judged heroes, good / weak /
 * bad): a view at all (view ≥ 0.45 — the railway building of Dunaszekcső was 0.43, the lowest good one 0.46);
 * not a roof or tower top against the sky (roof ≥ 0.35 — Salomvár 0.34, the lowest good 0.39); not plain
 * countryside (a forest, a meadow, a wheat field, rolling hills with the town under 0.2 — 11 of the 20 weak
 * heroes, 1 of the 14 good). Below the floor no hero: the landscape around, the region, else no letter.
 */
export function heroQuality(s: TownScores, tier: TownTier = "town"): boolean {
  if ((s.x.view ?? 1) < 0.45) return false;
  if ((s.x.roof ?? 1) < 0.35) return false;
  // v5 dullness floor (3 blind runs, 54 judged heroes): CLIP „bright” under 0.05 — 2 weak, no good one lost.
  if ((s.x.bright ?? 1) < 0.05) return false;
  // Plain countryside never stands for the TOWN; as the landscape AROUND or of the region it may — when it is
  // bright and good (v5, coordinator 2026-11-25: a page must go on with the area's landscape, not a blank hero).
  if (PLAIN_LAND.has(s.top) && s.town < 0.2) return tier !== "town" && (s.x.bright ?? 1) >= 0.5 && s.q >= 0.6;
  return true;
}

/** The hot-link URL at a Wikimedia standard thumbnail width (960 / 1280 / 1920 — 1600 answers 400). */
function sizedUrl(c: Cand, hero: boolean): string {
  const w = hero && c.w >= 1920 ? 1920 : 1280;
  return c.thumb330.replace(/\/330px-/, `/${w}px-`);
}

/** Two pictures closer than this (dHash bits) are the same view — kept well above the send gate's own
 *  near-duplicate bar (samePicture.NEAR_DUP_BITS), since the gate hashes the page-size file, not the 330 px
 *  thumbnail (Balatonboglár, 2026-11-25: two shots of one series failed the gate as „the same picture”). */
const SAME_VIEW_BITS = NEAR_DUP_BITS + 6;

/**
 * Pick the town's pictures. Never throws for a network gap (fewer candidates → a lower tier or
 * „none”); throws only when the CLIP model is missing (nothing can be judged).
 */
export async function pickTownPhotos(t: TownPickInput): Promise<TownPickResult> {
  if (!photoKindAvailable()) throw new Error("a képfelismerő modell hiányzik ezen a gépen — a településkép nem választható");
  const t0 = Date.now();
  const net = new Net();
  const accepted: { c: Cand; s: TownScores; rank: number; km?: number; dhash?: string; buf: Buffer; verdict?: JudgeItem }[] = [];
  const seen = new Set<string>();

  const judge = async (cands: Cand[], max: number): Promise<void> => {
    const fresh = cands.filter((c) => !seen.has(c.title));
    for (const c of fresh) seen.add(c.title);
    fresh.sort((a, b) => Number(b.origin === "wikidata P18") - Number(a.origin === "wikidata P18") || Number(b.quality) - Number(a.quality));
    net.stats.candidates += fresh.length;
    const take = fresh.slice(0, max);
    for (const c of fresh.slice(max)) net.reject("nem pontozva (keret)");
    // Downloads 4 at a time, CLIP one by one.
    for (let i = 0; i < take.length; i += 4) {
      const bufs = await Promise.all(take.slice(i, i + 4).map((c) => net.buf(c.thumb330)));
      for (let k = 0; k < bufs.length; k++) {
        const c = take[i + k]!;
        const b = bufs[k];
        if (!b) {
          net.reject("letöltés sikertelen");
          continue;
        }
        const emb = await clipImageEmbedding(b);
        net.stats.clipRuns++;
        if (!emb) {
          net.reject("olvashatatlan");
          continue;
        }
        const s = scoreTownEmbedding(emb);
        const km = c.lat !== undefined && c.lon !== undefined ? +kmBetween(t, { lat: c.lat, lon: c.lon }).toFixed(1) : undefined;
        const why = townVerdict(s, c.tier, km);
        if (why) {
          net.reject(why);
          continue;
        }
        const dhash = await dHashFromBuffer(b).catch(() => undefined);
        accepted.push({ c, s, rank: rankOf(s, c), buf: b, ...(km !== undefined ? { km } : {}), ...(dhash ? { dhash } : {}) });
      }
      await sleep(150);
    }
  };

  // ① the town
  const wd = await wikidataTown(net, t);
  const c1: Cand[] = [];
  if (wd) {
    c1.push(...(await byTitles(net, claim(wd.it, "P18"), "town", "wikidata P18")));
    const cat = claim(wd.it, "P373")[0];
    if (cat) {
      let r = await bySearch(net, `deepcat:"${cat}" filew:>1199 filetype:bitmap`, "town", "Commons-kategória");
      if (!r.length) r = await bySearch(net, `incategory:"${cat}" filew:>1199 filetype:bitmap`, "town", "Commons-kategória");
      c1.push(...r);
    }
  }
  c1.push(...(await bySearch(net, `intitle:"${t.city}" filew:>1199 filetype:bitmap`, "town", "címkeresés")));
  c1.push(...(await bySearch(net, `"${t.city}" filew:>1199 filetype:bitmap`, "town", "szövegkeresés")));
  c1.push(...(await bySearch(net, `"${t.city}" incategory:"Quality_images"`, "town", "minőségi kép (QI)")));
  await judge(c1, 60);

  // v4 THE TOWN'S OWN PICTURE (coordinator 2026-11-25: 4 of 17 HR-checked heroes showed the NEXT village, inside
  // the 15 km GPS bar): a town-tier picture stays „the town” only when its coordinate falls in the lead's own
  // settlement (Nominatim, the OSM boundary — country-agnostic), or — without a coordinate — its title or
  // categories name the town. Else it may only stand as a LANDSCAPE of the area (the fallback rule, „környéke”).
  for (let i = accepted.length - 1; i >= 0; i--) {
    const a = accepted[i]!;
    if (a.c.tier !== "town") continue;
    let own: boolean;
    if (a.c.lat !== undefined && a.c.lon !== undefined) {
      const at = await settlementAtPoint(a.c.lat, a.c.lon);
      own = at === null ? namesTown(`${a.c.title} | ${a.c.cats}`, t.city) : fold(at) === fold(t.city) || namesTown(at, t.city);
    } else {
      own = namesTown(`${a.c.title} | ${a.c.cats}`, t.city);
    }
    if (own) continue;
    const asLand: Cand = { ...a.c, tier: "land" };
    const why = townVerdict(a.s, "land", a.km);
    if (why) {
      net.reject("másik település képe");
      accepted.splice(i, 1);
    } else {
      accepted[i] = { ...a, c: asLand, rank: rankOf(a.s, asLand) };
    }
  }

  const heroCount = () => accepted.filter((a) => a.c.w >= HERO_MIN_W && a.c.w >= a.c.h * HERO_MIN_RATIO && heroView(a.s, a.c.tier)).length;

  // ② the landscape around — ONLY when the town itself gave fewer than HEROES_WANT good heroes (coordinator
  // 2026-11-25, speed: the geosearch rings were ~40 % of a town's time and rarely changed the pick).
  let landDone = false;
  const collectLand = async (): Promise<void> => {
  if (landDone) return;
  landDone = true;
  const c2: Cand[] = [];
  const rings: [number, number][] = [[0, 0], [0.11, 0], [-0.11, 0], [0, 0.16], [0, -0.16]];
  for (const [dl, dg] of rings) c2.push(...(await byGeo(net, t.lat + dl, t.lon + dg, "land", dl || dg ? "környék ~12 km" : "környék 0–10 km")));
  // Own country only, from the picture's coordinate (a coordinate-less fallback picture is not taken).
  const own: Cand[] = [];
  for (const c of c2) {
    if (c.lat === undefined || c.lon === undefined) {
      net.reject("tartalék: nincs koordináta");
      continue;
    }
    own.push(c);
  }
  const before = accepted.length;
  await judge(own, 60);
  // The country check runs only on the accepted ones (few) — Nominatim is a shared service.
  for (let i = accepted.length - 1; i >= before; i--) {
    const a = accepted[i]!;
    const cc = await countryAtPoint(a.c.lat!, a.c.lon!);
    if (cc !== t.country.toUpperCase()) {
      net.reject("tartalék: másik ország");
      accepted.splice(i, 1);
    }
  }
  };
  if (heroCount() < HEROES_WANT) await collectLand();

  // ③ the region — only when no hero has turned up yet (and again when the judge found no good one, below).
  let regionDone = false;
  const collectRegion = async (): Promise<void> => {
  if (regionDone || !wd) return;
  regionDone = true;
  {
    const c3: Cand[] = [];
    let it = wd.it;
    for (let lvl = 0; lvl < 2 && it; lvl++) {
      const pid = claim(it, "P131")[0]?.id;
      if (!pid) break;
      const e = await net.wikidata({ action: "wbgetentities", ids: pid, props: "claims" });
      it = e?.entities?.[pid];
      if (!it || claim(it, "P297").length) break; // a whole country is too broad for „the region”
      c3.push(...(await byTitles(net, claim(it, "P18"), "region", `régió ${pid}`)));
      const cat = claim(it, "P373")[0];
      if (cat) {
        c3.push(...(await bySearch(net, `incategory:"${cat}" filew:>1599 filetype:bitmap`, "region", `régió-kategória ${pid}`, 30)));
        // v5: the region's LANDSCAPES across its whole category tree (a village with no picture of its own still
        // gets its area's best view — coordinator 2026-11-25, Fajsz / Biharugra / Csólyospálos).
        c3.push(...(await bySearch(net, `deepcat:"${cat}" (landscape OR panorama OR látkép OR táj OR krajolik OR Landschaft) filew:>1599 filetype:bitmap`, "region", `régió-tájkép ${pid}`, 50)));
      }
    }
    const before3 = accepted.length;
    await judge(c3, 60);
    for (let i = accepted.length - 1; i >= before3; i--) {
      const a = accepted[i]!;
      if (a.c.lat === undefined || a.c.lon === undefined) continue; // the region item itself vouches for it
      if ((await countryAtPoint(a.c.lat, a.c.lon)) !== t.country.toUpperCase()) {
        net.reject("tartalék: másik ország");
        accepted.splice(i, 1);
      }
    }
  }
  };
  if (heroCount() === 0) await collectRegion();

  // Order: the town before the landscape before the region, by rank inside a tier.
  const tierRank: Record<TownTier, number> = { town: 0, land: 1, region: 2 };
  let distinct: typeof accepted = [];
  const rebuild = (): void => {
    accepted.sort((a, b) => tierRank[a.c.tier] - tierRank[b.c.tier] || b.rank - a.rank);
    // One view once: a near-identical picture (same dHash within SAME_VIEW_BITS) of a better one leaves.
    distinct = [];
    for (const a of accepted) {
      const twin = distinct.some((d) => {
        const dist = a.dhash && d.dhash ? hashDistance(a.dhash, d.dhash) : null;
        return dist !== null && dist <= SAME_VIEW_BITS;
      });
      if (!twin) distinct.push(a);
    }
  };
  rebuild();
  const heroSized = (a: (typeof accepted)[number]): boolean => a.c.w >= HERO_MIN_W && a.c.w >= a.c.h * HERO_MIN_RATIO && heroView(a.s, a.c.tier);

  // v6 THE FINAL JUDGE (media/townJudge.ts, coordinator 2026-11-25): CLIP pre-filters, a subscription `claude -p`
  // image verdict decides — tier by tier (the town, then the landscape around, then the region), the CLIP top 6 of
  // a tier in ONE call. Only „jó” may open a page; no „jó” in any tier → no hero → the lead gets no letter.
  const judged = new Set<TownTier>();
  const goodOf = async (tier: TownTier): Promise<(typeof accepted)[number][]> => {
    const pool = distinct.filter((a) => a.c.tier === tier && heroSized(a)).slice(0, 6);
    if (!pool.length || judged.has(tier)) return pool.filter((a) => a.verdict?.verdict === "jó");
    judged.add(tier);
    const note = tier === "town" ? "A képek a település saját képei." : tier === "land" ? "A képek a település KÖRNYÉKÉNEK tájképei (a lapon „a környék tája” felirattal jelennek meg)." : "A képek a település RÉGIÓJÁNAK tájképei.";
    const r = await judgeTownCandidates(t.city, t.country, note, pool.map((a, i) => ({ id: `k${i + 1}`, buf: a.buf, title: a.c.title })));
    net.stats.judgeCostUsd = +((net.stats.judgeCostUsd ?? 0) + r.costUsd).toFixed(4);
    net.stats.judgeCalls = (net.stats.judgeCalls ?? 0) + 1;
    if (r.error) net.stats.judgeError = r.error;
    pool.forEach((a, i) => {
      const v = r.items.find((x) => x.id === `k${i + 1}`);
      if (v) a.verdict = v;
      net.reject(`bíró: ${v?.verdict ?? "nincs ítélet"}`);
    });
    return pool.filter((a) => a.verdict?.verdict === "jó");
  };
  let good = await goodOf("town");
  if (!good.length) {
    await collectLand();
    rebuild();
    good = await goodOf("land");
  }
  if (!good.length) {
    await collectRegion();
    rebuild();
    good = await goodOf("region");
  }

  const toPick = (a: (typeof accepted)[number], hero: boolean): TownPick => ({
    url: sizedUrl(a.c, hero),
    title: a.c.title.replace(/^File:/, ""),
    pageUrl: a.c.pageUrl,
    author: a.c.author,
    license: a.c.license,
    ...(a.c.licenseUrl ? { licenseUrl: a.c.licenseUrl } : {}),
    tier: a.c.tier,
    score: +a.rank.toFixed(3),
    ...(a.km !== undefined ? { km: a.km } : {}),
    bucket: a.s.bucket,
    ...(a.dhash ? { dhash: a.dhash } : {}),
    heroOk: hero && a.verdict?.verdict === "jó",
    ...(a.verdict ? { judge: { verdict: a.verdict.verdict, reason: a.verdict.reason.slice(0, 200) } } : {}),
  });

  // Heroes: ONLY the judge's „jó” pictures, in rank order (one tier — the first that had a good one).
  const heroPool = good;
  const heroes: typeof accepted = [];
  // At most 3 of one kind (5 harbour views of Makarska would make its leads' pages look alike).
  for (const a of heroPool) {
    if (heroes.length >= HEROES_MAX) break;
    if (heroes.length >= HEROES_WANT && a.c.tier !== heroes[0]!.c.tier) break;
    if (heroes.filter((h) => h.s.bucket === a.s.bucket).length >= 3 && heroPool.some((o) => !heroes.includes(o) && o !== a && o.c.tier === a.c.tier && heroes.filter((h) => h.s.bucket === o.s.bucket).length < 3)) continue;
    heroes.push(a);
  }
  // Gallery: the rest of the town and its landscape (never the region), round-robin over the buckets.
  // A picture the judge called „rossz” (it would pass for the lodging, a sign, a station…) stays off the gallery too.
  const rest = distinct.filter((a) => !heroes.includes(a) && a.c.tier !== "region" && a.verdict?.verdict !== "rossz");
  const order: GalleryBucket[] = ["strand", "square", "sight", "landscape"];
  const byBucket = new Map(order.map((b) => [b, rest.filter((a) => a.s.bucket === b)]));
  const gallery: typeof accepted = [];
  for (let round = 0; gallery.length < GALLERY_MAX && round < GALLERY_MAX; round++) {
    let added = false;
    for (const b of order) {
      const a = byBucket.get(b)![round];
      if (a && gallery.length < GALLERY_MAX) {
        gallery.push(a);
        added = true;
      }
    }
    if (!added) break;
  }

  const style = await styleOf(net, t, wd?.it, accepted);
  net.stats.seconds = Math.round((Date.now() - t0) / 1000);
  return {
    tier: heroes[0]?.c.tier ?? "none",
    heroes: heroes.map((a) => toPick(a, true)),
    gallery: gallery.map((a) => toPick(a, false)),
    style,
    ...(wd ? { wikidata: wd.id } : {}),
    stats: net.stats,
  };
}

/**
 * Re-screen a STORED set under the current rules without searching again (v1 → v2, 2026-11-25): each picture's
 * 330 px thumbnail is judged anew; the rejected leave, heroes are re-chosen (hero-sized, a view not a map)
 * and re-ranked with the brightness bonus, the rest fills the gallery round-robin. Network: one thumbnail
 * per picture (~12 per town).
 */
export async function rescreenTownPicks(
  heroes: readonly TownPick[],
  gallery: readonly TownPick[],
): Promise<{ heroes: TownPick[]; gallery: TownPick[]; dropped: { title: string; why: string }[] }> {
  const net = new Net();
  const kept: { p: TownPick; s: TownScores; score: number; hero: boolean }[] = [];
  const dropped: { title: string; why: string }[] = [];
  for (const p of [...heroes, ...gallery]) {
    if (BAD_FILE_NAME.test(`File:${p.title}`)) {
      dropped.push({ title: p.title, why: "fájlnév: tiltott téma" });
      continue;
    }
    const b = await net.buf(p.url.replace(/\/(?:960|1280|1920)px-/, "/330px-"));
    const emb = b ? await clipImageEmbedding(b) : null;
    if (!emb) {
      kept.push({ p, s: null as never, score: p.score, hero: p.heroOk });
      continue;
    }
    const s = scoreTownEmbedding(emb);
    const why = townVerdict(s, p.tier, p.km);
    if (why) {
      dropped.push({ title: p.title, why });
      continue;
    }
    const wasHeroSized = heroes.includes(p) || p.heroOk;
    kept.push({ p, s, score: p.score + brightBonus(s), hero: wasHeroSized && heroView(s, p.tier) });
    await sleep(100);
  }
  const tierRank: Record<TownTier, number> = { town: 0, land: 1, region: 2 };
  kept.sort((a, b) => tierRank[a.p.tier] - tierRank[b.p.tier] || b.score - a.score);
  const newHeroes: typeof kept = [];
  for (const k of kept.filter((x) => x.hero)) {
    if (newHeroes.length >= HEROES_MAX) break;
    if (newHeroes.length >= HEROES_WANT && k.p.tier !== newHeroes[0]!.p.tier) break;
    newHeroes.push(k);
  }
  const rest = kept.filter((k) => !newHeroes.includes(k) && k.p.tier !== "region");
  const order: GalleryBucket[] = ["strand", "square", "sight", "landscape"];
  const newGallery: typeof kept = [];
  for (let round = 0; newGallery.length < GALLERY_MAX && round < GALLERY_MAX; round++) {
    let added = false;
    for (const bk of order) {
      const k = rest.filter((x) => x.p.bucket === bk)[round];
      if (k && newGallery.length < GALLERY_MAX) {
        newGallery.push(k);
        added = true;
      }
    }
    if (!added) break;
  }
  const out = (k: (typeof kept)[number], hero: boolean): TownPick => ({ ...k.p, score: +k.score.toFixed(3), heroOk: hero });
  return { heroes: newHeroes.map((k) => out(k, true)), gallery: newGallery.map((k) => out(k, k.hero)), dropped };
}
