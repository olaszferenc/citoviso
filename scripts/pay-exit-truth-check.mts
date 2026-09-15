// Regression gate for the buyer's EXIT from the payment moment: the way out has
// to be a real control, and the screens around it must not say two things at once.
//
// WHY THIS EXISTS (measured 2026-09-14 on the shipped views, stylesheets loaded):
//
//   ① The success page's primary call to action — "Belépek és szerkesztem", the
//      one control a paying customer needs — carried `class="btn"`. `.btn` has
//      ZERO rules in all four console stylesheets, so it rendered with
//      background-image:none, padding 0px, border-radius 0px and the plain
//      `.con a` cyan at 14px: byte-for-byte the same as the `info@citoviso.com`
//      mailto link three lines below it. The loudest element on the page was
//      indistinguishable from its quietest. Our own code said so, in a comment
//      80 lines above (payResultPage's retry branch) — and the success branch was
//      never brought along.
//
//   ② The same three screens hardcoded `info@citoviso.com`. That literal exists
//      NOWHERE in the configuration: OUTREACH_SENDER_EMAIL and LEGAL_ENTITY_EMAIL
//      both say `olasz.ferenc@citoviso.com`, and the tenant admin prints the
//      configured one. So a buyer whose card had just been DECLINED was sent to
//      an address we do not send from — on the screen where they are most likely
//      to write in. §B.17: the address must come from the config, and when there
//      is no configured address the offer is DROPPED, never replaced by a
//      plausible-looking one.
//
//   ③ The mock gateway stated the same fact twice on BOTH terminal branches.
//      On the FAILED branch that was pure noise and is now gone. On the PAID
//      branch it is LOAD-BEARING and stays: two different consumers pin the two
//      halves with two DIFFERENT literals (module-purchase-state-check.mts:370
//      wants "…MÁR rendezve van", elek/scenarios/FK-005b-…md:74 wants
//      "…rendezve van"), and neither string contains the other. Measured the
//      hard way: removing it turned a green tree red two directories away.
//      This gate therefore pins BOTH literals, so the next tidy-up fails loudly
//      and in one place.
//
//   ④ The multilang confirmation denied and promised e-mail in two ADJACENT
//      sentences: "…e-mailt nem küldünk róla külön." followed immediately by
//      "A számláját e-mailben küldjük a számlázási címére."
//
// WHAT IT REFUSES TO TRUST:
//
//   ⛔ Not a source grep. ① is invisible in the source — `class="btn"` looks like
//      a button and reads like one; only the RENDERED, stylesheet-loaded page
//      shows it is a bare link. The gate therefore renders the real exported view
//      functions in a browser with the real stylesheets served.
//
//   ⛔ Not isVisible(), and not a contrast number computed from
//      getComputedStyle().backgroundColor: the primary button is painted with a
//      background-IMAGE (gradient), so its backgroundColor is transparent and a
//      naive contrast walk climbs straight past it to the card behind — which is
//      how a first attempt at this gate reported a uniform "contrast = 1" for
//      every element on every page and would have graded a real regression green.
//      The verdict here is STRUCTURAL and differential: the CTA must be painted
//      (background-image or an opaque background-colour), must have real padding
//      and radius, and must NOT render identically to the plain links beside it
//      on the same page. That is exactly the property that broke.
//
// Run:  npx tsx scripts/pay-exit-truth-check.mts
//       npx tsx scripts/pay-exit-truth-check.mts --self-test   (must go RED)

import { chromium, type Page } from "playwright-core";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const SELF_TEST = process.argv.includes("--self-test");

const failures: string[] = [];
const notes: string[] = [];
function check(ok: boolean, label: string): void {
  if (ok) notes.push(`  ok  ${label}`);
  else failures.push(label);
}

const SUPPORT = "olasz.ferenc@citoviso.com";
const BUYER = "elo@pelda.hu";
const PROPERTY = "Nyugalom Vendégház";
/** The literal that used to be hardcoded on all three buyer screens. */
const GHOST_ADDRESS = "info@citoviso.com";

/**
 * The regression this gate was written for, reintroduced verbatim: the CTA goes
 * back to the dead `btn` class, the ghost address comes back, the gateway says
 * the state twice, and the multilang page denies e-mail next to promising it.
 */
function regress(html: string, tag: string): string {
  let out = html;
  /**
   * ⛔ A replacement that silently does not match turns the self-test into a lie:
   * the branch reports "green" for an assertion it never actually exercised. The
   * FIRST draft of this gate did exactly that — the gw-failed regression did not
   * apply, and its duplicate-sentence assertion stayed green under --self-test,
   * i.e. the gate claimed to be able to fire on a rule it had not tested.
   */
  const sub = (from: string | RegExp, to: string, what: string): void => {
    const next = out.replace(from, to);
    if (next === out) {
      console.error(`⛔ ÖNTESZT-HIBA: a visszarontás nem fogott (${tag}: ${what}) — az őr nem lett megmérve.`);
      process.exit(1);
    }
    out = next;
  };

  if (tag === "result-ok") {
    sub('class="citui-btn citui-btn--primary"', 'class="btn"', "kiút gomb → halott .btn");
  }
  if (out.includes(SUPPORT)) {
    sub(new RegExp(SUPPORT.replace(/\./g, "\\."), "g"), GHOST_ADDRESS, "konfigurált cím → beégetett cím");
  }
  if (tag === "gw-paid") {
    // The regression this branch now models is the one that ACTUALLY threatens
    // the screen: dropping one of the two pinned literals while "tidying up".
    sub(
      "Ez a fizetés már rendezve van",
      "Ez a fizetés le van zárva",
      "a dupla-terhelés elleni őr mondatának elvesztése",
    );
  }
  if (tag === "gw-pending") {
    // ⛔ THE SHIPPED DEFECT, verbatim: two identical outlined pills, distinguished
    // only by text colour. Measured before the contract: both 35px / weight 600 /
    // 12.5px / white / 999px.
    sub(
      /<form class="pay-act__quiet" /,
      '<form ',
      "a halk visszaút ugyanolyan súlyú lesz, mint a fizetés",
    );
  }
  if (tag === "gw-paid" || tag === "gw-failed" || tag === "gw-pending") {
    // ⑥ the page stops naming what is being paid for
    out = out.replace(/<div class="pay-item">[\s\S]*?<\/div>/, "");
  }
  if (tag === "result-fail") {
    // ⑦⑧ no copy button, no named exits — the state this page was in before
    out = out.replace(/<button type="button" id="payRefCopy"[\s\S]*?<\/button>/, "");
    out = out.replace(/<div class="pay-exits">[\s\S]*?<\/div>/, "");
  }
  if (tag === "gw-failed") {
    sub(
      /(<p class="mut small"[^>]*>Ez a MOCK)/,
      '<p class="mut small">A korábbi kísérlet elutasítva — terhelés nem történt.</p>$1',
      "elutasítás kétszer kimondva",
    );
  }
  return out;
}

/**
 * ④ lives in source, not in a rendered page (the multilang confirmation is async
 * and DB-backed). The self-test therefore regresses the SOURCE TEXT it reads, so
 * the assertion is exercised rather than assumed.
 */
function regressSource(src: string): string {
  return src.replace(
    "az elkészültéről nem küldünk külön értesítőt.",
    "e-mailt nem küldünk róla külön.",
  );
}

/** Serve /assets/** from the worktree — absolute hrefs 404 under file://. */
async function wireAssets(page: Page): Promise<void> {
  await page.route("**/assets/**", async (route) => {
    const u = new URL(route.request().url());
    try {
      const body = await readFile(`${process.cwd()}/public${u.pathname}`);
      const ct = u.pathname.endsWith(".css")
        ? "text/css"
        : u.pathname.endsWith(".svg")
          ? "image/svg+xml"
          : "application/octet-stream";
      await route.fulfill({ status: 200, contentType: ct, body });
    } catch {
      await route.fulfill({ status: 404, body: "" });
    }
  });
}

/**
 * ⛔ Proof that the stylesheets actually arrived. Without this the whole gate is
 * vacuous: an unstyled page has no painted buttons at all, so EVERY structural
 * assertion below would fail for the wrong reason — or, if the assertions were
 * phrased the other way round, pass for the wrong reason.
 */
const CSS_LOADED = `(function () {
  var b = document.body;
  return getComputedStyle(b).fontFamily.indexOf("Inter") >= 0
      || getComputedStyle(b).fontFamily.indexOf("Space Grotesk") >= 0;
})()`;

const SHAPE = `(function () {
  function shape(el) {
    var s = getComputedStyle(el);
    return {
      text: (el.innerText || "").trim(),
      cls: el.className,
      painted: s.backgroundImage !== "none"
        || (s.backgroundColor !== "rgba(0, 0, 0, 0)" && s.backgroundColor !== "transparent"),
      padX: parseFloat(s.paddingLeft) || 0,
      padY: parseFloat(s.paddingTop) || 0,
      radius: parseFloat(s.borderTopLeftRadius) || 0,
      color: s.color,
      fontSize: parseFloat(s.fontSize) || 0,
      h: Math.round(el.getBoundingClientRect().height),
    };
  }
  var out = { anchors: [], buttons: [], text: (document.body.innerText || "").trim(), mailtos: [] };
  document.querySelectorAll("a").forEach(function (a) { out.anchors.push(shape(a)); });
  document.querySelectorAll("button").forEach(function (b) { out.buttons.push(shape(b)); });
  document.querySelectorAll('a[href^="mailto:"]').forEach(function (a) {
    out.mailtos.push((a.getAttribute("href") || "").replace("mailto:", ""));
  });
  // ⛔ What can actually START A CHARGE — not "how many buttons are there".
  // The first version counted ALL buttons as a proxy, and went red the moment a
  // perfectly legitimate non-charging control (the copy button) appeared. A proxy
  // that breaks on a correct change was asking a different question than its label.
  out.chargeForms = document.querySelectorAll('form[action*="/paid"], form[action*="/failed"]').length;
  out.submits = document.querySelectorAll('button[type="submit"]').length;
  // ⑤ the hierarchy — measured in SIZE, WEIGHT and PAINT, never in hue alone.
  function btn(sel) {
    var e = document.querySelector(sel); if (!e) return null;
    var c = getComputedStyle(e), r = e.getBoundingClientRect();
    return { h: Math.round(r.height), fw: Number(c.fontWeight), fs: parseFloat(c.fontSize),
      painted: c.backgroundImage !== "none" || (c.backgroundColor !== "rgba(0, 0, 0, 0)" && c.backgroundColor !== "transparent"),
      text: (e.innerText || "").trim() };
  }
  out.loud = btn('.pay-act form:not(.pay-act__quiet) button[type="submit"]');
  out.quiet = btn('.pay-act .pay-act__quiet button[type="submit"]');
  out.item = (function(){ var e=document.querySelector(".pay-item"); return e?(e.innerText||"").trim():null; })();
  out.copyBtn = !!document.getElementById("payRefCopy");
  out.refCode = (function(){ var e=document.getElementById("payRef"); return e?(e.textContent||"").trim():null; })();
  out.exits = Array.prototype.map.call(document.querySelectorAll(".pay-exits a"), function(a){ return (a.innerText||"").trim(); });
  return out;
})()`;

interface Shape {
  text: string; cls: string; painted: boolean; padX: number; padY: number;
  radius: number; color: string; fontSize: number; h: number;
}
interface Probe { anchors: Shape[]; buttons: Shape[]; text: string; mailtos: string[]; chargeForms: number; submits: number;
  loud: { h: number; fw: number; fs: number; painted: boolean; text: string } | null;
  quiet: { h: number; fw: number; fs: number; painted: boolean; text: string } | null;
  item: string | null; copyBtn: boolean; refCode: string | null; exits: string[] }

/** How many times a page states a given fact. Whitespace-normalised. */
function occurrences(haystack: string, needle: string): number {
  const h = haystack.replace(/\s+/g, " ");
  const n = needle.replace(/\s+/g, " ");
  let count = 0;
  let i = h.indexOf(n);
  while (i >= 0) { count++; i = h.indexOf(n, i + n.length); }
  return count;
}

async function main(): Promise<void> {
  const { payMockPage, payResultPage, multilangPayResultPage } = await import("../src/console/views.js");
  void multilangPayResultPage; // async + DB-backed; its copy is asserted from source below

  const renewal = { date: "2027-09-14", amount: 99900, period: "annual" as const };
  const pages: { tag: string; html: string }[] = [
    { tag: "gw-pending", html: payMockPage("CIT-7QK2M4X9", 74925, "annual", "pending", PROPERTY) },
    { tag: "gw-failed", html: payMockPage("CIT-7QK2M4X9", 74925, "annual", "failed", PROPERTY) },
    { tag: "gw-paid", html: payMockPage("CIT-7QK2M4X9", 74925, "annual", "paid", PROPERTY) },
    // ⛔ §B.17 fixture: with no lead name the page must NOT invent one.
    { tag: "gw-noname", html: payMockPage("CIT-7QK2M4X9", 74925, "annual", "pending", null) },
    {
      tag: "result-fail",
      html: payResultPage(false, false, {
        ref: "CIT-7QK2M4X9", retryUrl: "/pay/mock/CIT-7QK2M4X9",
        contactEmail: BUYER, supportEmail: SUPPORT,
        productName: PROPERTY, amount: 74925, adminUrl: "https://citoviso.com/admin",
      }),
    },
    // ⛔ Nothing to offer → NO empty rail under a divider.
    {
      tag: "result-fail-noexit",
      html: payResultPage(false, false, {
        ref: "CIT-7QK2M4X9", contactEmail: BUYER, supportEmail: null,
        productName: PROPERTY, amount: 74925, adminUrl: null, retryUrl: null,
      }),
    },
    {
      tag: "result-ok",
      html: payResultPage(true, true, {
        siteUrl: "https://nyugalom-vendeghaz.citoviso.com", username: "nyugalom",
        contactEmail: BUYER, amount: 74925,
        loginUrl: "https://nyugalom-vendeghaz.citoviso.com/login",
        ref: "CIT-7QK2M4X9", renewal, supportEmail: SUPPORT,
      }),
    },
    // ⛔ §B.17 / fail-closed: with NO configured address the page must not invent
    // one. This is the branch that would quietly reintroduce a hardcoded default.
    {
      tag: "result-ok-nosupport",
      html: payResultPage(true, true, {
        siteUrl: "https://nyugalom-vendeghaz.citoviso.com", username: "nyugalom",
        contactEmail: BUYER, amount: 74925,
        loginUrl: "https://nyugalom-vendeghaz.citoviso.com/login",
        ref: "CIT-7QK2M4X9", renewal, supportEmail: null,
      }),
    },
  ];

  const dir = await mkdtemp(join(tmpdir(), "cit-pay-exit-"));
  const browser = await chromium.launch();
  const probes = new Map<string, Probe>();
  try {
    for (const p of pages) {
      const html = SELF_TEST ? regress(p.html, p.tag) : p.html;
      const file = join(dir, `${p.tag}.html`);
      await writeFile(file, html, "utf8");
      const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
      await wireAssets(page);
      await page.goto(pathToFileURL(file).href);
      await page.waitForTimeout(150);
      check(Boolean(await page.evaluate(CSS_LOADED)), `[${p.tag}] a stíluslap betöltött (különben a mérés vak)`);
      probes.set(p.tag, (await page.evaluate(SHAPE)) as Probe);
      await page.close();
    }
  } finally {
    await browser.close();
  }

  // ── ① the success page's way out is a REAL control ────────────────────────
  const ok = probes.get("result-ok")!;
  const cta = ok.anchors.find((a) => a.text.includes("Belépek és szerkesztem"));
  check(Boolean(cta), "① a sikeres lapon ott van a „Belépek és szerkesztem” kiút");
  if (cta) {
    check(/\bcitui-btn\b/.test(cta.cls), `① a kiút gomb-osztályt visel (mérve: "${cta.cls}")`);
    check(cta.painted, "① a kiút KIFESTETT (gradiens vagy tömör háttér), nem csupasz szöveg-link");
    check(cta.padX >= 12, `① a kiútnak valódi oldalsó margója van (mérve: ${cta.padX} px)`);
    check(cta.radius >= 4, `① a kiútnak gomb-alakja van (radius ${cta.radius} px)`);
    // ⚠️ Height, NOT vertical padding: `citui-btn` builds its box from min-height
    // + line-height, so padY is legitimately 0 on a 52px-tall button. A first
    // draft of this gate asserted padY and went red on correct code — the mercet
    // is the tap target the finger actually gets. 44px is the platform minimum;
    // the broken bare link measured 17px, so this separates them by a mile
    // rather than sitting on the shipped value.
    check(cta.h >= 44, `① a kiút valódi kattintó-felület (mérve: ${cta.h} px, küszöb 44)`);
    // ⭐ DIFFERENTIAL: the property that actually broke was "looks like the links
    // next to it". Compare against the plain anchors on the SAME page.
    const plain = ok.anchors.filter((a) => a !== cta && !/citui-btn|citui-brand/.test(a.cls) && a.text);
    check(plain.length > 0, "① van mihez hasonlítani (sima link ugyanazon a lapon)");
    const twins = plain.filter(
      (a) => a.color === cta.color && a.painted === cta.painted
        && a.padX === cta.padX && a.radius === cta.radius,
    );
    check(
      twins.length === 0,
      `① a kiút NEM néz ki ugyanúgy, mint a mellette álló sima linkek ` +
        `(${twins.length} azonos megjelenésű: ${twins.map((t) => `"${t.text.slice(0, 24)}"`).join(", ")})`,
    );
  }

  // ── ② one address, from the config — and none invented when absent ────────
  for (const tag of ["result-ok", "result-fail"]) {
    const pr = probes.get(tag)!;
    check(!pr.text.includes(GHOST_ADDRESS), `② [${tag}] a beégetett ${GHOST_ADDRESS} nincs a lapon`);
    check(pr.mailtos.every((m) => m === SUPPORT), `② [${tag}] minden mailto a konfigurált címre megy (mérve: ${JSON.stringify(pr.mailtos)})`);
    check(pr.mailtos.length > 0, `② [${tag}] van kiírt kapcsolat-cím`);
  }
  const nos = probes.get("result-ok-nosupport")!;
  check(nos.mailtos.length === 0, `② cím nélkül a lap NEM talál ki egyet (mérve: ${JSON.stringify(nos.mailtos)})`);
  check(!nos.text.includes(GHOST_ADDRESS), "② cím nélkül sem bukkan elő a beégetett cím");
  check(!nos.text.includes("Kérdése van? Írjon:"), "② cím nélkül a felszólítás is elmarad, nem lóg üresen");

  // ── ③ the gateway's terminal states ───────────────────────────────────────
  //
  // ⚠️ The PAID branch states "settled" TWICE, and that turns out to be
  // LOAD-BEARING — measured 2026-09-14, when this thread tried to tidy it away.
  // Two different consumers pin the two halves, with two DIFFERENT literals on
  // the same screen:
  //   • scripts/module-purchase-state-check.mts:370 → "Ez a fizetés MÁR rendezve van"
  //   • elek/scenarios/FK-005b-…md:74               → "Ez a fizetés rendezve van"
  // Neither string contains the other, so collapsing them into one sentence
  // breaks one consumer whichever wording survives. De-duplicating is therefore a
  // COPY DECISION that has to move both consumers with it — not a small fix.
  // ⛔ So this gate does NOT demand a single mention here. It pins BOTH literals,
  // so the next attempt to tidy this up fails LOUDLY and in ONE place, instead of
  // silently breaking a gate two directories away.
  const paid = probes.get("gw-paid")!;
  check(paid.text.includes("Ez a fizetés rendezve van"), "③ a rendezett lap hordozza az Elek-forgatókönyv idézte mondatot");
  check(paid.text.includes("Ez a fizetés már rendezve van"), "③ …és a dupla-terhelés elleni őr követelte mondatot is");
  check(
    paid.chargeForms === 0 && paid.submits === 0,
    `③ a rendezett fizetésen nincs TERHELÉST INDÍTÓ vezérlő (űrlap: ${paid.chargeForms}, submit: ${paid.submits})`,
  );
  // The FAILED branch carried no such pinning — there the duplication WAS removable.
  const failed = probes.get("gw-failed")!;
  check(
    occurrences(failed.text, "terhelés nem történt") === 1,
    `③ az elutasítást a lap EGYSZER mondja ki (mérve: ${occurrences(failed.text, "terhelés nem történt")}×)`,
  );
  check(failed.text.includes("A fizetés elutasítva"), "③ …de ki is mondja (az állapot nem tűnt el a kettőzés törlésével)");

  // ── ⑤⑥⑦⑧ the approved gateway/exit contract (pay-gateway-exit) ────────────
  const pend = probes.get("gw-pending")!;
  check(!!pend.loud && !!pend.quiet, "⑤ az átjárón van egy hangos és egy halk út");
  if (pend.loud && pend.quiet) {
    // ⛔ NOT hue. Measured 2026-09-15 BEFORE this contract: the two buttons were
    // byte-identical (35px, weight 600, 12.5px, white, 999px) and only their text
    // colour differed — nothing said which one was the action.
    check(pend.loud.h > pend.quiet.h, `⑤ a fizetés MAGASABB (${pend.loud.h} vs ${pend.quiet.h} px)`);
    check(pend.loud.fw > pend.quiet.fw, `⑤ …és VASTAGABB (${pend.loud.fw} vs ${pend.quiet.fw})`);
    check(pend.loud.fs > pend.quiet.fs, `⑤ …és nagyobb betűs (${pend.loud.fs} vs ${pend.quiet.fs} px)`);
    // ⛔ The PAINT, not just the box: a first attempt at this CSS lost to a more
    // specific generic console rule and painted BOTH buttons with the same navy
    // gradient. The DOM numbers were right; only the picture showed it.
    check(pend.loud.painted, "⑤ a fizetés KIFESTETT");
    check(!pend.quiet.painted, "⑤ …a visszalépés pedig NEM (kontúros, nem második tömör gomb)");
    // …but it must not vanish or shrink below a tappable size.
    check(pend.quiet.h >= 40, `⑤ a visszalépés tapintható marad (${pend.quiet.h} px)`);
  }
  for (const tag of ["gw-pending", "gw-failed", "gw-paid"]) {
    const g = probes.get(tag)!;
    check((g.item ?? "").includes(PROPERTY), `⑥ [${tag}] az átjáró MEGNEVEZI, mit fizet a vevő`);
    check(g.copyBtn && g.refCode === "CIT-7QK2M4X9", `⑦ [${tag}] a hivatkozási azonosító másolható`);
  }
  const noName = probes.get("gw-noname")!;
  check(!!noName.item, "⑥ név nélkül is van tétel-sor (a termék megnevezése marad)");
  check(!/\bNyugalom\b/.test(noName.item ?? ""), `⑥ …de a lap NEM talál ki nevet (mérve: "${noName.item}")`);
  const rf = probes.get("result-fail")!;
  check((rf.item ?? "").includes(PROPERTY), "⑥ a bukás-lap is megnevezi, mi bukott meg");
  check(rf.copyBtn, "⑦ a bukás-lapon is másolható az azonosító");
  check(rf.exits.length >= 3, `⑧ a bukás-lapról nevesített kiutak vezetnek (${rf.exits.join(" · ") || "—"})`);
  const noExit = probes.get("result-fail-noexit")!;
  check(noExit.exits.length === 0, `⑧ …de üres sávot nem rajzolunk (mérve: ${noExit.exits.length})`);

  // ── ④ the multilang confirmation does not deny and promise e-mail at once ─
  const rawSrc = await readFile("src/console/views.ts", "utf8");
  const src = SELF_TEST ? regressSource(rawSrc) : rawSrc;
  if (SELF_TEST && src === rawSrc) {
    console.error("⛔ ÖNTESZT-HIBA: a ④ forrás-visszarontás nem fogott — az állítás nem lett megmérve.");
    process.exit(1);
  }
  const mlStart = src.indexOf("export async function multilangPayResultPage");
  const mlBody = mlStart >= 0 ? src.slice(mlStart, mlStart + 4000) : "";
  check(mlStart >= 0, "④ megvan a multilang visszaigazolás forrása");
  check(
    !mlBody.includes("e-mailt nem küldünk róla külön"),
    "④ a multilang lap nem tagadja az e-mailt egy sorral a számla-ígéret fölött",
  );
  check(
    mlBody.includes("A számláját e-mailben küldjük"),
    "④ …a számla-ígéret viszont megmarad (nem a másik felét töröltük)",
  );
  check(
    mlBody.includes("A fordítás elindult"),
    "④ az Elek FK-005b által IDÉZETT nyitó tagmondat változatlan",
  );

  for (const n of notes) console.log(n);
  if (SELF_TEST) {
    if (failures.length === 0) {
      console.error("\n⛔ ÖNTESZT: a visszarontott lapokon az őrnek PIROSNAK kellene lennie, de zöld — az őr nem mér.");
      process.exit(1);
    }
    console.log(`\n✅ ÖNTESZT: az őr képes pirosra menni — ${failures.length} sértés a visszarontott lapokon:`);
    for (const f of failures) console.log(`   ✗ ${f}`);
    return;
  }
  if (failures.length) {
    console.error(`\n⛔ pay-exit-truth: ${failures.length} sértés:`);
    for (const f of failures) console.error(`   ✗ ${f}`);
    process.exit(1);
  }
  console.log(`\n✅ pay-exit-truth: ${notes.length} állítás zöld — a kiút valódi gomb, egy konfigurált cím, és a rendezett lap mindkét kikötött mondatot hordozza.`);
}

await main();
