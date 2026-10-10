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

async function buildPage(templateId: string): Promise<string> {
  const base = await injectRuntime(renderSite(recipe(templateId), DATA, { phase: "mock" }));
  let html = await injectConfigurator(base, "00000000-0000-4000-8000-000000000001", DATA.name, {
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

async function open(browser: Browser, html: string, w: number, h: number, escalation = true) {
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
    if (u.pathname === `/p/${TOK}/view`)
      return r.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          viewId: "11111111-2222-4333-8444-555555555555",
          offer: !escalation ? null : { kind: "escalation", percent: 50, expiresAt: new Date(Date.now() + 72 * 3600_000).toISOString(), label: "Döntés-segítő" },
        }),
      });
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

/**
 * Which page controls the pill pair buries: hide the pair, sample its rectangles, note the
 * links/buttons that answer elementFromPoint; anything found there is under the pair.
 * Independent of the runtime's own placement code (it never asks the pill where it is).
 */
const PILL_PROBE = `() => {
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
    return a;
  };
  const prev = members.map((m) => m.style.visibility);
  members.forEach((m) => (m.style.visibility = "hidden"));
  const under = new Map();
  for (const rr of rects)
    for (let i = 1; i <= 9; i++)
      for (let j = 1; j <= 3; j++) {
        const hit = document.elementFromPoint(rr.left + (rr.width * i) / 10, rr.top + (rr.height * j) / 4);
        const a = hit && primary(hit);
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
} finally {
  await browser.close();
}

if (SELF_TEST) {
  // Every leg Elek photographed must go red on the unfixed runtime / the link-less page.
  const want = ["①", "②", "③", "④", "⑤", "⑥"];
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
