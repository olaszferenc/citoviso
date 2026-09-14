// ⛔ A VISSZAFORDÍTHATATLAN KÜLDÉS NE ÁLLJON A LEVÉL ELŐTT — és a sáv TÉNYLEG tapadjon.
//
// Jóváhagyott terv „B" (assets/design-refs/console/outreach-sticky-send/README.md,
// tulajdonosi döntés 2026-09-14). Amit ez az őr a VALÓDI konzol-szerveren, valódi
// prospect-soron, 390 és 1280 px-en mér:
//
//   ① SORREND — egyetlen POST-küldés-gomb sem előzi meg a levelet (DOM-sorrend ÉS
//      a FOLYAM-beli geometria; a sticky pozíciót ehhez ideiglenesen kikapcsoljuk,
//      különben a sáv „a képernyő alján" mért helye hazudna a lap sorrendjéről).
//   ② TAPADÁS VALÓDI GÖRGETÉSSEL — a lapot végiggörgetjük, és MINDEN mintavételnél
//      a sávnak teljes egészében a képernyőn kell lennie; a lap tetején ráadásul a
//      képernyő ALJÁHOZ kell tapadnia. ⛔ Ez nem geometriai tipp: a konzol
//      `.con .panel { overflow-x: hidden }`-je scroll-konténer, és egy azon BELÜL ülő
//      sticky a panel dobozához tapadna. A teljes-lapos screenshot erre VAK — a sticky
//      elemet a végleges helyére festi, tehát egy sosem tapadó sáv is zöldnek látszik.
//   ③ LÁTHATÓSÁG KÉT KÉRDÉSRE (ADR-0147) — „kifestve" (az opacity-lánc szorzata 1)
//      ÉS „nem takart" (`elementFromPoint` a gombot vagy leszármazottját találja el).
//      Az `elementFromPoint` az ÁTLÁTSZÓ elemet is eltalálja, ezért önmagában sosem
//      láthatósági verdikt — a ház ezt élesben fizette meg egy láthatatlan, mégis
//      „kattinthatónak" igazolt vásárlás-gombbal.
//   ④ A JOGI VÉG PIXELBEN LÁTSZIK a levél szöveges változatában — a leiratkozó URL és
//      a hirdető-azonosítás (§C.2) Range-ből vett dobozára mérve, mindkét méreten.
//   ⑤ A KAPU — zárva indul (a sáv kimondja, miért), és a levél VÉGE nyitja.
//   ⑥ FAIL-SAFE — JS NÉLKÜL a gombok NEM tiltottak: a kapu kényelmi zár, a garancia a
//      szerver-oldali §C. Egy halott szkript nem zárhatja ki a kezelőt a munkából.
//
// Piros önteszt (`--self-test`): mindhárom hibaosztályt előállítjuk a betöltött lapon,
// és az őrnek PIROSRA kell mennie. A ③/b eset a lényeg: átlátszóra állított sávnál a
// GEOMETRIAI verdikt zöld marad, a LÁTHATÓSÁGI megy pirosra.
//
// Használat: npx tsx scripts/outreach-send-bar-check.mts [--self-test]

import { once } from "node:events";
import type { Server } from "node:http";

import { chromium, type Browser, type Page } from "playwright-core";

import { config } from "../src/config.js";

process.env.CIT_SHOT = "1"; // no boot self-heal, no AI calls
process.env.CONSOLE_PORT = "0";

const SELF_TEST = process.argv.includes("--self-test");

let failed = 0;
const say = (ok: boolean, what: string, detail = ""): void => {
  if (ok) console.log(`  ✅ ${what}`);
  else {
    failed++;
    console.error(`  ❌ ${what}${detail ? ` — ${detail}` : ""}`);
  }
};

const VIEWPORTS = [
  { tag: "mobil 390px", width: 390, height: 844 },
  { tag: "asztali 1280px", width: 1280, height: 900 },
] as const;

/** The legally required tail of the cold letter — §C.1 opt-out, §C.2 advertiser id. */
const TAIL_NEEDLES: readonly { needle: string; what: string }[] = [
  { needle: "/unsubscribe", what: "a LEIRATKOZÓ link" },
  { needle: "A megkeresés küldője", what: "a HIRDETŐ-azonosítás (§C.2)" },
];

async function bootConsole(): Promise<{ port: number; cookie: string }> {
  const { server } = (await import("../src/console/server.js")) as { server: Server };
  if (!server.listening) await once(server, "listening");
  const addr = server.address();
  if (!addr || typeof addr === "string") throw new Error("konzol szerver cím nélkül");
  const { mintOperatorCookieValue } = await import("../src/auth/operatorAuth.js");
  const { db } = await import("../src/db/client.js");
  const op =
    (await db
      .selectFrom("operator_user")
      .select("id")
      .where("username", "=", "claude-test")
      .executeTakeFirst()) ??
    (await db.selectFrom("operator_user").select("id").limit(1).executeTakeFirst());
  if (!op) throw new Error("nincs operator_user a dev DB-ben");
  return { port: addr.port, cookie: mintOperatorCookieValue(op.id) };
}

/**
 * A prospect whose draft page actually OFFERS a send — otherwise the bar is absent
 * and the guard would be green for the wrong reason (nothing to measure).
 * ⚠️ Read-only: the shared dev park must not move because a guard ran.
 */
async function pickProspect(): Promise<string> {
  const { db } = await import("../src/db/client.js");
  const rows = await db
    .selectFrom("prospect")
    .select(["id", "contact_email", "email_sent_at"])
    .orderBy("created_at", "desc")
    .limit(20)
    .execute();
  const sendable = rows.find((r) => r.contact_email && !r.email_sent_at);
  const row = sendable ?? rows[0];
  if (!row) throw new Error("nincs prospect a dev DB-ben — az őr nem tud mit mérni");
  return row.id;
}

// ── A mérő-kód, a lapon belül ────────────────────────────────────────────────
// String alakban: a tsx `keepNames`-e `__name`-et injektál a függvény-értékű
// evaluate-be, ami friss böngésző-kontextusban ReferenceError-ral hal el.

/**
 * ⛔ A GÖRGETÉS NEM AZONNALI: a dizájn-mag `html { scroll-behavior: smooth }`-t ír elő,
 * ezért a `scrollTo` UTÁN rögtön kiolvasott doboz még a RÉGI pozícióhoz tartozik. Az őr
 * első változata emiatt a leiratkozó linket „takartnak" mérte 390 px-en (a fejléc-sáv
 * nyelvválasztóját találta el) — fantom-piros egy hibátlan lapon. Ezért: `behavior:
 * "instant"`, majd VÁRAKOZÁS, amíg a görgetés tényleg megérkezik (vagy a lap alja).
 */
const SCROLL_FN = `
  async function citScrollTo(y) {
    const max = document.documentElement.scrollHeight - innerHeight;
    const target = Math.max(0, Math.min(Math.round(y), Math.max(0, Math.round(max))));
    window.scrollTo({ top: target, left: 0, behavior: "instant" });
    for (let i = 0; i < 60; i++) {
      if (Math.abs(window.scrollY - target) <= 1) break;
      await new Promise((r) => requestAnimationFrame(r));
    }
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    return Math.round(window.scrollY);
  }`;

/** Ancestor-chain opacity product + display/visibility — „kifestve-e" (ADR-0147). */
const PAINTED_FN = `
  function citPainted(el) {
    var o = 1;
    for (var n = el; n && n.nodeType === 1; n = n.parentElement) {
      var cs = getComputedStyle(n);
      if (cs.display === "none" || cs.visibility === "hidden") return 0;
      o *= parseFloat(cs.opacity);
    }
    return o;
  }`;

/** elementFromPoint at a rect's centre — „nem takart-e". Never a verdict on its own. */
const HIT_FN = `
  function citHit(el, rect) {
    var x = Math.round(rect.left + rect.width / 2);
    var y = Math.round(rect.top + rect.height / 2);
    if (x < 0 || y < 0 || x > innerWidth || y > innerHeight) return "kepernyon-kivul";
    var t = document.elementFromPoint(x, y);
    if (!t) return "semmi";
    return el.contains(t) || t === el ? "ok" : (t.tagName.toLowerCase() + "." + (t.className || "").toString().slice(0, 30));
  }`;

interface BarShape {
  readonly present: boolean;
  readonly state: string;
  readonly why: string;
  readonly domOrderOk: boolean;
  readonly barFlowTop: number;
  readonly letterTop: number;
  readonly buttons: { label: string; disabled: boolean }[];
}

const SHAPE_JS = `(() => {
  const bar = document.querySelector("[data-cit-sendbar]");
  const subj = document.getElementById("subj");
  if (!bar || !subj) return { present: false, state: "", why: "", domOrderOk: false, barFlowTop: -1, letterTop: -1, buttons: [] };
  // DOM order: the bar must come AFTER the letter's first element.
  const rel = subj.compareDocumentPosition(bar);
  const domOrderOk = (rel & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
  // FLOW geometry: sticky reports the STUCK box, which says nothing about page order.
  const prev = bar.style.position;
  bar.style.position = "static";
  const barFlowTop = Math.round(bar.getBoundingClientRect().top + window.scrollY);
  bar.style.position = prev;
  const letterTop = Math.round(subj.getBoundingClientRect().top + window.scrollY);
  const buttons = Array.from(bar.querySelectorAll("button[type=submit]")).map((b) => ({
    label: (b.textContent || "").trim().slice(0, 44),
    disabled: b.disabled,
  }));
  const why = (document.getElementById("cit-sendbar-why") || {}).textContent || "";
  return { present: true, state: bar.getAttribute("data-cit-sendbar") || "", why: why.trim(), domOrderOk, barFlowTop, letterTop, buttons };
})()`;

/** Real scrolling: sample the bar's viewport box at several scroll positions. */
const STICK_JS = `(async () => {
  ${SCROLL_FN}
  const bar = document.querySelector("[data-cit-sendbar]");
  if (!bar) return { samples: [], vh: innerHeight, max: 0 };
  const vh = innerHeight;
  const max = Math.max(0, document.documentElement.scrollHeight - vh);
  const stops = [0, Math.round(max * 0.25), Math.round(max * 0.5), Math.round(max * 0.75), max];
  const samples = [];
  for (const y of stops) {
    const landed = await citScrollTo(y);
    const r = bar.getBoundingClientRect();
    samples.push({ scrollY: landed, wanted: Math.round(y), top: Math.round(r.top), bottom: Math.round(r.bottom), vh: vh });
  }
  return { samples, vh, max };
})()`;

const TAIL_JS = (needles: readonly string[]): string => `(async () => {
  ${PAINTED_FN}
  ${HIT_FN}
  ${SCROLL_FN}
  const pre = document.getElementById("mailbody");
  if (!pre) return { present: false, items: [] };
  const text = pre.textContent || "";
  const node = pre.firstChild;
  const out = [];
  for (const needle of ${JSON.stringify(needles)}) {
    const i = text.indexOf(needle);
    if (i < 0) { out.push({ needle, found: false, painted: 0, hit: "nincs-ilyen-szoveg" }); continue; }
    const range = document.createRange();
    range.setStart(node, i);
    range.setEnd(node, i + needle.length);
    const rects = range.getClientRects();
    const rect = rects.length ? rects[0] : range.getBoundingClientRect();
    // bring it on screen BEFORE judging pixels — off-screen is not "covered"
    const abs = rect.top + window.scrollY;
    await citScrollTo(abs - innerHeight / 2);
    const r2 = range.getClientRects()[0] || range.getBoundingClientRect();
    out.push({ needle, found: true, painted: citPainted(pre), hit: citHit(pre, r2), w: Math.round(r2.width), h: Math.round(r2.height) });
  }
  return { present: true, items: out };
})()`;

/**
 * ⚠️ ANIMÁLT MEGJELENÉST NEM ÓRÁRA MÉRÜNK (ADR-0147 ②) — és ezt EZ AZ ŐR TANULTA MEG
 * a saját bőrén: a `.con button` `transition: var(--citui-transition)`-je miatt a
 * felengedett gomb `opacity`-ja 0,5-ről 1-re ÚSZIK, a kapu `data-cit-sendbar="open"`
 * attribútuma viszont AZONNAL átvált. Az első változatom így 0,5-öt mért egy tökéletesen
 * rendben lévő gombon — vagyis fantom-pirosat gyártott volna minden futásban.
 * A várakozás ezért a PIXELRE vár (rAF-enként), és a keret a termék SAJÁT állandójából
 * származik: `--citui-transition` (220 ms) + bőséges gép-terhelési ráhagyás. Ha sosem fest
 * ki: PIROS — nem elnyelt timeout.
 */
const BTN_VIS_JS = `(async () => {
  ${PAINTED_FN}
  ${HIT_FN}
  const bar = document.querySelector("[data-cit-sendbar]");
  if (!bar) return { present: false, items: [], waitedMs: 0, budgetMs: 0 };
  const raw = getComputedStyle(document.documentElement).getPropertyValue("--citui-transition") || "220ms";
  const ms = parseFloat(raw) * (/\\ds/.test(raw) && !/ms/.test(raw) ? 1000 : 1);
  const budget = Math.round((isFinite(ms) && ms > 0 ? ms : 220) + 4000); // + gép-terhelési ráhagyás
  const live = Array.from(bar.querySelectorAll("button[type=submit]")).filter((b) => !b.disabled);
  const t0 = performance.now();
  while (performance.now() - t0 < budget) {
    if (live.every((b) => citPainted(b) === 1)) break;
    await new Promise((r) => requestAnimationFrame(r));
  }
  const waited = Math.round(performance.now() - t0);
  const items = live.map((b) => ({
    label: (b.textContent || "").trim().slice(0, 44),
    painted: citPainted(b),
    hit: citHit(b, b.getBoundingClientRect()),
  }));
  return { present: true, items, waitedMs: waited, budgetMs: budget };
})()`;

/** Scroll the letter's end through the screen — that is what opens the gate. */
const OPEN_GATE_JS = `(async () => {
  const end = document.getElementById("cit-letter-end");
  if (!end) return false;
  end.scrollIntoView({ block: "center", behavior: "instant" });
  /* ⚠️ Nem órára mérünk (ADR-0147 ②): a PIXELRE/ÁLLAPOTRA várunk rAF-enként, kimondott
     kerettel. Az IntersectionObserver a következő festési körben szólal meg, ezért a
     keret a böngésző saját ütemezéséből származik, nem szerencsés mintavételből. */
  const bar = document.querySelector("[data-cit-sendbar]");
  for (let i = 0; i < 120; i++) {
    if (bar && bar.getAttribute("data-cit-sendbar") === "open") return true;
    await new Promise((r) => requestAnimationFrame(r));
  }
  return false;
})()`;

async function measureViewport(
  browser: Browser,
  url: string,
  cookie: string,
  origin: string,
  vp: (typeof VIEWPORTS)[number],
  poison: "none" | "bar-into-panel" | "bar-transparent" | "clip-letter",
): Promise<void> {
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
  await ctx.addCookies([{ name: "cit_op_session", value: cookie, url: origin }]);
  const page = await ctx.newPage();
  const jsErrs: string[] = [];
  page.on("pageerror", (e) => jsErrs.push(String(e)));
  await page.goto(url, { waitUntil: "networkidle" });
  await page.waitForTimeout(600); // the preview iframe fits itself after load

  const label = poison === "none" ? vp.tag : `${vp.tag} · MÉRGEZETT[${poison}]`;
  console.log(`\n── ${label} ──`);

  if (poison === "bar-into-panel") {
    // ⛔ EXACTLY the trap the plan calls out: inside `.con .panel{overflow-x:hidden}`
    // the panel is a scroll container, so sticky sticks to the PANEL, not the screen.
    await page.evaluate(`(() => {
      const bar = document.querySelector("[data-cit-sendbar]");
      const panel = document.querySelector(".con .panel") || document.querySelector(".panel");
      if (bar && panel) panel.appendChild(bar);
    })()`);
  }
  if (poison === "bar-transparent") {
    await page.evaluate(`(() => {
      const bar = document.querySelector("[data-cit-sendbar]");
      if (bar) bar.style.opacity = "0";
    })()`);
  }
  if (poison === "clip-letter") {
    // The old rows="22" box, reproduced: 445px visible, the rest clipped away.
    await page.evaluate(`(() => {
      const pre = document.getElementById("mailbody");
      if (pre) { pre.style.maxHeight = "445px"; pre.style.overflow = "hidden"; }
    })()`);
  }

  const shape = (await page.evaluate(SHAPE_JS)) as BarShape;
  say(shape.present, `${label}: van küldés-sáv és van levél a lapon`);
  if (!shape.present) {
    await ctx.close();
    return;
  }

  // ① SORREND
  say(shape.domOrderOk, `${label}: ① a sáv a levél UTÁN áll a lap szerkezetében`);
  say(
    shape.barFlowTop > shape.letterTop,
    `${label}: ① a sáv folyam-beli helye a levél alatt van`,
    `sáv y=${shape.barFlowTop} · levél y=${shape.letterTop}`,
  );

  // ⑤ A KAPU — zárva indul
  say(
    shape.state === "locked" && shape.buttons.every((b) => b.disabled),
    `${label}: ⑤ a sáv ZÁRVA indul (a gombok tiltottak)`,
    `state=${shape.state} · ${shape.buttons.map((b) => `${b.label}=${b.disabled ? "tiltott" : "ÉLŐ"}`).join(" | ")}`,
  );
  say(
    /Zárva/i.test(shape.why),
    `${label}: ⑤ a sáv KIMONDJA, miért zárva — kattintás előtt`,
    shape.why,
  );

  // ② TAPADÁS VALÓDI GÖRGETÉSSEL
  const stick = (await page.evaluate(STICK_JS)) as {
    samples: { scrollY: number; top: number; bottom: number; vh: number }[];
    vh: number;
    max: number;
  };
  const allOnScreen = stick.samples.every((s) => s.top >= -2 && s.bottom <= s.vh + 2);
  say(
    stick.samples.length >= 5 && allOnScreen,
    `${label}: ② a sáv MINDEN görgetési pozícióban a képernyőn van (${stick.samples.length} mintavétel)`,
    stick.samples.map((s) => `y=${s.scrollY}→[${s.top}..${s.bottom}]/${s.vh}`).join("  "),
  );
  const top = stick.samples[0];
  say(
    !!top && stick.max > vp.height && top.bottom >= top.vh - 6 && top.bottom <= top.vh + 2,
    `${label}: ② a lap TETEJÉN a sáv a képernyő ALJÁHOZ tapad (itt bukik a halott sticky)`,
    top ? `alja=${top.bottom} · képernyő=${top.vh} · görgethető=${stick.max}` : "nincs minta",
  );

  // ⑤ A levél vége nyitja
  const opened = (await page.evaluate(OPEN_GATE_JS)) as boolean;
  say(opened, `${label}: ⑤ a levél VÉGÉT elérve a sáv kinyílik`);

  // ③ LÁTHATÓSÁG — KÉT kérdés, a NYITOTT sáv élő gombjain
  const vis = (await page.evaluate(BTN_VIS_JS)) as {
    present: boolean;
    items: { label: string; painted: number; hit: string }[];
    waitedMs: number;
    budgetMs: number;
  };
  say(vis.items.length > 0, `${label}: ③ van élő küldés-gomb, amit meg lehet mérni`, JSON.stringify(vis.items));
  say(
    vis.waitedMs < vis.budgetMs,
    `${label}: ③ a gomb a kimondott kereten BELÜL festődött ki (${vis.waitedMs}/${vis.budgetMs} ms)`,
    "a keret kifutott — a gomb sosem lett teljesen kifestve",
  );
  for (const it of vis.items) {
    say(it.painted === 1, `${label}: ③ „${it.label}" KI VAN FESTVE (opacity-lánc = 1)`, `mérve ${it.painted}`);
    say(it.hit === "ok", `${label}: ③ „${it.label}" NEM TAKART (elementFromPoint)`, `eltalálva: ${it.hit}`);
  }

  // ④ A JOGI VÉG PIXELBEN
  const tail = (await page.evaluate(TAIL_JS(TAIL_NEEDLES.map((t) => t.needle)))) as {
    present: boolean;
    items: { needle: string; found: boolean; painted: number; hit: string }[];
  };
  say(tail.present, `${label}: ④ a levél szöveges változata ott van a lapon`);
  for (const t of TAIL_NEEDLES) {
    const it = tail.items.find((x) => x.needle === t.needle);
    say(!!it?.found, `${label}: ④ ${t.what} SZEREPEL a szövegben`);
    if (!it?.found) continue;
    say(it.painted === 1, `${label}: ④ ${t.what} ki van festve`, `opacity-lánc ${it.painted}`);
    say(it.hit === "ok", `${label}: ④ ${t.what} PIXELBEN látszik (nincs levágva)`, `eltalálva: ${it.hit}`);
  }

  say(jsErrs.length === 0, `${label}: nincs JS-hiba a lapon`, jsErrs.join(" | "));
  await ctx.close();
}

/** ⑥ JS nélkül a gombok NEM lehetnek tiltottak — a kapu kényelmi zár, nem garancia. */
async function measureNoJs(browser: Browser, url: string, cookie: string, origin: string): Promise<void> {
  console.log("\n── fail-safe: JS KIKAPCSOLVA ──");
  const ctx = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    javaScriptEnabled: false,
  });
  await ctx.addCookies([{ name: "cit_op_session", value: cookie, url: origin }]);
  const page = await ctx.newPage();
  await page.goto(url, { waitUntil: "domcontentloaded" });
  const n = await page.locator("[data-cit-sendbar] button[type=submit]").count();
  say(n > 0, "⑥ JS nélkül is ott a küldés-sáv gombja", `${n} gomb`);
  let liveEnabled = 0;
  for (let i = 0; i < n; i++) {
    if (await page.locator("[data-cit-sendbar] button[type=submit]").nth(i).isEnabled()) liveEnabled++;
  }
  say(
    n === 0 || liveEnabled > 0,
    "⑥ JS nélkül a küldés NEM tiltott (a halott szkript nem zárhatja ki a kezelőt)",
    `${liveEnabled}/${n} élő`,
  );
  const state = await page.locator("[data-cit-sendbar]").getAttribute("data-cit-sendbar");
  say(state === "open", "⑥ a kiszolgáló NYITOTTAN rendereli a sávot (a szkript zárja be)", String(state));
  await ctx.close();
}

async function main(): Promise<void> {
  console.log(
    SELF_TEST
      ? "KÜLDÉS-SÁV ŐR — ÖNTESZT MÓD (a három hibaosztálynak PIROSRA kell vinnie)"
      : "KÜLDÉS-SÁV ŐR — a küldés a levél után áll, tapad, és tényleg látszik",
  );
  const { port, cookie } = await bootConsole();
  const origin = `http://localhost:${port}`;
  const prospectId = await pickProspect();
  const url = `${origin}/prospect/${prospectId}/draft`;
  const browser = await chromium.launch({ executablePath: config.chromiumPath });

  if (!SELF_TEST) {
    for (const vp of VIEWPORTS) await measureViewport(browser, url, cookie, origin, vp, "none");
    await measureNoJs(browser, url, cookie, origin);
  } else {
    // ⚑ PIROS ÁG. Minden mérgezés a BETÖLTÖTT lapon történik — a termék forrása nem
    // változik, tehát az önteszt nem hagyhat maga után romot.
    const before = failed;
    for (const p of ["bar-into-panel", "bar-transparent", "clip-letter"] as const) {
      await measureViewport(browser, url, cookie, origin, VIEWPORTS[1], p);
    }
    const reds = failed - before;
    failed = 0;
    console.log(`\n⚑ ÖNTESZT: a három mérgezés összesen ${reds} állítást vitt pirosra.`);
    if (reds === 0) {
      failed = 1;
      console.error("❌ AZ ŐR NEM TUD PIROSRA MENNI — ez díszlet, nem őr.");
    } else {
      console.log("✅ az őr képes pirosra menni mindhárom hibaosztályon");
    }
  }

  await browser.close();
  const { db } = await import("../src/db/client.js");
  await db.destroy();

  if (failed) {
    console.error(`\n⛔ outreach-send-bar-check: ${failed} bukás.`);
    process.exit(1);
  }
  console.log("\n🟢 outreach-send-bar-check: a küldés a levél után áll, tapad, és pixelben látszik.");
  process.exit(0);
}

main().catch((e) => {
  console.error(`❌ ${(e as Error).message}`);
  process.exit(1);
});
