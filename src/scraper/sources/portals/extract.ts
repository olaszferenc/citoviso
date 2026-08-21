// EXTRACTION — turn one portal listing page into structured accommodation facts.
//
// Three layers, best first, merged (never overwriting a stronger source):
//   1. schema.org JSON-LD (Hotel / LodgingBusiness / Accommodation / LocalBusiness).
//      This is the jackpot: booked.hu publishes description, 30+ image URLs,
//      amenityFeature[], containsPlace[] (HotelRoom with beds + amenities),
//      priceRange, checkinTime/checkoutTime, geo and the postal address.
//   2. OpenGraph / meta — thin but nearly universal (title, description, hero
//      image, coordinates, locality).
//   3. DOM/text — for the pre-structured-data stock (zimmerinfo.hu and every
//      town portal): headline, description paragraphs, gallery images, and the
//      amenity list that sits under a "Szolgáltatások" heading.
//
// §B.17 DISCIPLINE: every number this module emits carries the VERBATIM string
// it was read from (SourcedValue.evidence, PortalPrice.raw). Nothing is rounded,
// normalised into a nicer unit, or inferred from context. A fact we cannot quote
// is a fact we do not emit — "bizonytalanság → kevesebb, sosem hamis".

import type {
  PortalPhoto,
  PortalPrice,
  PortalRoom,
  SourcedValue,
} from "../../types.js";

/** Everything one page yielded, before the entity-match gate decides its fate. */
export interface ExtractedListing {
  title?: string;
  description?: string;
  rooms: PortalRoom[];
  roomCount?: SourcedValue<number>;
  capacity?: SourcedValue<number>;
  amenities: string[];
  prices: PortalPrice[];
  checkIn?: string;
  checkOut?: string;
  address?: string;
  street?: string;
  city?: string;
  postalCode?: string;
  country?: string;
  lat?: number;
  lon?: number;
  phone?: string;
  email?: string;
  rating?: number;
  reviewCount?: number;
  /** Image URLs + captions, absolute. Rights class is stamped by the caller. */
  images: { url: string; caption?: string; width?: number; height?: number }[];
  usedJsonLd: boolean;
  usedDom: boolean;
}

const MAX_DESCRIPTION = 4_000;
const MAX_IMAGES = 60;
const MAX_AMENITIES = 80;
const MAX_ROOMS = 30;
const MAX_PRICES = 12;

/* ---------------------------------------------------------------- helpers -- */

const ENTITIES: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", ndash: "–",
  mdash: "—", hellip: "…", eacute: "é", aacute: "á", oacute: "ó", uacute: "ú",
  iacute: "í", ouml: "ö", uuml: "ü", odblac: "ő", udblac: "ű",
};

export function decodeEntities(s: string): string {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h: string) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d: string) => String.fromCodePoint(Number(d)))
    .replace(/&([a-z]+);/gi, (m, name: string) => ENTITIES[name.toLowerCase()] ?? m);
}

/** Strip tags/scripts/styles and collapse whitespace — the page as plain text. */
export function textOf(html: string): string {
  return decodeEntities(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<!--[\s\S]*?-->/g, " ")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(p|div|li|tr|h[1-6])>/gi, "\n")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/[ \t ]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function clean(s: string | undefined, max = 500): string | undefined {
  if (!s) return undefined;
  const t = decodeEntities(s).replace(/\s+/g, " ").trim();
  return t ? t.slice(0, max) : undefined;
}

function absolute(url: string, base: string): string | null {
  try {
    return new URL(url.trim(), base).toString();
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------- JSON-LD ----- */

type JsonRecord = Record<string, unknown>;

function isRecord(v: unknown): v is JsonRecord {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/**
 * Every JSON-LD node on the page, flattened out of arrays and @graph wrappers,
 * IN DOCUMENT ORDER. Order matters: portals emit their own Organization/WebSite
 * boilerplate alongside the property node, and picking by position is part of
 * how the right one is found.
 */
export function jsonLdNodes(html: string): JsonRecord[] {
  const out: JsonRecord[] = [];
  const walk = (node: unknown): void => {
    if (Array.isArray(node)) {
      for (const child of node) walk(child);
    } else if (isRecord(node)) {
      out.push(node);
      if (Array.isArray(node["@graph"])) walk(node["@graph"]);
    }
  };
  const re = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  for (const m of html.matchAll(re)) {
    const body = m[1]!.replace(/^\s*\/\/<!\[CDATA\[|\]\]>\s*$/g, "").trim();
    try {
      walk(JSON.parse(body));
    } catch {
      continue; // malformed block — skip it, the other layers still run
    }
  }
  return out;
}

const LODGING_TYPES = new Set([
  "hotel", "lodgingbusiness", "bedandbreakfast", "resort", "motel", "hostel",
  "campground", "apartment", "accommodation", "house", "singlefamilyresidence",
  "vacationrental", "suite", "guesthouse", "touristattraction",
]);
/**
 * Types that MAY describe the property but often describe the portal instead.
 * `Organization` and `WebSite` are deliberately absent: on a listing page those
 * are the portal's own boilerplate, and picking them yielded "Hovamenjek.hu" as
 * the property name — which then scored 0 against the lead and silently dropped
 * a perfectly good listing.
 */
const WEAK_TYPES = new Set(["localbusiness", "place"]);

function typesOf(node: JsonRecord): string[] {
  const t = node["@type"];
  const arr = Array.isArray(t) ? t : [t];
  return arr.filter((x): x is string => typeof x === "string").map((x) => x.toLowerCase());
}

/** A node is only worth picking if it actually carries property-ish detail. */
function nodeDetail(node: JsonRecord): number {
  let score = 0;
  for (const key of ["address", "geo", "image", "telephone", "amenityFeature", "containsPlace", "priceRange", "description"]) {
    if (node[key] !== undefined && node[key] !== null && node[key] !== "") score++;
  }
  return score;
}

/**
 * The node that describes the PROPERTY. Lodging types win outright; among equals
 * the richest node wins, so a bare `{"@type":"Hotel","name":…}` stub cannot beat
 * the full record. Generic types are the last resort.
 */
export function pickLodgingNode(nodes: JsonRecord[]): JsonRecord | undefined {
  let best: { node: JsonRecord; rank: number; detail: number } | undefined;
  for (const n of nodes) {
    if (typeof n["name"] !== "string" && typeof n["description"] !== "string") continue;
    const types = typesOf(n);
    const rank = types.some((t) => LODGING_TYPES.has(t))
      ? 2
      : types.some((t) => WEAK_TYPES.has(t))
        ? 1
        : 0;
    if (rank === 0) continue;
    const detail = nodeDetail(n);
    if (!best || rank > best.rank || (rank === best.rank && detail > best.detail)) {
      best = { node: n, rank, detail };
    }
  }
  return best?.node;
}

function str(v: unknown): string | undefined {
  if (typeof v === "string") return clean(v, MAX_DESCRIPTION);
  if (typeof v === "number") return String(v);
  return undefined;
}

function num(v: unknown): number | undefined {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number(v.replace(",", ".").replace(/[^\d.-]/g, ""));
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}

/** schema.org `image` comes as string | string[] | ImageObject | ImageObject[]. */
function imagesFromNode(value: unknown, base: string): ExtractedListing["images"] {
  const out: ExtractedListing["images"] = [];
  const push = (v: unknown): void => {
    if (typeof v === "string") {
      const abs = absolute(v, base);
      if (abs) out.push({ url: abs });
    } else if (isRecord(v)) {
      const url = str(v["url"] ?? v["contentUrl"]);
      const abs = url ? absolute(url, base) : null;
      if (abs) {
        out.push({
          url: abs,
          caption: clean(str(v["caption"] ?? v["name"]), 200),
          width: num(v["width"]),
          height: num(v["height"]),
        });
      }
    }
  };
  if (Array.isArray(value)) value.forEach(push);
  else push(value);
  return out;
}

function amenitiesFromNode(value: unknown): string[] {
  const out: string[] = [];
  const arr = Array.isArray(value) ? value : [value];
  for (const a of arr) {
    if (typeof a === "string") {
      const c = clean(a, 80);
      if (c) out.push(c);
    } else if (isRecord(a)) {
      // LocationFeatureSpecification: only a TRUE feature is a fact about the
      // place; `value: false` states the opposite and must never be listed.
      if (a["value"] === false) continue;
      const name = clean(str(a["name"]), 80);
      if (name) out.push(name);
    }
  }
  return out;
}

function roomsFromNode(value: unknown): PortalRoom[] {
  const out: PortalRoom[] = [];
  const arr = Array.isArray(value) ? value : [value];
  for (const r of arr) {
    if (!isRecord(r)) continue;
    const types = typesOf(r);
    if (types.length && !types.some((t) => /room|suite|apartment|accommodation|house/.test(t))) {
      continue;
    }
    const name = clean(str(r["name"]), 160);
    const description = clean(str(r["description"]), 600);
    if (!name && !description) continue;
    const occupancy = isRecord(r["occupancy"])
      ? num((r["occupancy"] as JsonRecord)["maxValue"] ?? (r["occupancy"] as JsonRecord)["value"])
      : num(r["occupancy"]);
    out.push({
      name,
      description,
      capacity: occupancy && occupancy > 0 ? Math.round(occupancy) : undefined,
      // The HotelRoom description on booked.hu IS the bed layout ("2 egyszemélyes ágy").
      beds: description && /ágy|agy\b|bed/i.test(description) ? description : undefined,
      amenities: amenitiesFromNode(r["amenityFeature"]).slice(0, MAX_AMENITIES),
    });
    if (out.length >= MAX_ROOMS) break;
  }
  return out;
}

/**
 * Parse a money amount ONLY if it is written like money. Thousands separators
 * come in groups of three; decimals have one or two digits. Anything else is
 * not a price — a live run turned the page's longitude ("17.507631 $", the `$`
 * belonging to a script) into a 17-million forint room rate, which is precisely
 * the fabricated hard fact §B.17 forbids.
 */
export function parseAmount(raw: string): number | undefined {
  const s = raw.trim().replace(/ /g, " ");
  const grouped = /^\d{1,3}([ .]\d{3})+([.,]\d{1,2})?$/.test(s);
  const plain = /^\d+([.,]\d{1,2})?$/.test(s);
  if (!grouped && !plain) return undefined;
  const normalised = grouped
    ? s.replace(/[ .](?=\d{3}\b)/g, "").replace(",", ".")
    : s.replace(",", ".");
  const n = Number(normalised);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

/** Parse a schema.org priceRange ("30378 HUF - 50109 HUF") without losing the text. */
function priceFromRange(raw: string): PortalPrice {
  const numbers = [...raw.matchAll(/(\d[\d\s.,]*)/g)]
    .map((m) => parseAmount(m[1]!))
    .filter((n): n is number => n !== undefined);
  const currency = /HUF|Ft\b|EUR|€|USD|\$/i.exec(raw)?.[0];
  return {
    raw: raw.trim(),
    min: numbers.length ? Math.min(...numbers) : undefined,
    max: numbers.length > 1 ? Math.max(...numbers) : undefined,
    currency: currency ? currency.toUpperCase().replace("FT", "HUF").replace("€", "EUR") : undefined,
  };
}

export function fromJsonLd(html: string, pageUrl: string): Partial<ExtractedListing> | null {
  const node = pickLodgingNode(jsonLdNodes(html));
  if (!node) return null;

  const address = isRecord(node["address"]) ? (node["address"] as JsonRecord) : undefined;
  const geo = isRecord(node["geo"]) ? (node["geo"] as JsonRecord) : undefined;
  const rating = isRecord(node["aggregateRating"])
    ? (node["aggregateRating"] as JsonRecord)
    : undefined;
  const countryRaw = address?.["addressCountry"];
  const country = isRecord(countryRaw) ? str(countryRaw["name"]) : str(countryRaw);

  const priceRange = str(node["priceRange"]);
  const roomCountValue = num(node["numberOfRooms"]);
  const capacityValue = num(node["maximumAttendeeCapacity"] ?? node["occupancy"]);

  const street = clean(str(address?.["streetAddress"]), 200);
  const rawCity = clean(str(address?.["addressLocality"]), 120);
  const postalCode = clean(str(address?.["postalCode"]), 20);
  // White-label engines repeat the street in addressLocality (live case:
  // lake-balaton.com published addressLocality "Szőlőhegyi utca 45"). Publishing
  // that as the town would be a fabricated fact AND would fail the town match
  // against the real city — so an unusable locality becomes UNKNOWN, not wrong.
  const city = rawCity && rawCity !== street ? rawCity : undefined;

  return {
    title: clean(str(node["name"]), 200),
    description: clean(str(node["description"]), MAX_DESCRIPTION),
    // containsPlace only — `containedInPlace` is the REVERSE relation (the town
    // or resort this property sits in), and reading it as a room list would
    // publish a neighbouring entity as one of this property's units.
    rooms: roomsFromNode(node["containsPlace"]),
    // numberOfRooms: 0 is booked.hu's "not stated" — never publish it as a fact.
    roomCount:
      roomCountValue && roomCountValue > 0
        ? { value: Math.round(roomCountValue), evidence: `numberOfRooms: ${roomCountValue}` }
        : undefined,
    capacity:
      capacityValue && capacityValue > 0
        ? { value: Math.round(capacityValue), evidence: `schema.org occupancy: ${capacityValue}` }
        : undefined,
    amenities: amenitiesFromNode(node["amenityFeature"]).slice(0, MAX_AMENITIES),
    prices: priceRange ? [priceFromRange(priceRange)] : [],
    checkIn: clean(str(node["checkinTime"]), 40),
    checkOut: clean(str(node["checkoutTime"]), 40),
    address: [...new Set([street, postalCode, city].filter(Boolean))].join(", ") || undefined,
    street,
    city,
    postalCode,
    country: country ? country.slice(0, 60) : undefined,
    lat: num(geo?.["latitude"]),
    lon: num(geo?.["longitude"]),
    phone: clean(str(node["telephone"]), 40),
    email: clean(str(node["email"]), 120)?.toLowerCase(),
    rating: num(rating?.["ratingValue"]),
    reviewCount: num(rating?.["reviewCount"] ?? rating?.["ratingCount"]),
    images: imagesFromNode(node["image"], pageUrl).slice(0, MAX_IMAGES),
    usedJsonLd: true,
  };
}

/* ------------------------------------------------------------ OpenGraph ---- */

function metaMap(html: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const m of html.matchAll(/<meta\b[^>]*>/gi)) {
    const tag = m[0]!;
    const key =
      /(?:property|name)\s*=\s*["']([^"']+)["']/i.exec(tag)?.[1]?.toLowerCase();
    const value = /content\s*=\s*["']([^"']*)["']/i.exec(tag)?.[1];
    if (key && value && !out.has(key)) out.set(key, decodeEntities(value).trim());
  }
  return out;
}

export function fromOpenGraph(html: string, pageUrl: string): Partial<ExtractedListing> {
  const meta = metaMap(html);
  const image = meta.get("og:image");
  const abs = image ? absolute(image, pageUrl) : null;
  const lat = Number(meta.get("og:latitude") ?? meta.get("place:location:latitude") ?? "");
  const lon = Number(meta.get("og:longitude") ?? meta.get("place:location:longitude") ?? "");
  return {
    title: clean(meta.get("og:title") ?? meta.get("twitter:title"), 200),
    description: clean(
      meta.get("og:description") ?? meta.get("twitter:description") ?? meta.get("description"),
      MAX_DESCRIPTION,
    ),
    street: clean(meta.get("og:street-address"), 200),
    city: clean(meta.get("og:locality"), 120),
    postalCode: clean(meta.get("og:postal-code"), 20),
    country: clean(meta.get("og:country-name"), 60),
    phone: clean(meta.get("og:phone_number") ?? meta.get("business:contact_data:phone_number"), 40),
    lat: Number.isFinite(lat) && lat !== 0 ? lat : undefined,
    lon: Number.isFinite(lon) && lon !== 0 ? lon : undefined,
    images: abs
      ? [{ url: abs, width: Number(meta.get("og:image:width")) || undefined, height: Number(meta.get("og:image:height")) || undefined }]
      : [],
  };
}

/* ------------------------------------------------------------------ DOM ---- */

/**
 * Decoration that is never a photo OF the property. Two kinds: filename markers
 * (logo, flag, button) and UI ASSET PATHS — booking engines serve their static
 * chrome from /platform/ui/ and friends, which is how a "small_map" thumbnail
 * ended up in a gallery during the first live run.
 */
const NON_CONTENT_IMAGE =
  /(logo|icon|sprite|favicon|flag|fl_[a-z]+\.|banner|pixel|tracking|avatar|placeholder|no-image|nokep|button|btn[-_]|arrow|spinner|loader|badge|szepkartya|payment|social|facebook|instagram|small_map|staticmap|map_thumb|\/platform\/ui\/|\/ui\/global\/|\/assets\/ui\/|\/static\/ui\/|\/modules\/|\/templates?\/)/i;
const IMAGE_EXT = /\.(jpe?g|png|webp|avif)(\?|#|$)/i;

/**
 * Markers of the "you might also like" block every portal appends. Everything
 * after the first one belongs to OTHER businesses — during the first live run
 * this block put BuBis Apartman's and Majestic Apartmanház's thumbnails into
 * Korbély Apartman's gallery, i.e. a §F.17b misattribution of the worst kind
 * (another guesthouse's photos on this lead's mock).
 */
const RELATED_BLOCK =
  /(hasonló\s+szállás|hasonlo\s+szallas|similar-listing|similar_listing|similar-hotel|related-listing|related-item|ajánlott\s+szállás|ezt\s+is\s+megnézhet|önnek\s+ajánljuk|más\s+szálláshely|nearby-?hotels|other-?properties|wide-listings-list)/i;

/** The part of the page that is about THIS property — everything before the
 *  "similar listings" block. Returns the whole page when there is no such block. */
export function ownContentOnly(html: string): string {
  const m = RELATED_BLOCK.exec(html);
  if (!m || m.index < 500) return html; // a marker in the head/nav is not the block
  return html.slice(0, m.index);
}

/** Gallery/hero images from the markup: <img src|data-src|srcset> and <a href="…jpg">. */
export function domImages(html: string, pageUrl: string): ExtractedListing["images"] {
  const seen = new Set<string>();
  const out: ExtractedListing["images"] = [];
  const add = (raw: string | undefined, caption?: string): void => {
    if (!raw || out.length >= MAX_IMAGES) return;
    const first = raw.split(",")[0]!.trim().split(/\s+/)[0]!; // srcset → first candidate
    if (!first || first.startsWith("data:")) return;
    if (!IMAGE_EXT.test(first)) return;
    if (NON_CONTENT_IMAGE.test(first)) return;
    const abs = absolute(first, pageUrl);
    if (!abs || seen.has(abs)) return;
    seen.add(abs);
    out.push({ url: abs, caption: clean(caption, 200) });
  };

  for (const m of html.matchAll(/<img\b[^>]*>/gi)) {
    const tag = m[0]!;
    const alt = /alt\s*=\s*["']([^"']*)["']/i.exec(tag)?.[1];
    add(
      /\bdata-src\s*=\s*["']([^"']+)["']/i.exec(tag)?.[1] ??
        /\bsrc\s*=\s*["']([^"']+)["']/i.exec(tag)?.[1] ??
        /\bsrcset\s*=\s*["']([^"']+)["']/i.exec(tag)?.[1],
      alt,
    );
  }
  for (const m of html.matchAll(/<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>/gi)) {
    add(m[1]);
  }
  return out;
}

/**
 * The listing's own prose. Prefers containers portals actually use for it, then
 * falls back to the longest paragraphs on the page. Navigation, cookie banners
 * and "similar listings" blocks are short, so the length filter removes them.
 */
export function domDescription(html: string): string | undefined {
  const body = html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ");
  const marked = /<[^>]+class\s*=\s*["'][^"']*(full-description|description-text|listing-description|bemutatkozas|leiras|introduction)[^"']*["'][^>]*>([\s\S]{80,6000}?)<\/(?:div|p|section|article)>/i.exec(
    body,
  );
  if (marked) {
    // The container usually opens with its own heading ("… leírás",
    // "Bemutatkozás"); that is the portal's furniture, not the owner's copy.
    const t = textOf(marked[2]!).replace(
      /^[^\n]{0,120}?(leírás|leiras|bemutatkozás|bemutatkozas|ismertető|ismerteto)\s*\n+/i,
      "",
    );
    if (t.length >= 120) return t.trim().slice(0, MAX_DESCRIPTION);
  }
  const paragraphs = [...body.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)]
    .map((m) => textOf(m[1]!))
    .filter((t) => t.length >= 120);
  if (!paragraphs.length) return undefined;
  // Keep document order, longest-first selection would scramble the narrative.
  const best = paragraphs.slice(0, 6).join("\n\n");
  return best.length >= 120 ? best.slice(0, MAX_DESCRIPTION) : undefined;
}

const AMENITY_HEADING = /(szolgáltatás|szolgaltatas|felszerelt|ellátás|ellatas|amenit|kényelem|kenyelem)/i;

/**
 * Page furniture that sits in the same markup as the amenity list — a portal's
 * tab strip ("Bemutatkozás · Elérhetőségek · Értékelés · Szolgáltatások") is a
 * <ul> under a heading that matches, and its items would be published as
 * features of the property. They describe the PORTAL, not the place.
 */
const NON_AMENITY_ITEM =
  /^(bemutatkoz|elérhetőség|elerhetoseg|értékel|ertekel|vélemény|velemeny|szolgáltatások|szolgaltatasok|galéria|galeria|térkép|terkep|kapcsolat|ajánlat|ajanlat|csomagajánlat|csomagajanlat|árak|arak|foglal|online szállásfoglal|online szallasfoglal|nyitvatartás|nyitvatartas|leírás|leiras|hasonló|hasonlo|tovább|tovabb|vissza|kezdőlap|kezdolap|főoldal|fooldal|hírlevél|hirlevel|adatvédel|adatvedel|cookie|süti|suti)/i;

/**
 * Amenities from an explicit LIST that sits under an amenity heading. Deliberately
 * NOT a keyword sweep over the page text: "wifi" in a footer would become a
 * claimed feature, which is exactly the fabrication §B.17 forbids. A list item
 * under a "Szolgáltatások" heading is the portal ASSERTING the feature.
 */
export function domAmenities(html: string): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const headingRe = /<(h[1-6]|strong|dt|div|span)\b[^>]*>([^<]{3,60})<\/\1>/gi;
  for (const m of html.matchAll(headingRe)) {
    if (!AMENITY_HEADING.test(decodeEntities(m[2]!))) continue;
    const after = html.slice(m.index! + m[0]!.length, m.index! + m[0]!.length + 6_000);
    const list = /<(ul|ol|dl)\b[\s\S]*?<\/\1>/i.exec(after);
    if (!list) continue;
    for (const li of list[0]!.matchAll(/<(li|dd)\b[^>]*>([\s\S]*?)<\/\1>/gi)) {
      const t = textOf(li[2]!);
      if (t.length < 2 || t.length > 60) continue;
      if (NON_AMENITY_ITEM.test(t)) continue;
      const key = t.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(t);
      if (out.length >= MAX_AMENITIES) return out;
    }
  }
  return out;
}

// A published price: amount + currency, optionally with a unit. The verbatim
// match (plus a little context) is what gets stored.
const PRICE_RE =
  /(\d[\d\s. ]{2,})\s*(Ft|HUF|EUR|€|USD|\$)\s*(?:\/\s*([^\s,.;<]{2,20}))?/gi;

export function domPrices(text: string): PortalPrice[] {
  const out: PortalPrice[] = [];
  const seen = new Set<string>();
  for (const m of text.matchAll(PRICE_RE)) {
    const amount = parseAmount(m[1]!);
    // Not money-shaped, or too small to be a room rate ("2 Ft").
    if (amount === undefined || amount < 500) continue;
    const raw = m[0]!.replace(/\s+/g, " ").trim();
    const unit = clean(m[3], 20);
    // Dedupe on the VALUE, not on the string: a booking page prints the same
    // rate with and without a space ("30378HUF" / "30378 HUF"), and the list
    // would otherwise fill up with typographic variants of one number.
    const key = `${amount}|${m[2]!.toUpperCase()}|${unit ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const currency = m[2]!.toUpperCase().replace("FT", "HUF").replace("€", "EUR").replace("$", "USD");
    out.push({ raw, min: amount, currency, unit });
    if (out.length >= MAX_PRICES) break;
  }
  return out;
}

/** "6-8 fő", "4 fő részére" — only where the sentence is about accommodating guests. */
export function domCapacity(text: string): SourcedValue<number> | undefined {
  const re = /([^.\n]{0,80}?\b(\d{1,2})\s*(?:-|–|—|\s*(?:vagy|és)\s*)?\s*(\d{1,2})?\s*fő\b[^.\n]{0,80})/gi;
  for (const m of text.matchAll(re)) {
    const sentence = m[1]!.replace(/\s+/g, " ").trim();
    if (!/fér|elhelyez|befogad|szállás|szallas|vendég|vendeg|alkalmas|részére|reszere/i.test(sentence)) {
      continue;
    }
    const a = Number(m[2]);
    const b = m[3] ? Number(m[3]) : undefined;
    const value = Math.max(a, b ?? a);
    if (!Number.isFinite(value) || value < 1 || value > 200) continue;
    return { value, evidence: sentence.slice(0, 200) };
  }
  return undefined;
}

/** "4 szobával", "két apartman" is NOT counted — only digits, only with evidence. */
export function domRoomCount(text: string): SourcedValue<number> | undefined {
  const re = /([^.\n]{0,80}?\b(\d{1,2})\s*(?:db\s*)?(szoba|szobás|szobával|hálószoba|apartman|apartmannal)\b[^.\n]{0,80})/gi;
  for (const m of text.matchAll(re)) {
    const value = Number(m[2]);
    if (!Number.isFinite(value) || value < 1 || value > 200) continue;
    return { value, evidence: m[1]!.replace(/\s+/g, " ").trim().slice(0, 200) };
  }
  return undefined;
}

/** Check-in / check-out times as published. */
export function domCheckTimes(text: string): { checkIn?: string; checkOut?: string } {
  const inM = /(?:érkezés|erkezes|bejelentkezés|bejelentkezes|check.?in)[^.\n]{0,40}?(\d{1,2}[:.]\d{2}(?:\s*(?:-|–|—|tól|tol)\s*\d{1,2}[:.]\d{2})?)/i.exec(text);
  const outM = /(?:távozás|tavozas|kijelentkezés|kijelentkezes|check.?out)[^.\n]{0,40}?(\d{1,2}[:.]\d{2}(?:\s*(?:-|–|—|ig)\s*\d{1,2}[:.]\d{2})?)/i.exec(text);
  return {
    checkIn: inM ? inM[1]!.trim() : undefined,
    checkOut: outM ? outM[1]!.trim() : undefined,
  };
}

const H1_RE = /<h1\b[^>]*>([\s\S]{2,200}?)<\/h1>/i;

// Contact details as the pre-structured-data stock publishes them: a label and a
// value, in a table cell ("Cím: 8261 Badacsony, Római út 200. Telefon: +36/30/…").
const DOM_PHONE_RE =
  /(?:\+36|0036|06)[\s/().-]*\d{1,2}[\s/().-]*\d{3}[\s/().-]*\d{3,4}/;
const DOM_EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i;
const DOM_ADDRESS_RE = /\b(?:cím|cim|address|anschrift)\s*:?\s*([^\n|]{6,120})/i;

/** Phone from an explicit tel: link first — the owner's own declaration. */
export function domPhone(html: string, text: string): string | undefined {
  const tel = /tel:([+0-9\s()./-]{7,})/i.exec(html)?.[1];
  if (tel) return clean(tel, 40);
  return clean(DOM_PHONE_RE.exec(text)?.[0], 40);
}

export function domEmail(html: string, text: string): string | undefined {
  const mailto = /mailto:([^"'?>\s]+)/i.exec(html)?.[1];
  const value = mailto ? decodeURIComponent(mailto) : DOM_EMAIL_RE.exec(text)?.[0];
  return clean(value, 120)?.toLowerCase();
}

/** The postal address as written after a "Cím:" label. */
export function domAddress(text: string): string | undefined {
  const raw = clean(DOM_ADDRESS_RE.exec(text)?.[1], 160);
  // A label with no digits is a menu item ("Címek"), not an address.
  return raw && /\d/.test(raw) ? raw : undefined;
}

export function fromDom(html: string, pageUrl: string): Partial<ExtractedListing> {
  const text = textOf(html);
  const times = domCheckTimes(text);
  const description = domDescription(html);
  // CAPACITY and ROOM COUNT are read from the listing's own PROSE only, never
  // from the whole page. The booking widget on a portal page carries "Szobák és
  // Vendégek · 2 Vendég, 1 szoba" — the SEARCH FORM's default selection, which a
  // page-wide scan happily reported as "this property has 1 room". A number
  // lifted from a form control is not a fact about the property (§B.17), so
  // without prose we publish nothing.
  const address = domAddress(text);
  return {
    title: clean(H1_RE.exec(html)?.[1] ? textOf(H1_RE.exec(html)![1]!) : undefined, 200),
    description,
    address,
    street: address,
    phone: domPhone(html, text),
    email: domEmail(html, text),
    amenities: domAmenities(html),
    prices: domPrices(text),
    capacity: description ? domCapacity(description) : undefined,
    roomCount: description ? domRoomCount(description) : undefined,
    checkIn: times.checkIn,
    checkOut: times.checkOut,
    images: domImages(ownContentOnly(html), pageUrl),
    usedDom: true,
  };
}

/* ---------------------------------------------------------------- merge ---- */

function mergeInto(base: ExtractedListing, patch: Partial<ExtractedListing> | null): void {
  if (!patch) return;
  const scalars = [
    "title", "description", "checkIn", "checkOut", "address", "street", "city",
    "postalCode", "country", "phone", "email",
  ] as const;
  for (const key of scalars) {
    const v = patch[key];
    // A LONGER description from a weaker layer still wins: szallas24 truncates
    // its JSON-LD description at 160 chars while the full text sits in the DOM.
    if (typeof v !== "string" || !v) continue;
    const current = base[key];
    if (!current || (key === "description" && v.length > current.length)) {
      base[key] = v;
    }
  }
  for (const key of ["lat", "lon", "rating", "reviewCount"] as const) {
    const v = patch[key];
    if (typeof v === "number" && base[key] === undefined) base[key] = v;
  }
  for (const key of ["capacity", "roomCount"] as const) {
    const v = patch[key];
    if (v && base[key] === undefined) base[key] = v;
  }
  if (patch.rooms?.length && !base.rooms.length) base.rooms = patch.rooms.slice(0, MAX_ROOMS);
  if (patch.amenities?.length) {
    const seen = new Set(base.amenities.map((a) => a.toLowerCase()));
    for (const a of patch.amenities) {
      if (base.amenities.length >= MAX_AMENITIES) break;
      if (seen.has(a.toLowerCase())) continue;
      seen.add(a.toLowerCase());
      base.amenities.push(a);
    }
  }
  if (patch.prices?.length) {
    const seen = new Set(base.prices.map((p) => p.raw));
    for (const p of patch.prices) {
      if (base.prices.length >= MAX_PRICES) break;
      if (seen.has(p.raw)) continue;
      seen.add(p.raw);
      base.prices.push(p);
    }
  }
  if (patch.images?.length) {
    const seen = new Set(base.images.map((i) => i.url));
    for (const img of patch.images) {
      if (base.images.length >= MAX_IMAGES) break;
      if (seen.has(img.url)) continue;
      seen.add(img.url);
      base.images.push(img);
    }
  }
  if (patch.usedJsonLd) base.usedJsonLd = true;
  if (patch.usedDom) base.usedDom = true;
}

/**
 * Run all three layers over one page and merge them. JSON-LD first so its
 * asserted facts win; OpenGraph fills the gaps; DOM adds what neither published
 * (galleries, full prose, amenity lists, prices).
 */
export function extractListing(html: string, pageUrl: string): ExtractedListing {
  const base: ExtractedListing = {
    rooms: [],
    amenities: [],
    prices: [],
    images: [],
    usedJsonLd: false,
    usedDom: false,
  };
  mergeInto(base, fromJsonLd(html, pageUrl));
  mergeInto(base, fromOpenGraph(html, pageUrl));
  mergeInto(base, fromDom(html, pageUrl));
  return base;
}

/**
 * Stamp the §A.3 rights class onto the extracted images. This is THE point where
 * provenance is decided, and it is decided by WHERE THE BYTES CAME FROM: a
 * portal listing page → "portal", always, with the listing URL kept as the trail.
 * There is no parameter to override it — a caller cannot mislabel these.
 */
export function toPortalPhotos(
  images: ExtractedListing["images"],
  sourceUrl: string,
  portalHost: string,
): PortalPhoto[] {
  return images.map((img) => ({
    url: img.url,
    provenance: "portal",
    sourceUrl,
    portalHost,
    caption: img.caption,
    width: img.width,
    height: img.height,
  }));
}
