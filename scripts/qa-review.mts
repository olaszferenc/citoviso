// The quality colleague's tool (owner 2026-11-25, src/outreach/mockQaReview.ts).
//
//   npx tsx scripts/qa-review.mts queue [--limit 5]      → the next mocks to look at, with screenshots
//   npx tsx scripts/qa-review.mts shots <artifactId>      → screenshots of one mock
//   npx tsx scripts/qa-review.mts pass <artifactId> "<what you checked>"
//   npx tsx scripts/qa-review.mts fail <artifactId> "<what is wrong, where>"
//   npx tsx scripts/qa-review.mts status                  → counts
//
// `queue` lists the queued dispatch rows in send order (DISPATCH_PRIORITY) that the dispatcher would
// claim but for the look: ≥5 own photos, current generator, no valid review yet. Before shooting it
// runs the machine render gate — a mock that fails it needs regeneration, not eyes, and is listed
// apart. Screenshots land in sites/_qa-review/<artifactId>/: the opening at 3 moments of its
// animation, the page screen by screen at 390 px, and the letter's picture.
import { mkdir, readFile, copyFile, rm } from "node:fs/promises";
import path from "node:path";
import { sql } from "kysely";
import { chromium } from "playwright-core";
import sharp from "sharp";
import { config } from "../src/config.js";
import { db } from "../src/db/client.js";
import { DISPATCH_PRIORITY } from "../src/outreach/autoDispatch.js";
import { ensureHeroShot } from "../src/outreach/heroShot.js";
import { DISPATCH_PHOTOS_OK_SQL, MOCK_CURRENT_GENERATOR_SQL } from "../src/outreach/mockPhotoGate.js";
import { APPROVAL_PENDING_NOTE, QA_REVIEW_KEY, QA_WAIT_NOTE, qaReviewState, recordQaReview } from "../src/outreach/mockQaReview.js";
import { renderGateFor, renderGateReason } from "../src/outreach/mockRenderGate.js";
import { PORTAL_USER_AGENT } from "../src/scraper/sources/portals/politeness.js";

const OUT = path.resolve(process.cwd(), "sites/_qa-review");
const BY = process.env.QA_REVIEWER ?? "minőségi kolléga";
const MAX_SCREENS = 16;
/** Moments of the opening animation to shoot (wordmark-grow cycles photos for ~5 s, the gate splits at 0.45–4 s). */
const OPENING_MS = [1200, 3000, 5500] as const;

async function shots(artifactId: string): Promise<string[]> {
  const a = await db.selectFrom("mock_artifact").select(["path"]).where("id", "=", artifactId).executeTakeFirst();
  if (!a?.path) throw new Error("a mockhoz nincs fájl");
  const dir = path.join(OUT, artifactId);
  await rm(dir, { recursive: true, force: true });
  await mkdir(dir, { recursive: true });
  const files: string[] = [];
  const browser = await chromium.launch({ executablePath: config.chromiumPath });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
    await page.route("**/*", async (route) => {
      const url = route.request().url();
      if (route.request().resourceType() !== "image") return route.continue();
      if (url.startsWith("file:///assets/")) {
        const pub = path.resolve(process.cwd(), "public") + path.sep;
        const abs = path.resolve(pub, decodeURIComponent(url.slice("file:///".length)));
        if (!abs.startsWith(pub)) return route.abort();
        return route.fulfill({ status: 200, body: await readFile(abs).catch(() => Buffer.alloc(0)) });
      }
      if (/^https?:/.test(url)) {
        const r = await fetch(url, { headers: { "user-agent": PORTAL_USER_AGENT }, signal: AbortSignal.timeout(20000) }).catch(() => null);
        if (!r?.ok) return route.abort();
        return route.fulfill({ status: 200, contentType: r.headers.get("content-type") ?? "image/jpeg", body: Buffer.from(await r.arrayBuffer()) });
      }
      return route.continue();
    });
    await page.goto(`file://${path.resolve(process.cwd(), a.path)}`, { waitUntil: "domcontentloaded", timeout: 60000 });
    // The opening animation, as the lead sees it (wordmark-grow cycles photos, gate-opening splits).
    for (const [i, ms] of OPENING_MS.entries()) {
      await page.waitForTimeout(i === 0 ? ms : ms - OPENING_MS[i - 1]!);
      const f = path.join(dir, `0${i + 1}-nyitas-${ms}ms.png`);
      await page.screenshot({ path: f });
      files.push(f);
    }
    await page.waitForTimeout(3000);
    const height = await page.evaluate(() => document.documentElement.scrollHeight);
    const screens = Math.min(MAX_SCREENS, Math.ceil(height / 844));
    for (let s = 0; s < screens; s++) {
      await page.evaluate((y) => window.scrollTo(0, y), s * 844);
      await page.waitForTimeout(700);
      const f = path.join(dir, `${String(s + 10)}-kepernyo-${s + 1}.png`);
      await page.screenshot({ path: f });
      files.push(f);
    }
    if (Math.ceil(height / 844) > MAX_SCREENS) files.push(`(az oldal ${Math.ceil(height / 844)} képernyő; az első ${MAX_SCREENS} készült el)`);
  } finally {
    await browser.close();
  }
  const letter = await ensureHeroShot(artifactId).catch(() => null);
  let letterFile: string | null = null;
  if (letter) {
    letterFile = path.join(dir, `99-level-kepe${path.extname(letter)}`);
    await copyFile(letter, letterFile);
  }
  // Contact sheets — what the colleague Reads (2–3 images per mock instead of ~20); the single
  // screens stay beside them for a closer look.
  const sheets: string[] = [];
  const opening = files.filter((f) => f.includes("-nyitas-"));
  const top = [...opening, ...(letterFile ? [letterFile] : [])];
  sheets.push(await sheet(top, path.join(dir, "A-nyitas-es-level.png"), 640, top.length));
  const screens = files.filter((f) => f.includes("-kepernyo-"));
  for (let i = 0; i < screens.length; i += 8) {
    sheets.push(await sheet(screens.slice(i, i + 8), path.join(dir, `B-oldal-${i / 8 + 1}.png`), 500, 4));
  }
  if (!letterFile) sheets.push("⛔ a levél képe nem készült el — ez önmagában nem-jóváhagyás");
  const note = files.find((f) => f.startsWith("("));
  if (note) sheets.push(note);
  return sheets;
}

/** Tile images left to right, `perRow` per row, each scaled to `h` px high, 8 px gaps. */
async function sheet(inputs: string[], out: string, h: number, perRow: number): Promise<string> {
  const tiles = await Promise.all(inputs.map(async (f) => {
    const b = await sharp(f).resize({ height: h }).png().toBuffer();
    const m = await sharp(b).metadata();
    return { b, w: m.width ?? 0 };
  }));
  const rows: (typeof tiles)[] = [];
  for (let i = 0; i < tiles.length; i += perRow) rows.push(tiles.slice(i, i + perRow));
  const width = Math.max(1, ...rows.map((r) => r.reduce((a, t) => a + t.w + 8, 8)));
  const height = rows.length * (h + 8) + 8;
  const comps: sharp.OverlayOptions[] = [];
  rows.forEach((r, ri) => {
    let x = 8;
    for (const t of r) {
      comps.push({ input: t.b, left: x, top: 8 + ri * (h + 8) });
      x += t.w + 8;
    }
  });
  await sharp({ create: { width, height, channels: 3, background: "#777777" } }).composite(comps).png().toFile(out);
  return out;
}

async function queue(limit: number): Promise<void> {
  const rows = await db
    .selectFrom("outreach_dispatch")
    .innerJoin("mock_artifact as a", "a.id", "outreach_dispatch.artifact_id")
    .innerJoin("lead as l", "l.id", "outreach_dispatch.lead_id")
    .select(["outreach_dispatch.artifact_id as artifactId", "l.name as name", "a.inputs as inputs"])
    // Queued rows, and rows already on the owner's page whose mock changed since the pass (stale → look again).
    .where((eb) => eb.or([
      eb("outreach_dispatch.status", "=", "queued"),
      eb.and([eb("outreach_dispatch.status", "=", "held"), eb("outreach_dispatch.note", "in", [APPROVAL_PENDING_NOTE, QA_WAIT_NOTE])]),
    ]))
    .where(DISPATCH_PHOTOS_OK_SQL)
    .where(MOCK_CURRENT_GENERATOR_SQL)
    .orderBy(DISPATCH_PRIORITY)
    .orderBy("outreach_dispatch.queued_at")
    .limit(limit * 6)
    .execute();
  let shown = 0;
  for (const r of rows) {
    if (shown >= limit) break;
    const st = await qaReviewState(r.artifactId);
    if (st.state === "pass" || st.state === "fail") continue;
    const gate = await renderGateFor(r.artifactId);
    if (gate.verdict === "fail") {
      console.log(`\n⛔ ${r.artifactId} · ${r.name} — a gépi kapu megfogta, újragenerálás kell (nem a te dolgod): ${renderGateReason(gate)}`);
      continue;
    }
    shown++;
    console.log(`\n▶ ${r.artifactId} · ${r.name}${st.state === "stale" ? " (újra: a mock az előző átnézés óta változott)" : ""}`);
    for (const f of await shots(r.artifactId)) console.log(`   ${f}`);
  }
  if (!shown) console.log("Nincs átnézendő mock a sorban.");
}

async function status(): Promise<void> {
  const r = await db
    .selectFrom("outreach_dispatch")
    .innerJoin("mock_artifact as a", "a.id", "outreach_dispatch.artifact_id")
    .select([
      sql<string>`coalesce(a.inputs->${QA_REVIEW_KEY}->>'verdict', 'nincs')`.as("v"),
      sql<number>`count(*)::int`.as("n"),
    ])
    .where("outreach_dispatch.status", "=", "queued")
    .groupBy("v")
    .execute();
  console.log("Sorban (queued) a kolléga ítélete szerint:", Object.fromEntries(r.map((x) => [x.v, x.n])));
}

const [cmd, arg, ...rest] = process.argv.slice(2);
try {
  if (cmd === "queue") {
    const li = process.argv.indexOf("--limit");
    await queue(li > 0 ? Math.max(1, Number(process.argv[li + 1]) || 5) : 5);
  } else if (cmd === "shots" && arg) {
    for (const f of await shots(arg)) console.log(f);
  } else if ((cmd === "pass" || cmd === "fail") && arg) {
    const r = await recordQaReview(arg, cmd, rest.join(" "), BY);
    if (!r.ok) {
      console.error(`⛔ ${r.error}`);
      process.exitCode = 1;
    } else {
      console.log(`✅ ${cmd === "pass" ? "jóváhagyva" : "NEM jóváhagyva"}: ${arg}${r.held ? ` · ${r.held} sor visszatartva` : ""}${r.requeued ? ` · ${r.requeued} sor a tulaj jóváhagyó lapjára került` : ""}`);
    }
  } else if (cmd === "status") {
    await status();
  } else {
    console.error('Használat: qa-review.mts queue [--limit N] | shots <id> | pass <id> "<mit néztél>" | fail <id> "<mi a baj>" | status');
    process.exitCode = 2;
  }
} finally {
  await db.destroy();
}
