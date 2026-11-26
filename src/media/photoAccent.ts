// THE PROPERTY'S OWN COLOUR (§B.6, owner 2026-11-25: „eddig a mock generátorok tudtak egyedi színvilágot
// adni … ez a default színváltozat, 0 módosítással”). The accent used to come from the paid AI brief
// (generator/brief.ts); the free template generator never set `siteData.palette`, so every outreach mock
// wore its skin's stock accent. Here the accent is sampled LOCALLY from the property's own photos
// (sharp, no API, no cost): the dominant vivid hue across the hero and the next showcase photos.
// engine/palette.ts harmonizeAccent then keeps only its HUE inside the skin's contrast rails.
import sharp from "sharp";
import { PORTAL_USER_AGENT } from "../scraper/sources/portals/politeness.js";

const BINS = 24;
/** Photos sampled (hero first): enough for the property's colour, few enough to stay quick. */
const SAMPLE_PHOTOS = 4;

function rgbToHsv(r: number, g: number, b: number): [number, number, number] {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  if (d) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return [h, max ? d / max : 0, max / 255];
}

const hex = (n: number): string => Math.round(Math.max(0, Math.min(255, n))).toString(16).padStart(2, "0");

/**
 * The dominant vivid colour of a set of photo buffers, or null when nothing in them is colourful
 * enough (a grey facade under a grey sky keeps the skin's own accent). Pixels are weighted by
 * saturation × value; sky-blue that only fills the top of an outdoor shot counts like any other hue.
 */
export async function accentFromBuffers(bufs: readonly Buffer[]): Promise<string | null> {
  const weight = new Float64Array(BINS);
  const sum = Array.from({ length: BINS }, () => [0, 0, 0]);
  let total = 0;
  for (const buf of bufs) {
    let raw: Buffer;
    try {
      raw = await sharp(buf).rotate().removeAlpha().resize(64, 64, { fit: "cover" }).raw().toBuffer();
    } catch {
      continue;
    }
    for (let i = 0; i + 2 < raw.length; i += 3) {
      const r = raw[i]!;
      const g = raw[i + 1]!;
      const b = raw[i + 2]!;
      const [h, s, v] = rgbToHsv(r, g, b);
      total++;
      if (s < 0.25 || v < 0.2 || v > 0.97) continue;
      const w = s * v;
      const k = Math.floor(h / (360 / BINS)) % BINS;
      weight[k] += w;
      sum[k]![0]! += r * w;
      sum[k]![1]! += g * w;
      sum[k]![2]! += b * w;
    }
  }
  if (!total) return null;
  // Sky and lawn are in almost every outdoor shot. The house's OWN colour (roof, shutters, wood, a pool
  // wall) wins when it fills at least ~2 % of the pixels; otherwise the place's colour is the sea / the
  // sky / the garden — a fine accent for a lakeside or seaside lodging (measured 11-26: Makarska hotels
  // are blue, and a blue accent is right there). Below ~1.5 % of colour at all → no accent of its own.
  const isCommon = (k: number): boolean => {
    const h = (k + 0.5) * (360 / BINS);
    return (h >= 190 && h <= 230) || (h >= 70 && h <= 150);
  };
  let own = -1;
  let any = -1;
  for (let k = 0; k < BINS; k++) {
    if (any < 0 || weight[k]! > weight[any]!) any = k;
    if (!isCommon(k) && (own < 0 || weight[k]! > weight[own]!)) own = k;
  }
  const best = own >= 0 && weight[own]! >= total * 0.02 ? own : any;
  if (best < 0 || weight[best]! < total * 0.015) return null;
  const [r, g, b] = sum[best]!.map((c) => c / weight[best]!) as [number, number, number];
  return `#${hex(r)}${hex(g)}${hex(b)}`;
}

/** Fetch the first photos (hero first) and sample their accent. Null on no photo / no colour. */
export async function accentFromPhotoUrls(urls: readonly string[]): Promise<string | null> {
  const bufs: Buffer[] = [];
  for (const u of urls.slice(0, SAMPLE_PHOTOS)) {
    if (!/^https?:/i.test(u)) continue;
    try {
      const r = await fetch(u, { headers: { "user-agent": PORTAL_USER_AGENT }, signal: AbortSignal.timeout(15000) });
      if (r.ok) bufs.push(Buffer.from(await r.arrayBuffer()));
    } catch {
      // an unreachable photo just does not vote
    }
  }
  return bufs.length ? accentFromBuffers(bufs) : null;
}
