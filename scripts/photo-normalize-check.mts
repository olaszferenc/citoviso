/**
 * Guard: an owner's phone photo is CONVERTED on upload (src/tenant/photoUpload.ts).
 *
 * 2026-09-27: phone photos are 3–12 MB at 4000+ px; the 6 MB cap refused them
 * outright, and the ones that fit went out full-size over mobile data — with the
 * owner's GPS position in the EXIF. Now the browser downscales before sending and
 * the server normalizes whatever still arrives raw.
 *
 *  ① server: a 4000×3000 JPEG with EXIF orientation 6 + GPS → upright, ≤2560 px,
 *    no metadata; a transparent PNG keeps its alpha (webp); an already clean small
 *    JPEG is kept byte for byte; garbage throws (the route refuses it).
 *  ② browser: SHRINK_JS in real Chromium — the same big photo comes out as a JPEG
 *    within the edge cap and smaller; a small file is sent untouched.
 *  ③ the two admin pages that carry the uploader boot without a script error
 *    (the scripts are spliced strings — a stray quote breaks the whole page).
 *
 * Writes nothing. Run: npx tsx scripts/photo-normalize-check.mts
 */
process.env.PUBLIC_PORT = "0";
process.env.CIT_SHOT = "1";
// Dynamic imports: a static import would run before the env lines above (ESM hoisting).
const sharp = (await import("sharp")).default;
const { chromium } = await import("playwright-core");
const { config } = await import("../src/config.js");
const { normalizeUpload, SHRINK_JS, UPLOAD_MAX_EDGE } = await import("../src/tenant/photoUpload.js");

let failed = 0;
const ok = (cond: boolean, msg: string): void => {
  console.log(`${cond ? "PASS" : "FAIL"} ${msg}`);
  if (!cond) failed++;
};

// A noisy image compresses like a photo (a flat one would be a few KB at any size).
const noise = (w: number, h: number, channels: 3 | 4) => {
  const raw = Buffer.alloc(w * h * channels);
  for (let i = 0; i < raw.length; i++) raw[i] = (i * 2654435761) >>> 24;
  if (channels === 4) for (let i = 3; i < raw.length; i += 8) raw[i] = 0; // some transparent pixels
  return sharp(raw, { raw: { width: w, height: h, channels } });
};

const phone = await noise(4000, 3000, 3)
  .jpeg({ quality: 92 })
  .withMetadata({ orientation: 6, exif: { IFD3: { GPSLatitudeRef: "N", GPSLatitude: "47/1 29/1 0/1" } } })
  .toBuffer();

// ── ① server half
{
  const inMeta = await sharp(phone).metadata();
  ok(inMeta.orientation === 6 && Boolean(inMeta.exif), `fixture carries EXIF orientation 6 + GPS (${(phone.length / 1e6).toFixed(1)} MB)`);
  const out = await normalizeUpload(phone);
  const m = await sharp(out.data).metadata();
  ok(out.ext === "jpg" && m.format === "jpeg", `phone photo → jpg (${m.format})`);
  ok(m.width === 1920 && m.height === 2560, `rotated upright and capped at ${UPLOAD_MAX_EDGE}px (${m.width}×${m.height}, want 1920×2560)`);
  ok(!m.exif && !m.orientation, `EXIF/GPS stripped (exif=${Boolean(m.exif)}, orientation=${m.orientation})`);
  ok(out.data.length < phone.length, `smaller than the original (${out.data.length} < ${phone.length})`);

  const png = await noise(800, 600, 4).png().toBuffer();
  const p = await normalizeUpload(png);
  const pm = await sharp(p.data).metadata();
  ok(p.ext === "webp" && pm.hasAlpha === true, `transparent PNG keeps its alpha as webp (${p.ext}, alpha=${pm.hasAlpha})`);

  const clean = await noise(1200, 900, 3).jpeg({ quality: 85 }).toBuffer();
  const c = await normalizeUpload(clean);
  ok(c.data === clean, "an already clean small JPEG is kept byte for byte (no second re-encode)");

  let threw = false;
  try {
    await normalizeUpload(Buffer.from("not an image at all"));
  } catch {
    threw = true;
  }
  ok(threw, "garbage bytes throw (the route refuses the file)");
}

// ── ② + ③ browser half
const browser = await chromium.launch({ executablePath: config.chromiumPath });
try {
  const page = await browser.newPage();
  await page.setContent(`<script>${SHRINK_JS}</script>`);
  const shrink = (b64: string, type: string) =>
    page.evaluate(
      async ([b64, type]) => {
        const bytes = Uint8Array.from(atob(b64), (ch) => ch.charCodeAt(0));
        const f = new File([bytes], "x", { type });
        // @ts-expect-error — defined by SHRINK_JS in the page
        const out: Blob = await citShrink(f);
        const bmp = await createImageBitmap(out);
        return { same: out === f, type: out.type, size: out.size, w: bmp.width, h: bmp.height };
      },
      [b64, type] as const,
    );

  const big = await shrink(phone.toString("base64"), "image/jpeg");
  ok(!big.same && big.type === "image/jpeg", `browser converts the phone photo to JPEG (${big.type})`);
  ok(Math.max(big.w, big.h) === UPLOAD_MAX_EDGE, `browser caps the long edge at ${UPLOAD_MAX_EDGE}px (${big.w}×${big.h})`);
  ok(big.h > big.w, `browser keeps it upright (EXIF 6 → portrait: ${big.w}×${big.h})`);
  ok(big.size < phone.length, `browser output smaller (${(big.size / 1e6).toFixed(2)} MB < ${(phone.length / 1e6).toFixed(2)} MB)`);

  const small = await noise(640, 480, 3).jpeg({ quality: 80 }).toBuffer();
  const s = await shrink(small.toString("base64"), "image/jpeg");
  ok(s.same, "a small photo is sent untouched");

  // ③ the uploader pages boot clean
  const { server } = await import("../src/server/public.js");
  const { db } = await import("../src/db/client.js");
  const { mintTenantCookieValue } = await import("../src/auth/tenantAuth.js");
  try {
    if (!server.listening) await new Promise((r) => server.once("listening", r));
    const port = (server.address() as { port: number }).port;
    // The rooms page carries the uploader (and so the converter) only in its
    // card-grid editor, i.e. for a tenant with MORE THAN ONE unit (ADR-0198). An
    // arbitrary first tenant_user row made this assert depend on shared-DB order
    // and went red on main for a single-unit tenant — pick one that has the grid.
    const user = await db
      .selectFrom("tenant_user")
      .innerJoin("site", "site.tenant_id", "tenant_user.tenant_id")
      .innerJoin("site_unit", "site_unit.site_id", "site.id")
      .select("tenant_user.id")
      .groupBy("tenant_user.id")
      .having((eb) => eb.fn.count("site_unit.id"), ">", 1)
      .limit(1)
      .executeTakeFirstOrThrow(() => new Error("photo-normalize-check: no tenant with more than one unit in the DB — the rooms-grid route cannot be measured"));
    const ctx = await browser.newContext();
    await ctx.addCookies([{ name: "cit_session", value: mintTenantCookieValue(user.id), url: `http://127.0.0.1:${port}` }]);
    for (const route of ["/admin?tab=fotok", "/admin?tab=modulok&m=rooms"]) {
      const pg = await ctx.newPage();
      const errs: string[] = [];
      pg.on("pageerror", (e) => errs.push(e.message));
      const r = await pg.goto(`http://127.0.0.1:${port}${route}`);
      const html = await pg.content();
      ok(r?.status() === 200 && errs.length === 0, `${route} boots without a script error (status ${r?.status()}, errors ${JSON.stringify(errs)})`);
      ok(html.includes("function citShrink("), `${route} carries the browser converter`);
      await pg.close();
    }
  } finally {
    server.close();
    await db.destroy();
  }
} finally {
  await browser.close();
}

if (failed) {
  console.error(`photo-normalize-check: ${failed} FAIL`);
  process.exit(1);
}
console.log("photo-normalize-check: OK");
process.exit(0);
