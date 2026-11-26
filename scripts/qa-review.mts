// The quality colleague's tool (owner 2026-11-25, src/outreach/mockQaReview.ts).
//
//   npx tsx scripts/qa-review.mts queue [--limit 5]      → the next mocks to look at, with screenshots
//   npx tsx scripts/qa-review.mts shots <artifactId>      → screenshots of one mock
//   npx tsx scripts/qa-review.mts pass <artifactId> "<what you checked>"
//   npx tsx scripts/qa-review.mts fail <artifactId> "<what is wrong, where>"
//   npx tsx scripts/qa-review.mts status                  → counts
//   npx tsx scripts/qa-review.mts heroes <artifactId>     → the hero candidates as one numbered contact sheet
//   npx tsx scripts/qa-review.mts hero <artifactId> <n> "<why>" → YOUR hero choice: pinned to the lead, both
//                                                            plans re-rendered by the pipeline, then review them
//
// THE HERO IS THE COLLEAGUE'S PICK (owner 2026-11-25: „hogy tudja megítélni … mi a legjobb wow hatású kép?”
// → the colleague's eye, not a formula): the machine leaves out what can never open a page (kitchen,
// bathroom, close-up, dark, blurred, small); the colleague picks the most striking of the rest — a sunset
// over the lake is a fine hero, the house need not show. The queue asks for the pick before the review.
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
import { secondPlanOf } from "../src/outreach/secondPlan.js";
import { APPROVAL_PENDING_NOTE, QA_REVIEW_KEY, QA_WAIT_NOTE, qaReviewState, recordQaReview } from "../src/outreach/mockQaReview.js";
import { renderGateFor, renderGateReason } from "../src/outreach/mockRenderGate.js";
import { PORTAL_USER_AGENT } from "../src/scraper/sources/portals/politeness.js";
import { classifyPhotoUrl, isHeroCandidate } from "../src/media/photoKind.js";
import { getHeroPin, setHeroPin } from "../src/generator/heroOverride.js";
import { refreshMock } from "../src/generator/mockRefresh.js";

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


const HERO_PICK_PREFIX = "minőségi kolléga";

/** The hero candidates of a mock, in a stable order (the pick refers to their numbers). */
async function heroCandidates(artifactId: string): Promise<{ leadId: string; urls: string[] }> {
  const a = await db.selectFrom("mock_artifact").select(["lead_id", "inputs"]).where("id", "=", artifactId).executeTakeFirst();
  if (!a) throw new Error("nincs ilyen mock");
  const photos = (((a.inputs as { siteData?: { photos?: { url: string; stock?: boolean }[] } } | null)?.siteData?.photos) ?? []).filter((p) => !p.stock);
  const urls: string[] = [];
  for (const p of photos) {
    const v = await classifyPhotoUrl(p.url);
    if (v && !isHeroCandidate(v)) continue;
    // (size: isHeroCandidate → heroSized, 1000 × 700 px — the moving cover's floor, 11-26)
    urls.push(p.url);
  }
  // A STABLE numbering (11-26, quality colleague 4, Várlak: after a pick the pinned photo moved to place 1, and a
  // second pick by the old sheet's number chose another photo) — by URL, independent of the current hero.
  urls.sort();
  return { leadId: a.lead_id, urls };
}

async function heroes(artifactId: string): Promise<void> {
  const { urls } = await heroCandidates(artifactId);
  if (!urls.length) {
    console.log("⛔ nincs nyitóképnek alkalmas fotó (minden kép konyha/fürdő/közeli/sötét/kicsi) — ez a mock így nem mehet ki: fail");
    return;
  }
  const dir = path.join(OUT, artifactId);
  await mkdir(dir, { recursive: true });
  const tiles: string[] = [];
  for (const [i, u] of urls.entries()) {
    const r = await fetch(u, { headers: { "user-agent": PORTAL_USER_AGENT } }).catch(() => null);
    if (!r?.ok) continue;
    const img = await sharp(Buffer.from(await r.arrayBuffer())).rotate().resize({ height: 360 }).png().toBuffer();
    const m = await sharp(img).metadata();
    const label = Buffer.from(`<svg width="${m.width}" height="360"><rect x="0" y="0" width="64" height="52" fill="#000" fill-opacity=".75"/><text x="32" y="38" font-size="34" font-family="sans-serif" font-weight="700" fill="#fff" text-anchor="middle">${i + 1}</text></svg>`);
    const f = path.join(dir, `H-${String(i + 1).padStart(2, "0")}.png`);
    await sharp(img).composite([{ input: label, left: 0, top: 0 }]).toFile(f);
    tiles.push(f);
    console.log(`  ${i + 1}: ${u.split(/[?#]/)[0]!.split("/").pop()}`);
  }
  for (let i = 0; i < tiles.length; i += 6) console.log(await sheet(tiles.slice(i, i + 6), path.join(dir, `H-nyitokep-jeloltek-${i / 6 + 1}.png`), 360, 3));
  console.log(`\nVálaszd a legütősebbet (wow): qa-review.mts hero ${artifactId} <szám> "<miért>"`);
}

async function hero(artifactId: string, n: number, why: string): Promise<void> {
  const { leadId, urls } = await heroCandidates(artifactId);
  const url = urls[n - 1];
  if (!url) throw new Error(`nincs ${n}. jelölt (1–${urls.length})`);
  await setHeroPin(leadId, url, `${HERO_PICK_PREFIX}: ${why.trim() || "wow"}`.slice(0, 300));
  // The pipeline re-renders BOTH plans with the pinned hero (generator/mockRefresh.ts) — the colleague then
  // reviews the new files (the old reviews are stale by mtime).
  const plans = [artifactId];
  const alt = await secondPlanOf(leadId, artifactId);
  if (alt) plans.push(alt.id);
  for (const id of plans) {
    const row = await db.selectFrom("mock_artifact").select(["id", "lead_id", "path", "inputs", "generated_at"]).where("id", "=", id).executeTakeFirst();
    if (row) await refreshMock(row, { backupDir: path.resolve(process.cwd(), "sites/_mock-refresh-backup") });
  }
  console.log(`✅ nyitókép rögzítve (${n}. jelölt), ${plans.length} terv újrarenderelve — most nézd át őket: shots <id>`);
}

async function queue(limit: number, half: "0-7" | "8-f" | null = null, shard: { k: number; n: number } | null = null): Promise<void> {
  const rows = await db
    .selectFrom("outreach_dispatch")
    .innerJoin("mock_artifact as a", "a.id", "outreach_dispatch.artifact_id")
    .innerJoin("lead as l", "l.id", "outreach_dispatch.lead_id")
    .select(["outreach_dispatch.artifact_id as artifactId", "outreach_dispatch.lead_id as leadId", "l.name as name", "a.inputs as inputs"])
    // Queued rows, and rows already on the owner's page whose mock changed since the pass (stale → look again).
    .where((eb) => eb.or([
      eb("outreach_dispatch.status", "=", "queued"),
      eb.and([eb("outreach_dispatch.status", "=", "held"), eb("outreach_dispatch.note", "in", [APPROVAL_PENDING_NOTE, QA_WAIT_NOTE])]),
    ]))
    .where(DISPATCH_PHOTOS_OK_SQL)
    .where(MOCK_CURRENT_GENERATOR_SQL)
    // A HALF-DONE OFFER FIRST (owner 2026-11-26: „ha megvan egy leadnek az egyik terve, akkor a másikkal folytassuk”):
    // a lead one of whose plans the colleague already passed goes to the front — its other plan finishes the offer.
    .orderBy(sql`exists (select 1 from mock_artifact m where m.lead_id = outreach_dispatch.lead_id and m.inputs->'qaReview'->>'verdict' = 'pass') desc`)
    .orderBy(DISPATCH_PRIORITY)
    .orderBy("outreach_dispatch.queued_at")
    .limit(limit * 12)
    .execute();
  let shown = 0;
  // Two colleagues share the queue (owner 2026-11-26: „LEGYEN MÁSODIK KOLLÉGA”): --half 0-7 | 8-f keeps each to the
  // rows whose MAIN plan id starts with its half — no row is rendered or judged twice.
  // --shard k/n (more colleagues, owner 2026-11-26: „a 25 is nagyon kevés”): the main plan id's first hex digit mod n.
  const inHalf = (id: string): boolean =>
    shard ? parseInt(id[0] ?? "0", 16) % shard.n === shard.k - 1 : !half || (/^[0-7]/i.test(id) ? half === "0-7" : half === "8-f");
  for (const r of rows) {
    if (shown >= limit) break;
    if (!inHalf(r.artifactId)) continue;
    // Both plans of the offer (owner 2026-11-25: „Csak az hagyható jóvá, ahol van második terv is.”) —
    // the second plan once the folyamat refreshed it with the current generator.
    // The hero first — the colleague's pick (owner 2026-11-25).
    const pin = await getHeroPin(r.leadId).catch(() => null);
    if (!pin?.actor.startsWith(HERO_PICK_PREFIX)) {
      if (shown >= limit) break;
      shown++;
      console.log(`\n⭐ ${r.artifactId} · ${r.name} — előbb a nyitókép: qa-review.mts heroes ${r.artifactId}`);
      continue;
    }
    const alt = await secondPlanOf(r.leadId, r.artifactId);
    const plans: { id: string; label: string }[] = [{ id: r.artifactId, label: "1. terv" }];
    if (alt?.current) plans.push({ id: alt.id, label: "2. terv" });
    else if (!alt) console.log(`\n⏭ ${r.name} — nincs második terv, a megkeresés így nem mehet ki (nem a te dolgod)`);
    for (const pl of plans) {
      if (shown >= limit) break;
      const st = await qaReviewState(pl.id);
      if (st.state === "pass" || st.state === "fail") continue;
      const gate = await renderGateFor(pl.id);
      if (gate.verdict === "fail") {
        console.log(`\n⛔ ${pl.id} · ${r.name} (${pl.label}) — a gépi kapu megfogta, újragenerálás kell (nem a te dolgod): ${renderGateReason(gate)}`);
        continue;
      }
      shown++;
      console.log(`\n▶ ${pl.id} · ${r.name} (${pl.label})${st.state === "stale" ? " (újra: a mock az előző átnézés óta változott)" : ""}`);
      for (const f of await shots(pl.id)) console.log(`   ${f}`);
    }
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
    const hi = process.argv.indexOf("--half");
    const half = hi > 0 && (process.argv[hi + 1] === "0-7" || process.argv[hi + 1] === "8-f") ? (process.argv[hi + 1] as "0-7" | "8-f") : null;
    const si = process.argv.indexOf("--shard");
    const sm = si > 0 ? /^(\d+)\/(\d+)$/.exec(process.argv[si + 1] ?? "") : null;
    const shard = sm && Number(sm[1]) >= 1 && Number(sm[1]) <= Number(sm[2]) && Number(sm[2]) <= 16 ? { k: Number(sm[1]), n: Number(sm[2]) } : null;
    await queue(li > 0 ? Math.max(1, Number(process.argv[li + 1]) || 5) : 5, half, shard);
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
  } else if (cmd === "heroes" && arg) {
    await heroes(arg);
  } else if (cmd === "hero" && arg && rest[0]) {
    await hero(arg, Number(rest[0]), rest.slice(1).join(" "));
  } else if (cmd === "status") {
    await status();
  } else {
    console.error('Használat: qa-review.mts queue [--limit N] [--half 0-7|8-f | --shard k/n] | shots <id> | pass <id> "<mit néztél>" | fail <id> "<mi a baj>" | status | heroes <id> | hero <id> <n> "<miért>"');
    process.exitCode = 2;
  }
} finally {
  await db.destroy();
}
