// Records the REAL tenant-admin portal-calendar flow (local dev server, in-process).
// Only the portal's HTTPS answer is stubbed (no portal account): https.get for the
// portal hosts returns a calendar with future booked nights.
import https from "node:https";
import { PassThrough } from "node:stream";
import { once } from "node:events";
import path from "node:path";
import { mkdir, rename, readdir, writeFile } from "node:fs/promises";
// @ts-ignore
import { clip } from "./voice.mjs";

// Run from the repo root (dev machine, local DB): see README.md here.
const R = process.cwd();
const HERE = path.dirname(new URL(import.meta.url).pathname);
const OUT = process.env.OUT ?? path.join(R, "public/assets/help/portal-naptar/_rec");
const UNIT_NAME = "Kisházi szoba";
const PORTAL = process.env.PORTAL ?? "Booking.com";
const URLS: Record<string, string> = {
  "Booking.com": "https://ical.booking.com/v1/export?t=7c1e0b9a-4f2d-4a8e-9b61-2d5f0c8e1a77",
  "Szállás.hu": "https://szallas.hu/ical-sync/export/get-calendar?token=a7f3c9e2d14b8e6f",
  "Airbnb": "https://www.airbnb.hu/calendar/ical/55128734.ics?s=3f9a1c7e5b2d4e6f8a0c",
};
const KEY = ({"Booking.com":"booking","Szállás.hu":"szallas","Airbnb":"airbnb"} as any)[PORTAL];
const FAKE_HOSTS = ["ical.booking.com", "szallas.hu", "www.airbnb.hu"];
function ics(): string {
  const d = (off: number) => { const x = new Date(); x.setUTCDate(x.getUTCDate() + off); return x.toISOString().slice(0, 10).replace(/-/g, ""); };
  const ev = (a: number, b: number, i: number) => `BEGIN:VEVENT\r\nUID:demo-${i}@portal\r\nDTSTAMP:${d(0)}T000000Z\r\nDTSTART;VALUE=DATE:${d(a)}\r\nDTEND;VALUE=DATE:${d(b)}\r\nSUMMARY:CLOSED - Not available\r\nEND:VEVENT\r\n`;
  return "BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//demo//EN\r\n" + ev(3, 6, 1) + ev(14, 18, 2) + ev(21, 24, 3) + ev(27, 31, 4) + "END:VCALENDAR\r\n";
}
const realGet = https.get;
(https as any).get = function (target: any, opts: any, cb: any) {
  const u = target instanceof URL ? target : new URL(String(target));
  if (!FAKE_HOSTS.includes(u.hostname)) return realGet.apply(https, arguments as any);
  const body = Buffer.from(ics());
  const res: any = new PassThrough();
  res.statusCode = 200; res.headers = { "content-type": "text/calendar; charset=utf-8", "content-length": String(body.length) };
  const req: any = new PassThrough(); req.setTimeout = () => req; req.destroy = () => {}; req.abort = () => {};
  setTimeout(() => { cb(res); res.end(body); }, 400);
  return req;
};

process.chdir(R);
process.env.PUBLIC_PORT = "0";
const { config } = await import(R + "/src/config.js");
(config as any).publicSiteUrl = "https://citoviso.com";
const { server } = (await import(R + "/src/server/public.js")) as any;
if (!server.listening) await once(server, "listening");
const port = server.address().port;
const { mintTenantCookieValue } = await import(R + "/src/auth/tenantAuth.js");
const { db } = await import(R + "/src/db/client.js");
const tu = await db.selectFrom("tenant_user").innerJoin("tenant", "tenant.id", "tenant_user.tenant_id").select(["tenant_user.id as id", "tenant.id as tid"]).where("tenant.display_name", "like", "%Myrna%").executeTakeFirstOrThrow();
const unit = await db.selectFrom("site_unit").innerJoin("site", "site.id", "site_unit.site_id").select("site_unit.id").where("site.tenant_id", "=", tu.tid).where("site_unit.name", "=", UNIT_NAME).executeTakeFirstOrThrow();
// clean start: no import link for this unit/portal
{ const { deleteCalendarLink } = await import(R + "/src/tenant/availability.js"); const site = await db.selectFrom("site_unit").select("site_id").where("id", "=", unit.id).executeTakeFirstOrThrow(); for (const l of await db.selectFrom("calendar_link").select("id").where("unit_id", "=", unit.id).where("direction", "=", "import").execute()) await deleteCalendarLink(site.site_id, l.id); }

// synthesize every narration clip BEFORE recording, so no dead air while Piper runs
{ const pl = (await import(process.env.PLAN ?? path.join(HERE, "plan.mjs"))).default[PORTAL] as any[];
  for (const st of pl) { if (st.k === "t") clip(st.h + ". " + (st.say ?? st.path ?? st.s ?? "")); else { clip(st.cap); for (const f of st.foci ?? []) clip(f.t); } } }
const { chromium } = await import(R + "/node_modules/playwright-core/index.mjs");
const browser = await chromium.launch({ executablePath: config.chromiumPath });
const SIZES = (process.env.SIZES ?? "d,m").split(",");
for (const sz of SIZES) {
  const vp = sz === "m" ? { width: 390, height: 780 } : { width: 1280, height: 800 };
  const dir = path.join(OUT, `vid-${sz}`); await mkdir(dir, { recursive: true });
  const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: sz === "m" ? 2 : 1, recordVideo: { dir, size: vp }, permissions: ["clipboard-read", "clipboard-write"] });
  await ctx.addCookies([{ name: "cit_session", value: mintTenantCookieValue(tu.id), url: `http://localhost:${port}` }]);
  const page = await ctx.newPage();
  const t0 = Date.now(); // video timeline starts with the page
  const events: { at: number; file: string }[] = [];
  let busyUntil = 0;
  const waitFree = async (extra = 0) => { const d = busyUntil + extra - Date.now(); if (d > 0) await page.waitForTimeout(d); };
  const say = (text: string, at = Date.now()) => { const c = clip(text); events.push({ at: at - t0, file: c.file }); busyUntil = Math.max(busyUntil, at + c.ms + 700); return c; };
  const base = `http://localhost:${port}/admin?tab=modulok&m=booking&e=${unit.id}`;
  const overlay = async () => page.evaluate(() => {
    if (document.getElementById("demo-cap")) return;
    const c = document.createElement("div"); c.id = "demo-cap";
    c.style.cssText = "position:fixed;left:12px;right:12px;bottom:12px;z-index:99999;background:rgba(14,42,71,.94);color:#eaf3f8;font:600 18px/1.4 Inter,system-ui,sans-serif;padding:12px 16px;border-radius:14px;box-shadow:0 10px 30px rgba(0,0,0,.25);transition:opacity .3s;opacity:0";
    document.body.appendChild(c);
    const k = document.createElement("div"); k.id = "demo-cur";
    k.innerHTML = '<svg width="26" height="26" viewBox="0 0 24 24"><path d="M4 2l14 9-6 1.5L9 19z" fill="#10243a" stroke="#fff" stroke-width="1.4"/></svg>';
    k.style.cssText = "position:fixed;left:60%;top:40%;z-index:100000;pointer-events:none;transition:left .8s ease,top .8s ease";
    document.body.appendChild(k);
  });
  const cap = async (t: string, ms = 2600) => { await overlay(); await page.evaluate((t) => { const c = document.getElementById("demo-cap")!; c.textContent = t; c.style.opacity = t ? "1" : "0"; }, t); await page.waitForTimeout(ms); };
  const point = async (loc: any) => {
    await loc.scrollIntoViewIfNeeded(); await page.waitForTimeout(300);
    const b = await loc.boundingBox(); if (!b) return;
    await page.evaluate(([x, y]) => { const k = document.getElementById("demo-cur")!; k.style.left = x + "px"; k.style.top = y + "px"; }, [b.x + Math.min(b.width * 0.5, 120), b.y + b.height * 0.6]);
    await page.waitForTimeout(1500);
  };
  const card = () => page.locator(".psync__card").filter({ has: page.locator(".psync__top strong", { hasText: new RegExp("^" + PORTAL.replace(".", "\\.") + "$") }) });
  const shot = async (name: string) => { await page.evaluate(() => { document.querySelectorAll<HTMLElement>("[data-cit-toc]").forEach((e) => e.style.visibility = "hidden"); const k = document.getElementById("demo-cur"); if (k) k.style.visibility = "hidden"; const c = document.getElementById("demo-cap"); if (c) c.style.visibility = "hidden"; }); await card().screenshot({ path: path.join(OUT, `${KEY}-${sz}-${name}.png`) }); await page.evaluate(() => { document.querySelectorAll<HTMLElement>("[data-cit-toc]").forEach((e) => e.style.visibility = ""); const k = document.getElementById("demo-cur"); if (k) k.style.visibility = ""; const c = document.getElementById("demo-cap"); if (c) c.style.visibility = ""; }); };

  const STILL = "file://" + path.join(HERE, "still.html");
  const TITLE = "file://" + path.join(HERE, "title.html");
  const IMG = "file://" + path.join(R, "public/assets/help/portal-naptar") + "/";
  const plan = (await import(process.env.PLAN ?? path.join(HERE, "plan.mjs"))).default[PORTAL] as any[];
  const MOVE = 1300;
  let onAdmin = false; let n = 0;
  for (const st of plan) {
    await waitFree();
    if (st.k === "t") {
      const c = clip(st.h + ". " + (st.say ?? st.path ?? st.s ?? ""));
      const ms = Math.max(st.ms ?? 5000, c.ms + 1400);
      const q = new URLSearchParams({ k: st.kicker ?? "", h: st.h, path: st.path ?? "", s: st.s ?? "", ms: String(ms) });
      await page.goto(TITLE + "?" + q.toString()); onAdmin = false;
      say(st.h + ". " + (st.say ?? st.path ?? st.s ?? ""), Date.now() + 300);
      await page.waitForTimeout(ms + 300);
      continue;
    }
    n++;
    if (st.k === "p") {
      const ci = clip(st.cap);
      const intro = Math.max(3500, ci.ms + 900);
      const holds = (st.foci ?? []).map((f: any) => Math.max(5500, clip(f.t).ms + 900 - MOVE));
      const q = new URLSearchParams({ img: IMG + st.img, portal: PORTAL, step: `${n}. lépés`, src: st.src, cap: st.cap, foci: JSON.stringify(st.foci ?? []), intro: String(intro), holds: JSON.stringify(holds) });
      await page.goto(STILL + "?" + q.toString()); onAdmin = false;
      await page.waitForFunction(() => (window as any).__t0);
      const ts = Number(await page.evaluate(() => (window as any).__t0));
      const dur = Number(await page.evaluate(() => (window as any).__dur));
      say(st.cap, ts);
      let t = ts + intro;
      (st.foci ?? []).forEach((f: any, i: number) => { say(f.t, t + 150); t += MOVE + holds[i]; });
      await page.waitForTimeout(Math.max(0, ts + dur + 300 - Date.now()));
      continue;
    }
    if (!onAdmin) { await page.goto(base, { waitUntil: "networkidle" }); const cb = page.getByRole("button", { name: "Csak a szükségeseket" }); if (await cb.isVisible().catch(() => false)) { await cb.click(); await page.waitForTimeout(300); } await overlay(); onAdmin = true; await page.waitForTimeout(500); }
    say(st.cap);
    await cap(st.cap, 1800);
    if (st.act === "open") { await point(page.locator("h2", { hasText: "Hirdeti máshol is?" })); await point(card().locator(".psync__top")); await shot("01-kartya"); }
    if (st.act === "copy") { const b = card().locator("button", { hasText: "Másolás" }); await point(b); await b.click(); await shot("02-masolas"); }
    if (st.act === "paste") { const inp = card().locator('input[name="url"]'); await point(inp); await inp.click(); await inp.pressSequentially(URLS[PORTAL], { delay: 28 }); await shot("03-beillesztve");
      const btn = card().locator("button", { hasText: "Összekötés" }); await point(btn); await waitFree(-1200);
      await Promise.all([page.waitForLoadState("networkidle"), btn.click()]); await page.waitForTimeout(400); await overlay(); await cap(st.cap, 0); await waitFree(1200); continue; }
    if (st.act === "done") { await point(card().locator(".psync__top")); await shot("04-osszekotve"); }
    await waitFree(st.act === "done" ? 1500 : 600);
  }
  await waitFree(800);
  await cap("", 300);
  const v = page.video();
  await ctx.close();
  const p = await v.path();
  await rename(p, path.join(OUT, `${sz}-${KEY}.raw.webm`));
  await writeFile(path.join(OUT, `${sz}-${KEY}.events.json`), JSON.stringify(events));
  // reset for next size
  { const { deleteCalendarLink } = await import(R + "/src/tenant/availability.js"); const site = await db.selectFrom("site_unit").select("site_id").where("id", "=", unit.id).executeTakeFirstOrThrow(); for (const l of await db.selectFrom("calendar_link").select("id").where("unit_id", "=", unit.id).where("direction", "=", "import").execute()) await deleteCalendarLink(site.site_id, l.id); }
}
await browser.close();
await db.destroy();
server.close();
console.log("ok", await readdir(OUT));
process.exit(0);
