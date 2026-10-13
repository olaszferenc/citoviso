// THE PLAN PAGE AROUND THE FREE TRIAL — what floats over what (Elek2 Ú3 #11 #12 #20 #18 Ú4).
//
//   npx tsx scripts/mock-trial-overlay-check.mts            # the verdict
//   npx tsx scripts/mock-trial-overlay-check.mts --self-test # every leg must go RED on sabotage
//
// Elek's 2nd round (2026-10-10, 1280×800 desktop) photographed four things on the plan page
// that no existing guard looked at, because each one needs the page in a STATE the other
// guards never put it in (escalation card dismissed → survey card up → consent bar up →
// trial form → success modal):
//
//   ① Ú3 — the „Mi tartotta vissza?” survey card stayed visible in the bottom-left corner
//      BEHIND the trial form and the success modal: two dialogs at once, one of them asking
//      why the person did NOT do what they are doing right now.
//   ② Ú3 — its „Elküldöm” / „Inkább nem” buttons slid UNDER the consent bar: the card could
//      not be closed before the cookie decision. The bar publishes its height as
//      `--citui-consent-h` (cit-consent.js publishHeight, ADR-0145 ④) — the card must sit on it.
//   ③ #11/#12 — after „Rendben” in the success modal the page still said „Ez még nem élő
//      oldal” with the „14 nap ingyen” pill, while the same address already served the live
//      trial site. „Rendben” must bring the page to the live state (the page reloads).
//   ④ #20 — the trial/order pill pair sat on the hero's button row and covered „GALÉRIA”
//      (desktop, consent bar up). The pair must not bury an interactive hero control —
//      also after a layout change that came without a scroll or a resize (see ④ below).
//
//   ⑦ K-új-1 (Elek 10-12, owner's ruling „ok rendben”) — after the offer bar's × the survey
//      card covered ~42 % of a phone screen and BOTH order pills. It is a small one-line bar
//      now: closed it is at most 64 px tall, it covers no pill (mobile and desktop), the
//      options appear only on a tap, and opened it still covers no pill.
//      While the order panel is open the bar is not painted (re-run: on a phone it sat over
//      the third package card's name and price).
//   ⑨ (Elek 10-12 re-run) — on a desktop the closed bar lay 96 % over the hero's own buttons
//      („FOGLALÁS”, „FEDEZZE FEL”). On every template, phone and desktop, it buries none.
//   ⑩ N5 (Elek 10-12, tenant round) — on a phone the −50 % top bar sat half over the dark
//      edit strip (ADR-0335) and the two ran into one. With both up, they do not overlap.
//   ⑧ A-új-1 (Elek 10-12) — with the offer already live (server-side), a × before /view had
//      answered left the survey out for good (no viewId → no mount, no retry). It must come
//      once the viewId arrives.
//
// and two server-rendered ones (hermetic, no browser):
//
//   ⑤ #18 — the „Mi tartja vissza?” thank-you page was a dead end: one sentence, no link.
//      It must lead back to the plan (/p/<token>) — where the „14 nap ingyen” pill is one
//      tap away. An opted-out person (unsubscribe page) is NOT pulled back (§C.1).
//   ⑥ Ú4 — the answer the letter's button names is the answer the page names, verbatim.
//
// The page is served from a fake origin by Playwright routes (no console server, no DB
// writes): the real render → runtime → configurator pipeline, plus the real cit-consent.js.
// The /p/… endpoints answer with fixtures (view → an escalation offer, trial → ok).
//
// --self-test: the fix blocks are cut out of the served JS/CSS (markers `cit-cfg-trialfx-*`),
// and the hermetic legs are fed a page without the links — every leg must go red.

process.env.CIT_SHOT = "1"; // no boot self-heal, no AI calls

import { readFile } from "node:fs/promises";
import path from "node:path";
import { chromium, type Browser, type Page } from "playwright-core";
import { config } from "../src/config.js";
import { renderSite } from "../src/engine/render.js";
import { TEMPLATES } from "../src/engine/templates.js";
import { injectConfigurator } from "../src/generator/configurator.js";
import { injectRuntime } from "../src/generator/runtime.js";
import type { Recipe, SiteData } from "../src/engine/recipe.js";
import { feedbackDoneHtml, feedbackFormHtml } from "../src/console/prospectFeedback.js";
import { trialCampaignParts } from "../src/email/trialCampaignEmail.js";
import {
  deferConsentUntilEngagement,
  disableIntroAnimation,
  injectTrackingBanner,
  injectTrackingNotice,
} from "../src/console/prospectNotice.js";

const SELF_TEST = process.argv.includes("--self-test");
/** `--shots=<dir>`: also photograph each measured state (for the owner / the report). */
const SHOTS = (process.argv.find((a) => a.startsWith("--shots=")) ?? "").slice(8);
async function shot(p: Page, name: string): Promise<void> {
  if (SHOTS) await p.screenshot({ path: path.join(SHOTS, `${name}.png`) });
}
const ROOT = path.resolve(import.meta.dirname, "..");

let failures = 0;
const failed: string[] = [];
function check(name: string, cond: boolean, detail?: unknown): void {
  if (cond) console.log(`  ✓ ${name}`);
  else {
    failures++;
    failed.push(name);
    console.log(`  ✗ ${name}${detail === undefined ? "" : ` — ${JSON.stringify(detail)}`}`);
  }
}

// ── ⑤ ⑥ hermetic: the server-rendered survey pages ───────────────────────────
console.log("\n⑤⑥ a „Mi tartja vissza?” oldalak (szerver-render)");
{
  const TOKEN = "fixtureTokenAbcdefgh12";
  const sabotage = (h: string): string => (SELF_TEST ? h.replace(/<a [^>]*data-cit-fb-back[^>]*>.*?<\/a>/g, "") : h);
  const trialDone = sabotage(feedbackDoneHtml("hu", false, { token: TOKEN, source: "trial_mail" }));
  const trialSkip = sabotage(feedbackDoneHtml("hu", true, { token: TOKEN, source: "trial_mail" }));
  const remind = sabotage(feedbackDoneHtml("hu", false, { token: TOKEN, source: "reminder_link" }));
  const unsub = feedbackDoneHtml("hu", false, { token: TOKEN, source: "unsubscribe" });
  const back = new RegExp(`<a (?=[^>]*\\sdata-cit-fb-back)(?=[^>]*\\shref="/p/${TOKEN}")[^>]*>`);
  check("⑤ próba-levél, köszönőlap: van út vissza a tervhez (/p/<token>)", back.test(trialDone));
  check("⑤ próba-levél, „Inkább nem” lap: ugyanúgy van út vissza", back.test(trialSkip));
  check("⑤ emlékeztető-link köszönőlapja: vissza a tervhez", back.test(remind));
  check("⑤ leiratkozott: nem húzzuk vissza (nincs terv-link)", !/data-cit-fb-back/.test(unsub));

  const mail = trialCampaignParts({
    lang: "hu",
    leadName: "Teszt Vendégház",
    sentIso: "2026-09-24",
    days: 14,
    host: "teszt.citoviso.com",
    retentionDays: 90,
    coupon: null,
    sender: { sigName: "Citoviso", sigCo: "Citoviso", sigMail: "info@example.invalid" },
    identity: "Citoviso",
    links: { cta: "https://x.example/", unsub: "https://x.example/p/t/unsubscribe", privacy: "https://x.example/privacy" },
  });
  const page = feedbackFormHtml(TOKEN, "trial_mail", "hu", "distrust");
  const pairs: [string, string][] = mail.whyLabels.map((l) => [l.reason, l.label]);
  const pageLabel = (reason: string): string | null => {
    const m = new RegExp(`value="${reason}"[^>]*>([^<]+)</label>`).exec(page);
    return m ? m[1]!.trim() : null;
  };
  check(`⑥ a levél ${pairs.length} gombja mind megvan a lapon`, pairs.length === 3, pairs);
  for (const [reason, label] of pairs) {
    const onPage = SELF_TEST && reason === "distrust" ? "Nem bízom benne, vagy nem értem" : pageLabel(reason);
    check(`⑥ „${label}” — a lapon szó szerint ugyanez`, onPage === label, { mail: label, page: onPage });
  }
}

// ── the browser legs ─────────────────────────────────────────────────────────
const ORIGIN = "http://mock.test";
const TOK = "fixtureTokenAbcdefgh12";
const PLAN = `${ORIGIN}/p/${TOK}`;
const PIX =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFklEQVR4nGP8" +
  "//8/AzbAhFVkOEgAAP//Awr/A0f8WlgAAAAASUVORK5CYII=";
const DATA: SiteData = {
  name: "Üdülő tábor",
  tagline: "Üdülőtábor a Balatonnál",
  intro: "Fenyves közepén álló üdülőtábor, ahol faházas és kőépületi szállások közül is választhatnak.",
  highlights: ["Faházas és kőépületi szállás félpanzióval", "Csendes környék"],
  geo: { lat: 46.7761204, lon: 17.6527838 },
  photos: [1, 2, 3, 4, 5].map((i) => ({ url: PIX, alt: `kép ${i}`, provenance: "portal" as const })),
  contact: { email: "a@b.hu", phone: "+36 30 111 2222", address: "Erzsébet utca 23, Balatonboglár, 8630" },
} as unknown as SiteData;
const recipe = (templateId: string): Recipe =>
  ({ skin: TEMPLATES[templateId]!.skins[0]!, archetype: "stacked", template: templateId, sections: [] }) as unknown as Recipe;

/** Cut a marked block (/* cit-cfg-trialfx-<n>-start … *\/ … /* cit-cfg-trialfx-<n>-end *\/) out of a JS or CSS source. */
function cut(src: string): string {
  return src.replace(/\/\* cit-cfg-trialfx-(\w+)-start\b[\s\S]*?\/\* cit-cfg-trialfx-\1-end \*\//g, "");
}

const ESC_OFFER = {
  kind: "escalation" as const,
  percent: 50,
  expiresAt: new Date(Date.now() + 72 * 3600_000).toISOString(),
  label: "Döntés-segítő",
};

/** `serverOffer`: the offer already live when the page is served (a later visit within its 72 h). */
async function buildPage(templateId: string, serverOffer = false): Promise<string> {
  const base = await injectRuntime(renderSite(recipe(templateId), DATA, { phase: "mock" }));
  let html = await injectConfigurator(base, "00000000-0000-4000-8000-000000000001", DATA.name, {
    ...(serverOffer ? { offer: ESC_OFFER } : {}),
    trial: { enabled: true as const, days: 14, url: `/p/${TOK}/trial`, privacyUrl: "/privacy" },
    track: { url: `/p/${TOK}/event`, viewUrl: `/p/${TOK}/view`, feedbackUrl: `/p/${TOK}/feedback` },
  });
  if (SELF_TEST) {
    // The served runtime WITHOUT the fixes — the state Elek photographed.
    html = html.replace(
      /(<script data-cit-configurator-js>)([\s\S]*?)(<\/script>)/,
      (_m, a: string, b: string, c: string) => a + cut(b) + c,
    );
    html = html.replace(
      /(<style data-cit-configurator-css>)([\s\S]*?)(<\/style>)/,
      (_m, a: string, b: string, c: string) => a + cut(b) + c,
    );
  }
  // The framing exactly as GET /p/<token> wraps it for a tracked lead (server.ts): the
  // „Ez még nem élő oldal” bar on top (it pushes the hero down — Elek's GALÉRIA sat 44 px
  // lower than on a bare render), the footer, and the consent question deferred to the
  // first engagement. Then the real consent bar, as consentSnippet injects it.
  html = deferConsentUntilEngagement(injectTrackingNotice(injectTrackingBanner(disableIntroAnimation(html), TOK), TOK));
  return html
    .replace("</head>", `<link rel="stylesheet" href="/assets/runtime/cit-consent.css"></head>`)
    .replace("</body>", `<script src="/assets/runtime/cit-consent.js" data-pixel-id="BP-FIXTURE0001-01" defer></script></body>`);
}

const consentCss = await readFile(path.join(ROOT, "public/assets/runtime/cit-consent.css"), "utf8");
const consentJs = await readFile(path.join(ROOT, "public/assets/runtime/cit-consent.js"), "utf8");

async function open(browser: Browser, html: string, w: number, h: number, escalation = true, viewDelay = 0) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h } });
  const p = await ctx.newPage();
  const errors: string[] = [];
  p.on("pageerror", (e) => errors.push(String(e)));
  let docLoads = 0;
  await p.route("**/*", async (r) => {
    const u = new URL(r.request().url());
    if (u.origin !== ORIGIN) return r.abort();
    if (u.pathname === `/p/${TOK}` && r.request().method() === "GET") {
      docLoads++;
      return r.fulfill({ status: 200, contentType: "text/html; charset=utf-8", body: html });
    }
    if (u.pathname === "/assets/runtime/cit-consent.css") return r.fulfill({ contentType: "text/css", body: consentCss });
    if (u.pathname === "/assets/runtime/cit-consent.js") return r.fulfill({ contentType: "text/javascript", body: consentJs });
    if (u.pathname === `/p/${TOK}/view`) {
      if (viewDelay) await new Promise((res) => setTimeout(res, viewDelay));
      return r.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          viewId: "11111111-2222-4333-8444-555555555555",
          offer: !escalation ? null : ESC_OFFER,
        }),
      });
    }
    if (u.pathname === `/p/${TOK}/trial`)
      return r.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          existing: false,
          tenantId: "t",
          siteUrl: PLAN,
          trialUntil: new Date(Date.now() + 14 * 86400_000).toISOString(),
          couponPercent: null,
          loginSentTo: "elek@example.invalid",
        }),
      });
    return r.fulfill({ status: 204, body: "" });
  });
  await p.goto(PLAN, { waitUntil: "domcontentloaded" });
  await p.waitForTimeout(600);
  return { ctx, p, errors, loads: () => docLoads };
}

/** Is this element really there for the person: painted AND answering a tap at its centre? */
const SEEN = `(sel) => {
  const el = document.querySelector(sel);
  if (!el) return { seen: false, why: "nincs" };
  const cs = getComputedStyle(el);
  const r = el.getBoundingClientRect();
  if (cs.display === "none" || cs.visibility === "hidden" || parseFloat(cs.opacity) < 0.05 || r.width === 0)
    return { seen: false, why: "nem látszik" };
  const pts = [[0.5, 0.15], [0.5, 0.5], [0.2, 0.3], [0.8, 0.3]];
  for (const [fx, fy] of pts) {
    const x = r.left + r.width * fx, y = r.top + r.height * fy;
    if (y < 0 || y > innerHeight) continue;
    const hit = document.elementFromPoint(x, y);
    if (hit && el.contains(hit)) return { seen: true, rect: [r.left, r.top, r.width, r.height].map(Math.round) };
  }
  return { seen: false, why: "takarva" };
}`;

/** Painted at all — even dimmed behind a scrim it is a second dialog on the screen (Ú3). */
const PAINTED = `(sel) => {
  const el = document.querySelector(sel);
  if (!el) return { painted: false };
  const cs = getComputedStyle(el);
  const r = el.getBoundingClientRect();
  const painted = cs.display !== "none" && cs.visibility !== "hidden" && parseFloat(cs.opacity) >= 0.05 &&
    r.width > 0 && r.bottom > 0 && r.top < innerHeight;
  return { painted, opacity: cs.opacity, visibility: cs.visibility };
}`;

/** Bring the page to Elek's state: visit registered → escalation card → dismissed → survey card up. */
async function toSurveyCard(p: Page): Promise<boolean> {
  await p.mouse.move(200, 300);
  await p.mouse.wheel(0, 300);
  await p.waitForTimeout(400);
  await p.mouse.wheel(0, -300);
  const later = p.locator(".cit-cfg-esclater");
  try {
    // The card fades in 1.4 s after it mounts — wait for the class that shows it, or the
    // click lands before the fade and the veil arrives after it.
    await p.locator(".cit-cfg-esccard.cit-cfg-on").waitFor({ state: "attached", timeout: 8000 });
  } catch {
    return false;
  }
  await p.waitForTimeout(500);
  // A DOM click, not a pointer one: on a phone the escalation card's own button sits under
  // the consent bar (a separate finding, the escalation card is outside this guard's scope)
  // — what is measured here is the survey card that follows it.
  await later.evaluate((b) => (b as HTMLButtonElement).click());
  try {
    await p.locator(".cit-cfg-fb.cit-cfg-on").waitFor({ state: "attached", timeout: 3000 });
  } catch {
    return false;
  }
  await p.waitForTimeout(700);
  return true;
}

async function fillTrial(p: Page): Promise<void> {
  await p.fill('.cit-cfg-tsheet [name="name"]', "Teszt Elek");
  await p.fill('.cit-cfg-tsheet [name="email"]', "elek@example.invalid");
  await p.fill('.cit-cfg-tsheet [name="phone"]', "+36 30 123 4567");
  await p.check('.cit-cfg-tsheet [name="terms"]');
  await p.check('.cit-cfg-tsheet [name="photo_rights"]');
}

/** The survey bar's geometry against the order pills (measured, never asked of the runtime). */
type FbGeom = { h: number; pills: number; overPills: number; optsShown: boolean; rect?: number[] };
const FB_GEOM = `() => {
  const fb = document.querySelector(".cit-cfg-fb");
  if (!fb) return { h: 0, pills: 0, overPills: 0, optsShown: false };
  const r = fb.getBoundingClientRect();
  const pills = [".cit-cfg-launch", ".cit-cfg-trialpill"]
    .map((s) => document.querySelector(s))
    .filter((m) => m && !m.hidden && getComputedStyle(m).visibility !== "hidden" && m.getBoundingClientRect().width > 0)
    .map((m) => m.getBoundingClientRect());
  const overPills = pills.filter((q) => q.left < r.right && q.right > r.left && q.top < r.bottom && q.bottom > r.top).length;
  const opt = fb.querySelector(".cit-cfg-fb__opts button");
  const optsShown = !!opt && opt.getBoundingClientRect().height > 0 && getComputedStyle(opt).visibility !== "hidden";
  return { h: Math.round(r.height), pills: pills.length, overPills, optsShown, rect: [r.left, r.top, r.width, r.height].map(Math.round) };
}`;

/** Which page controls the CLOSED survey bar buries (same method as PILL_PROBE below). */
// A photo tile that opens the lightbox (img role=button) is content, not a hero control —
// the bar floats over it like over any other picture.
const FB_PROBE = `() => {
  const fb = document.querySelector(".cit-cfg-fb");
  if (!fb) return { error: "nincs kérdés-sáv" };
  const r = fb.getBoundingClientRect();
  const primary = (el) => {
    const a = el.closest("a, button, [role=button]");
    if (!a || a.closest('[class*="cit-cfg"]') || a.closest("#cit-consent")) return null;
    if (a.tagName === "IMG" || (a.querySelector("img") && !(a.textContent || "").trim())) return null;
    const ar = a.getBoundingClientRect();
    if (ar.width < 60 || ar.height < 28) return null;
    return a;
  };
  const prev = fb.style.visibility;
  fb.style.visibility = "hidden";
  const under = new Map();
  for (let i = 1; i <= 19; i++)
    for (let j = 1; j <= 3; j++) {
      const hit = document.elementFromPoint(r.left + (r.width * i) / 20, r.top + (r.height * j) / 4);
      const a = hit && primary(hit);
      if (a) {
        const ar = a.getBoundingClientRect();
        const txt = (a.textContent || "").trim().replace(/\\s+/g, " ").slice(0, 30);
        under.set(a, txt || a.tagName.toLowerCase() + "." + String(a.className).split(" ")[0] + " " + Math.round(ar.width) + "×" + Math.round(ar.height));
      }
    }
  fb.style.visibility = prev;
  return { buried: [...under.values()], bar: [r.left, r.top, r.width, r.height].map(Math.round) };
}`;

/**
 * Which page controls the pill pair buries: hide the pair, sample its rectangles, note the
 * links/buttons that answer elementFromPoint; anything found there is under the pair.
 * Independent of the runtime's own placement code (it never asks the pill where it is).
 */
const PILL_PROBE = `(photosAreContent) => {
  const members = [".cit-cfg-launch", ".cit-cfg-trialpill"]
    .map((s) => document.querySelector(s))
    .filter((m) => m && !m.hidden && m.getBoundingClientRect().width > 0);
  if (!members.length) return { error: "nincs pirula" };
  const rects = members.map((m) => m.getBoundingClientRect());
  const primary = (el) => {
    const a = el.closest("a, button, [role=button]");
    if (!a || a.closest('[class*="cit-cfg"]') || a.closest("#cit-consent")) return null;
    const ar = a.getBoundingClientRect();
    if (ar.width < 60 || ar.height < 28) return null;
    // ⑪: a photo tile that opens the lightbox is content (same rule as FB_PROBE); see also below
    if (photosAreContent && (a.tagName === "IMG" || (a.querySelector("img") && !(a.textContent || "").trim()))) return null;
    return a;
  };
  const prev = members.map((m) => m.style.visibility);
  members.forEach((m) => (m.style.visibility = "hidden"));
  const under = new Map();
  for (const rr of rects)
    for (let i = 1; i <= 9; i++)
      for (let j = 1; j <= 3; j++) {
        const x = rr.left + (rr.width * i) / 10, y = rr.top + (rr.height * j) / 4;
        const hit = document.elementFromPoint(x, y);
        const a = hit && primary(hit);
        // ⑪: a text link counts where its words are — the masthead name link is a 728 px box
        // around a 185 px name (claymorphism), its empty end is no control (same as the runtime)
        if (a && photosAreContent && (a.textContent || "").trim()) {
          const tw = document.createTreeWalker(a, NodeFilter.SHOW_TEXT);
          let on = false;
          for (let n = tw.nextNode(); n && !on; n = tw.nextNode()) {
            const rg = document.createRange(); rg.selectNodeContents(n);
            for (const q of rg.getClientRects()) if (x >= q.left - 4 && x <= q.right + 4 && y >= q.top - 4 && y <= q.bottom + 4) on = true;
          }
          if (!on) continue;
        }
        if (a) under.set(a, (a.textContent || "").trim().replace(/\\s+/g, " ").slice(0, 30));
      }
  members.forEach((m, k) => (m.style.visibility = prev[k]));
  const buried = [];
  for (const [a, label] of under) {
    const ar = a.getBoundingClientRect();
    buried.push({ label, rect: [ar.left, ar.top, ar.width, ar.height].map(Math.round) });
  }
  return { buried, pills: rects.map((x) => [x.left, x.top, x.width, x.height].map(Math.round)) };
}`;

const browser = await chromium.launch({ executablePath: config.chromiumPath });
const VIEWPORTS = [
  [1280, 800, "asztali"],
  [390, 844, "mobil"],
] as const;
try {
  for (const [w, h, vp] of VIEWPORTS) {
    console.log(`\n①②③ kérdező-kártya, próba-űrlap, sikerablak — parallax/${vp}`);
    const html = await buildPage("parallax");
    const { ctx, p, errors, loads } = await open(browser, html, w, h);
    const up = await toSurveyCard(p);
    check(`${vp}: a fixture eljut a „Mi tartotta vissza?” kártyáig`, up);
    if (up) {
      const consent = await p.evaluate(() => {
        const b = document.getElementById("cit-consent");
        return b ? Math.round(b.getBoundingClientRect().top) : null;
      });
      check(`${vp}: a süti-sáv kint van (a fixture Elek állapotában)`, consent !== null && consent < h);
      // ⑦ closed: one small line, no pill under it, the options not yet shown.
      const closed = (await p.evaluate(`(${FB_GEOM})()`)) as FbGeom;
      await shot(p, `mock-kerdes-sav-zarva-${vp}`);
      check(`${vp}: ⑦ zárva egysoros, kicsi (${closed.h} px ≤ 64)`, closed.h > 0 && closed.h <= 64, closed);
      check(`${vp}: ⑦ zárva nem takar rendelés-pirulát`, closed.pills > 0 && closed.overPills === 0, closed);
      check(`${vp}: ⑦ zárva a válaszok még nem látszanak`, !closed.optsShown, closed);
      // ⑦ the order panel opened: the bar steps aside, and comes back when it closes.
      await p.locator(".cit-cfg-launch").evaluate((b) => (b as HTMLButtonElement).click());
      await p.waitForTimeout(500);
      const underPanel = (await p.evaluate(`(${PAINTED})(".cit-cfg-fb")`)) as { painted: boolean };
      check(`${vp}: ⑦ a nyitott rendelés-panel fölött a kérdés-sáv nem látszik`, !underPanel.painted, underPanel);
      await p.locator(".cit-cfg-panel .cit-cfg-close").evaluate((b) => (b as HTMLButtonElement).click());
      await p.waitForTimeout(500);
      // DOM click: the bar's own toggle — what is measured is the opened state.
      await p.locator(".cit-cfg-fb__open").evaluate((b) => (b as HTMLButtonElement).click());
      await p.waitForTimeout(300);
      const opened = (await p.evaluate(`(${FB_GEOM})()`)) as FbGeom;
      check(`${vp}: ⑦ koppintásra kinyílnak a válaszok`, opened.optsShown, opened);
      check(`${vp}: ⑦ kinyitva sem takar rendelés-pirulát`, opened.overPills === 0, opened);
      const send = (await p.evaluate(`(${SEEN})(".cit-cfg-fb__skip")`)) as { seen: boolean };
      const cardBottom = await p.evaluate(() => Math.round(document.querySelector(".cit-cfg-fb")!.getBoundingClientRect().bottom));
      await shot(p, `mock-kerdezo-kartya-${vp}`);
      check(`${vp}: ② az „Inkább nem” elérhető, a süti-sáv nem takarja`, send.seen, send);
      check(`${vp}: ② a kártya alja a süti-sáv fölött (${cardBottom} ≤ ${consent})`, consent === null || cardBottom <= consent, { cardBottom, consent });

      // ① open the trial form: the survey card must step aside.
      // DOM click: on a phone the survey card itself lies over the pill pair — a person
      // answers or skips it first; what is measured here is what the form does to it.
      await p.locator(".cit-cfg-trialpill").evaluate((b) => (b as HTMLButtonElement).click());
      await p.waitForTimeout(500);
      const underForm = (await p.evaluate(`(${PAINTED})(".cit-cfg-fb")`)) as { painted: boolean };
      check(`${vp}: ① a próba-űrlap alatt a kérdező-kártya nem látszik`, !underForm.painted, underForm);
      await shot(p, `mock-proba-urlap-${vp}`);
      await fillTrial(p);
      await p.locator(".cit-cfg-tsubmit").click();
      await p.locator('[data-t="ok"]').waitFor({ state: "visible", timeout: 5000 }).catch(async () => {
        console.log(await p.evaluate(() => [...document.querySelectorAll(".cit-cfg-terr, .cit-cfg-tsenderr")].map((e) => e.textContent).join(" | ")));
      });
      await p.waitForTimeout(400);
      const underOk = (await p.evaluate(`(${PAINTED})(".cit-cfg-fb")`)) as { painted: boolean };
      await shot(p, `mock-sikerablak-${vp}`);
      check(`${vp}: ① a sikerablak alatt a kérdező-kártya nem látszik`, !underOk.painted, underOk);

      // ③ „Rendben” → the page comes back in its live state (the same address reloads).
      const before = loads();
      await p.locator('[data-t="ok"] .cit-cfg-tghost').click();
      await p.waitForTimeout(1500);
      check(`${vp}: ③ a „Rendben” után a lap újratölt (élő állapot)`, loads() === before + 1, { before, after: loads() });
    }
    check(`${vp}: JS-hiba 0`, errors.length === 0, errors);
    await ctx.close();
  }

  // ⑨ the closed bar buries no hero control — every template, phone and desktop.
  console.log("\n⑨ a zárt kérdés-sáv nem temet be hős-vezérlőt (minden sablon)");
  for (const id of Object.keys(TEMPLATES).filter((t) => !process.env.ONLY9 || t === process.env.ONLY9))
    for (const [w, h, vp] of VIEWPORTS) {
      const html = await buildPage(id);
      const { ctx, p } = await open(browser, html, w, h);
      const up = await toSurveyCard(p);
      await p.evaluate(() => window.scrollTo(0, 0));
      await p.waitForTimeout(700);
      const r = up ? ((await p.evaluate(`(${FB_PROBE})()`)) as { error?: string; buried?: string[] }) : { error: "nem jött fel" };
      check(`⑨ ${id}/${vp}: a zárt kérdés-sáv nem ül hős-vezérlőn (süti-sávval)`, !r.error && (r.buried?.length ?? 0) === 0, r);
      // Elek's state: the cookie question answered — the pills drop to the bottom, and so
      // does the bar (measured 2026-10-12: 96 % over „FOGLALÁS” / „FEDEZZE FEL” at 1280×800).
      await p.evaluate(() => {
        const b = [...document.querySelectorAll("#cit-consent button")].pop() as HTMLButtonElement | undefined;
        b?.click();
      });
      await p.waitForTimeout(900);
      const r2 = up ? ((await p.evaluate(`(${FB_PROBE})()`)) as { error?: string; buried?: string[] }) : { error: "nem jött fel" };
      check(`⑨ ${id}/${vp}: a zárt kérdés-sáv nem ül hős-vezérlőn (süti-döntés után)`, !r2.error && (r2.buried?.length ?? 0) === 0, r2);
      await ctx.close();
    }

  // ⑩ the top offer bar and the edit strip, both up, one below the other.
  console.log("\n⑩ a felső ajánlat-sáv és a szerkeszthetőség-sáv nem fedi egymást");
  for (const [w, h, vp] of VIEWPORTS) {
    const html = await buildPage("parallax");
    const { ctx, p } = await open(browser, html, w, h);
    await p.mouse.move(200, 300);
    await p.mouse.wheel(0, 200);
    await p.locator(".cit-cfg-esccard.cit-cfg-on").waitFor({ state: "attached", timeout: 8000 }).catch(() => {});
    for (let k = 0; k < 4; k++) {
      await p.mouse.wheel(0, h);
      await p.waitForTimeout(350);
    }
    await p.locator(".cit-cfg-editstrip.cit-cfg-on").waitFor({ state: "attached", timeout: 5000 }).catch(() => {});
    await p.waitForTimeout(600);
    const g = (await p.evaluate(() => {
      const a = document.querySelector(".cit-cfg-esccard.cit-cfg-on");
      const b = document.querySelector(".cit-cfg-editstrip.cit-cfg-on .cit-cfg-editstrip__in");
      if (!a || !b) return { both: false, esc: !!a, strip: !!b };
      const ra = a.getBoundingClientRect();
      const rb = b.getBoundingClientRect();
      const ov = Math.max(0, Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top));
      return { both: true, overlap: Math.round(ov), esc: [ra.top, ra.bottom].map(Math.round), strip: [rb.top, rb.bottom].map(Math.round) };
    })) as { both: boolean; overlap?: number };
    await shot(p, `mock-felso-savok-${vp}`);
    check(`${vp}: ⑩ mindkét felső sáv kint (a fixture állapota)`, g.both, g);
    check(`${vp}: ⑩ a két felső sáv nem fedi egymást`, g.both && g.overlap === 0, g);
    await ctx.close();
  }

  // ⑧ the offer already live (served with the page), /view slow, × right after the bar shows.
  console.log("\n⑧ gyors × az ajánlat-sávon, mielőtt a /view válaszolt — a kérdés így is jön");
  for (const [w, h, vp] of VIEWPORTS) {
    const html = await buildPage("parallax", true);
    const { ctx, p, errors } = await open(browser, html, w, h, true, 4000);
    await p.mouse.move(200, 300);
    await p.mouse.wheel(0, 200);
    let barUp = true;
    try {
      await p.locator(".cit-cfg-esccard.cit-cfg-on").waitFor({ state: "attached", timeout: 3500 });
    } catch {
      barUp = false;
    }
    const before = await p.evaluate(() => !!document.querySelector(".cit-cfg-fb"));
    check(`${vp}: ⑧ a sáv a /view válasza ELŐTT kint (a verseny állapota)`, barUp && !before, { barUp, before });
    if (barUp) await p.locator(".cit-cfg-esclater").evaluate((b) => (b as HTMLButtonElement).click());
    await p.waitForTimeout(5500);
    const fbOn = await p.evaluate(() => !!document.querySelector(".cit-cfg-fb.cit-cfg-on"));
    check(`${vp}: ⑧ a × után, a viewId megérkeztével a kérdés megjelenik`, fbOn);
    check(`${vp}: ⑧ JS-hiba 0`, errors.length === 0, errors);
    await ctx.close();
  }

  // ④ the pill pair at rest on the hero, consent bar up, Elek's 1280×800 — after a layout
  // that changed WITHOUT a scroll or a resize. Measured 2026-10-10 on the real Üdülő tábor
  // page: in a plain browser the pair steps right of „GALÉRIA”; Elek's photo has it in the
  // centre ON the button. His capture (full-page shot) turns every fixed/sticky element
  // static for a moment and resizes the viewport — the pair re-placed DURING that state, and
  // nothing re-placed it once the layout came back (restoring styles fires no scroll/resize).
  // The same holds for any late layout change (a web font, a template script), so the guard
  // replays exactly that transient and asks where the pair rests afterwards.
  console.log("\n④ a próba/rendelés pirula-pár nem temet be hős-gombot (süti-sávval, átmeneti elrendezés után)");
  for (const id of Object.keys(TEMPLATES)) {
    const html = await buildPage(id);
    const { ctx, p } = await open(browser, html, 1280, 800, false);
    // The lead reads the first screen (the pair is placed), then scrolls once: THAT brings
    // the deferred consent bar, and the pair must re-place over it.
    await p.waitForTimeout(1800);
    await p.mouse.move(640, 300);
    await p.mouse.wheel(0, 120);
    await p.waitForTimeout(500);
    await p.evaluate(() => window.scrollTo(0, 0));
    await p.waitForTimeout(2200);
    await p.evaluate(`(async () => {
      const touched = [];
      for (const el of Array.from(document.querySelectorAll("*"))) {
        const ps = getComputedStyle(el).position;
        if (ps === "sticky" || ps === "fixed") { touched.push([el, el.style.position]); el.style.position = "static"; }
      }
      window.dispatchEvent(new Event("resize"));
      await new Promise((r) => setTimeout(r, 400));
      for (const [el, v] of touched) el.style.position = v;
    })()`);
    await p.waitForTimeout(2600);
    const r = (await p.evaluate(`(${PILL_PROBE})()`)) as { error?: string; buried?: { label: string }[]; pills?: number[][] };
    if (id === "parallax") await shot(p, "mock-pirula-par-parallax-asztali");
    const consentUp = await p.evaluate(() => !!document.getElementById("cit-consent"));
    check(`${id}/asztali: a süti-sáv kint (Elek állapota)`, consentUp);
    check(`④ ${id}/asztali: a pirula-pár nem ül hős-vezérlőn`, !r.error && (r.buried?.length ?? 0) === 0, r);
    await ctx.close();
  }

  // ⑪ Owner's ruling „A” (2026-09-29, after the pilot) and its extension (2026-10-13,
  // „csináld úgy, hogy jó legyen”): the pair never sits on the hero title — sideways
  // (844×390) it takes the right corner, not the centre; upright and on a desktop it steps
  // above the title, at rest and with the consent bar — and never onto a hero control or
  // the framing bar on the way. The title = the h1's words and the paragraphs beside it,
  // measured on their TEXT lines (glyphs).
  console.log("\n⑪ a pirula-pár nem ül a hős-címen (fekvő: sarok; álló + asztali: a cím fölé), gombra és fejlécre sem");
  const TITLE_PROBE = `() => {
    const pills = [".cit-cfg-launch", ".cit-cfg-trialpill"].map((s) => document.querySelector(s))
      .filter((m) => m && !m.hidden && m.getBoundingClientRect().width > 0).map((m) => m.getBoundingClientRect());
    const hits = [];
    for (const h of document.querySelectorAll("h1")) {
      if (h.closest('[class*="cit-cfg"]')) continue;
      const group = [h];
      for (let s = h.nextElementSibling; s; s = s.nextElementSibling) if (s.tagName === "P") group.push(s);
      for (const el of group) {
        const tw = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
        for (let n = tw.nextNode(); n; n = tw.nextNode()) {
          const rg = document.createRange(); rg.selectNodeContents(n);
          for (const r of rg.getClientRects()) {
            if (r.width < 2 || r.bottom <= 0 || r.top >= innerHeight) continue;
            // the glyphs, not the line box: ~10 % of it is leading above and below the words
            const gt = r.top + r.height * 0.1, gb = r.bottom - r.height * 0.1;
            if (pills.some((q) => q.left < r.right && q.right > r.left && q.top < gb && q.bottom > gt))
              hits.push((n.nodeValue || "").trim().slice(0, 24));
          }
        }
      }
    }
    const vw = document.documentElement.clientWidth;
    const right = Math.max(...pills.map((q) => q.right)), left = Math.min(...pills.map((q) => q.left));
    const top = Math.min(...pills.map((q) => q.top));
    const fr = document.querySelector("[data-cit-framing]");
    const frBottom = fr ? fr.getBoundingClientRect().bottom : 0;
    return { hits, pills: pills.length, corner: right >= vw - 40 || left <= 40, onScreen: top >= 0 && top >= frBottom,
      rects: pills.map((q) => [q.left, q.top, q.width, q.height].map(Math.round)) };
  }`;
  type TitleGeom = { hits: string[]; pills: number; corner: boolean; onScreen: boolean; rects: number[][] };
  type Buried = { error?: string; buried?: { label: string }[] };
  for (const id of Object.keys(TEMPLATES)) {
    const html = await buildPage(id);
    for (const [w, h, vp] of [[844, 390, "fekvő"], [390, 844, "álló"], [1280, 800, "asztali"]] as const) {
      const { ctx, p } = await open(browser, html, w, h, false);
      await p.waitForTimeout(1400);
      const rest = (await p.evaluate(`(${TITLE_PROBE})()`)) as TitleGeom;
      if (vp === "fekvő") check(`⑪ ${id}/${vp}, nyugalomban: a pár sarokban, nem középen`, rest.pills === 2 && rest.corner, rest);
      check(`⑪ ${id}/${vp}, nyugalomban: a pár nem ül a címen, a fejléc alatt marad`, rest.pills === 2 && rest.hits.length === 0 && rest.onScreen, rest);
      const b = (await p.evaluate(`(${PILL_PROBE})(true)`)) as Buried;
      check(`⑪ ${id}/${vp}, nyugalomban: hős-gombot sem temet be (FK-004b H-3)`, !b.error && (b.buried?.length ?? 0) === 0, b);
      if (id === "dark-luxury") await shot(p, `mock-pirula-cim-dark-luxury-${vp}`);
      // A key press is an engagement: the deferred consent bar comes, the page does not scroll.
      await p.keyboard.press("Shift");
      await p.waitForTimeout(1400);
      const up = await p.evaluate(() => !!document.getElementById("cit-consent"));
      const withBar = (await p.evaluate(`(${TITLE_PROBE})()`)) as TitleGeom;
      if (id === "dark-luxury") await shot(p, `mock-pirula-cim-dark-luxury-${vp}-suti`);
      check(`⑪ ${id}/${vp}, süti-sávval: a pár nem ül a címen, a fejléc alatt marad`, up && withBar.pills === 2 && withBar.hits.length === 0 && withBar.onScreen, { up, ...withBar });
      const b2 = (await p.evaluate(`(${PILL_PROBE})(true)`)) as Buried;
      check(`⑪ ${id}/${vp}, süti-sávval: hős-gombot sem temet be`, !b2.error && (b2.buried?.length ?? 0) === 0, b2);
      await ctx.close();
    }
  }
} finally {
  await browser.close();
}

if (SELF_TEST) {
  // Every leg Elek photographed must go red on the unfixed runtime / the link-less page.
  const want = ["①", "②", "③", "④", "⑤", "⑥", "⑦", "⑧", "⑨", "⑩", "⑪"];
  const missing = want.filter((m) => !failed.some((f) => f.includes(m)));
  if (missing.length) {
    console.error(`\n⛔ mock-trial-overlay-check --self-test: zöld maradt: ${missing.join(" ")} — az őr vak.`);
    process.exit(1);
  }
  console.log(`\n✅ mock-trial-overlay-check --self-test: a szabotázs ${failures} állítást pirosra vitt (${want.join(" ")}).`);
  process.exit(0);
}
if (failures) {
  console.error(`\n⛔ mock-trial-overlay-check: ${failures} bukás`);
  process.exit(1);
}
console.log("\n✅ mock-trial-overlay-check: zöld");
