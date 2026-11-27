// TEXT BURNED INTO A PHOTO — a date stamp, a banner name, a shop sign (quality colleague, 2026-11-25:
// Virágeső's „2011/08/26” on several photos, Villa Aquamarine's giant „Villa Aquamarine Balatonboglár”
// across the hero, a „Schwarzkopf” sign at the edge of Ági Apartman's letter picture).
//
// HOW: Tesseract (tesseract.js, WebAssembly) runs here on the CPU — no API, no cost. The English
// „fast” model lives beside the CLIP model (models/tessdata/eng.traineddata, not in git); without it
// nothing is read and nothing is dropped (the colleague still looks at every page).
//
// What counts: a DATE STAMP anywhere. Measured 11-25 on the ten failed mocks' 143 photos: both
// Virágeső date stamps read, no false alarm. A large decorative overlay (Villa Aquamarine) or a sign
// at the edge (Schwarzkopf) Tesseract does NOT read reliably on a photo — those stay the colleague's
// eye (as do the CLIP „text” prompts, tried the same day: a plain lake scored above the overlay).
import { existsSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { createWorker, PSM, type Worker } from "tesseract.js";
import { config } from "../config.js";

export interface PhotoText {
  /** The date stamp read (2011/08/26, 26.08.2011 …), or null. */
  readonly dateStamp: string | null;
  /** Share of the picture covered by confident words (0–1). */
  readonly textArea: number;
  /** The confident words (for the operator log). */
  readonly words: readonly string[];
}

/** Word confidence (0–100) below which Tesseract's guess is noise on a photo. */
export const TEXT_MIN_CONFIDENCE = 75;
/** Width the photo is read at (a date stamp is ~2 % of the width: still legible). */
const READ_WIDTH = 1280;
// A camera date stamp: numeric (2011/08/26, 26.08.2011) or with a month name in either order (Janka Villa,
// 2026-11-26: „2021. aug. 13.” on a band photo passed every slot — the stamp was read, the pattern did not know
// month names). Hungarian and English abbreviations, with or without the dot.
const MONTH = "(?:jan|feb|m[áa]r|[áa]pr|m[áa]j|may|j[úu]n|j[úu]l|aug|sze?pt?|sep|okt|oct|nov|dec)[a-záéíóöőúüű]*\\.?";
const DATE_RE = new RegExp(
  `(?:19|20)\\d{2}\\s?[/.\\-]\\s?\\d{1,2}\\s?[/.\\-]\\s?\\d{1,2}` +
    `|\\d{1,2}\\s?[/.\\-]\\s?\\d{1,2}\\s?[/.\\-]\\s?(?:19|20)\\d{2}` +
    `|(?:19|20)\\d{2}\\.?\\s?${MONTH}\\s?\\d{1,2}\\b` +
    `|\\b\\d{1,2}\\.?\\s?${MONTH}\\s?(?:19|20)\\d{2}`,
  "i",
);

/**
 * A PARTIAL stamp at the picture's EDGE (ADR-0503 ⑩, quality colleague 11-27, Virágeső: a yellow „2011/” in the corner):
 * a year with its separator, read only in the corner pass — inside the picture a year alone is a sign or a plaque.
 */
const PARTIAL_DATE_RE = /(?:^|[^\d])((?:19|20)\d{2}\s?[/.\-]\s?(?:\d{1,2})?)(?=[^\d]|$)/;

function langDir(): string {
  return path.resolve(process.cwd(), path.dirname(config.photoKindModelPath), "tessdata");
}

export function photoTextAvailable(): boolean {
  return existsSync(path.join(langDir(), "eng.traineddata"));
}

let worker: Promise<Worker> | null = null;
function getWorker(): Promise<Worker> {
  worker ??= (async () => {
    const w = await createWorker("eng", 1, { langPath: langDir(), cacheMethod: "none", gzip: false, logger: () => undefined });
    await w.setParameters({ tessedit_pageseg_mode: PSM.SPARSE_TEXT, user_defined_dpi: "300" });
    return w;
  })();
  return worker;
}

/** Release the OCR worker (a script that read photos calls this before it exits). */
export async function closePhotoText(): Promise<void> {
  if (!worker) return;
  const w = await worker.catch(() => null);
  worker = null;
  await w?.terminate().catch(() => undefined);
}

// The OCR worker is a thread: left running it keeps a finished script alive. It stops itself after a
// short idle spell (an unref'd timer — the timer itself never holds the process).
const IDLE_MS = 4000;
let idle: NodeJS.Timeout | null = null;
let busy = 0;
function armIdle(): void {
  if (idle) clearTimeout(idle);
  idle = setTimeout(() => {
    if (busy === 0) void closePhotoText();
  }, IDLE_MS);
  idle.unref();
}

/** Read the text burned into a photo. Null when the model is missing or the bytes are not an image. */
export async function readPhotoText(buf: Buffer): Promise<PhotoText | null> {
  if (!photoTextAvailable()) return null;
  busy++;
  try {
    return await readPhotoTextNow(buf);
  } finally {
    busy--;
    armIdle();
  }
}

async function readPhotoTextNow(buf: Buffer): Promise<PhotoText | null> {
  let png: Buffer;
  let w = 0;
  let h = 0;
  try {
    const out = await sharp(buf).rotate().resize({ width: READ_WIDTH, withoutEnlargement: true }).greyscale().png().toBuffer({ resolveWithObject: true });
    png = out.data;
    w = out.info.width;
    h = out.info.height;
  } catch {
    return null;
  }
  const res = await (await getWorker()).recognize(png, {}, { blocks: true });
  const words: { text: string; area: number }[] = [];
  for (const b of res.data.blocks ?? []) {
    for (const p of b.paragraphs) {
      for (const l of p.lines) {
        for (const x of l.words) {
          const text = x.text.trim();
          // A real word: three or more letters/digits, read with confidence.
          if (x.confidence < TEXT_MIN_CONFIDENCE || (text.match(/[\p{L}\p{N}]/gu)?.length ?? 0) < 3) continue;
          words.push({ text, area: (x.bbox.x1 - x.bbox.x0) * (x.bbox.y1 - x.bbox.y0) });
        }
      }
    }
  }
  const all = (res.data.text ?? "").replace(/\s+/g, " ");
  const area = words.reduce((a, x) => a + x.area, 0) / Math.max(1, w * h);
  const full = DATE_RE.exec(all)?.[0] ?? null;
  return { dateStamp: full ?? (await readCornerStamp(buf)), textArea: +area.toFixed(4), words: words.map((x) => x.text) };
}

/** The corner a camera prints its stamp in: this share of the width × height, each corner. */
const CORNER_W = 0.45;
const CORNER_H = 0.25;
/** The corner is read this much larger (a 2 % stamp becomes ~40 px tall). */
const CORNER_SCALE = 2.5;

/**
 * THE SECOND PASS ON THE CORNERS (ADR-0503 ⑩). A yellow / orange camera stamp on grass or foliage is a weak contrast in
 * greyscale (Virágeső: „2011/06/17” read on no photo). In the R − B channel it is bright (R high, B low) while grass,
 * sky and walls are dark or mid. Each corner: cut, enlarge, R − B stretched and inverted (dark text on light for
 * Tesseract), read; a full date or a partial one (year + separator) counts.
 */
async function readCornerStamp(buf: Buffer): Promise<string | null> {
  let img: { data: Buffer; info: { width: number; height: number; channels: number } };
  try {
    img = await sharp(buf).rotate().resize({ width: READ_WIDTH, withoutEnlargement: true }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  } catch {
    return null;
  }
  const { width: W, height: H, channels: C } = img.info;
  const cw = Math.round(W * CORNER_W);
  const ch = Math.round(H * CORNER_H);
  const corners = [
    [W - cw, H - ch],
    [0, H - ch],
    [W - cw, 0],
    [0, 0],
  ] as const;
  const worker = await getWorker();
  for (const [x0, y0] of corners) {
    const out = Buffer.alloc(cw * ch);
    for (let y = 0; y < ch; y++) {
      for (let x = 0; x < cw; x++) {
        const i = ((y0 + y) * W + (x0 + x)) * C;
        const yellow = Math.min(img.data[i]!, img.data[i + 1]!) - img.data[i + 2]!;
        // stretched: a stamp's ~150–230 becomes white, foliage's ~0–80 black; inverted below
        out[y * cw + x] = 255 - Math.max(0, Math.min(255, (yellow - 90) * 2));
      }
    }
    const png = await sharp(out, { raw: { width: cw, height: ch, channels: 1 } })
      .resize({ width: Math.round(cw * CORNER_SCALE) })
      .png()
      .toBuffer();
    const r = await worker.recognize(png);
    const text = (r.data.text ?? "").replace(/\s+/g, " ");
    const hit = DATE_RE.exec(text)?.[0] ?? PARTIAL_DATE_RE.exec(text)?.[1] ?? null;
    if (hit) return hit.trim();
  }
  return null;
}

/**
 * LABELS PAINTED ONTO A PHOTO (ADR-0505 ㉒, Reljic feb441b0: rotated tags „A2(2+2)”, „A5(2+1)” over the facade). They are
 * tilted, so the horizontal pass reads nothing; read again turned ±28° at 2000 px. A label is a unit / bed-configuration
 * token: digit + digit („2+2”) or a capital with digits before a bracket („A2(”), read with ≥ 60 confidence.
 * Measured 11-27: Reljic caught at +28°, 60 live heroes 0 false alarms. Used for the HERO only (three OCR runs).
 */
const LABEL_TOKEN = /\d\s?\+\s?\d|^[A-Z]\d{1,2}\(/;
export async function readOverlayLabels(buf: Buffer): Promise<string[] | null> {
  if (!photoTextAvailable()) return null;
  busy++;
  try {
    const worker = await getWorker();
    const hits: string[] = [];
    for (const deg of [0, 28, -28]) {
      let png: Buffer;
      try {
        png = await sharp(buf).rotate().resize({ width: 2000 }).rotate(deg, { background: "#808080" }).greyscale().png().toBuffer();
      } catch {
        return null;
      }
      const res = await worker.recognize(png, {}, { blocks: true });
      for (const b of res.data.blocks ?? []) for (const p of b.paragraphs) for (const l of p.lines) for (const x of l.words) {
        const t = x.text.trim();
        if (x.confidence >= 60 && LABEL_TOKEN.test(t)) hits.push(t);
      }
      if (hits.length) break;
    }
    return hits;
  } finally {
    busy--;
    armIdle();
  }
}
