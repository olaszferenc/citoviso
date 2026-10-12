// Guard (ADR-0370): model-authored mock HTML can never run code in a visitor's browser.
//
// Measured 2026-10-12 on the legacy AI-HTML path (generate.ts → generateFromCorpus): a prose
// instruction in a scraped field made the model emit a <script>, an onclick, seven onload
// handlers and a javascript: link — all executed. This guard holds the fix in place:
//
//   ① BEHAVIOUR — an injection fixture (every vector below) goes through the serve-time gate
//      (servableMockHtml, inputs {engine:"ai"}) and is opened in Chromium: 0 payloads run on
//      load, 0 when every remaining on* event is dispatched, 0 javascript: links remain — and
//      OUR runtime still works (head guard class, CitSeason, the booking widget mounts).
//   ② ENGINE UNTOUCHED — an engine/template artifact passes through byte-identical (its
//      template scripts are ours; its data is escaped at render).
//   ③ WIRING — the AI path sanitizes BEFORE injectRuntime, and no mock-serving route reads a
//      stored mock file around the gate.
//
// On the old code it fails: the module does not exist (①/②) and the routes read raw (③).
//
//   npx tsx scripts/model-html-sanitize-check.mts

import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { chromium } from "playwright-core";

import { config } from "../src/config.js";
import { sanitizeModelHtml, servableMockHtml } from "../src/generator/modelHtml.js";
import { injectRuntime } from "../src/generator/runtime.js";

const failures: string[] = [];
const fail = (m: string): void => {
  failures.push(m);
};

// Each vector sets window.__pwned to its own tag if it ever runs.
const VECTORS: readonly string[] = [
  `<script>window.__pwned="script"</script>`,
  `<SCRIPT type="module">window.__pwned="module"</SCRIPT>`,
  `<script data-cit-runtime>window.__pwned="forged-runtime"</script>`,
  `<img src="data:image/gif;base64,R0lGODlhAQABAAAAACw=" onload="window.__pwned='onload'">`,
  `<img src=x onerror=window.__pwned='onerror'>`,
  `<img/src=x/onerror="window.__pwned='slash'">`,
  `<a id="v-js" href="javascript:window.__pwned='jslink'">tovább</a>`,
  `<a id="v-js2" href=" &#106;ava&#x09;script&colon;window.__pwned='entity'">tovább</a>`,
  `<a id="v-data" href="data:text/html,<script>parent.__pwned='data'</script>">x</a>`,
  `<button onclick="window.__pwned='click'">Foglalás</button>`,
  `<form action="javascript:window.__pwned='form'"><button id="v-form">küld</button></form>`,
  `<iframe srcdoc="<script>parent.__pwned='srcdoc'</script>"></iframe>`,
  `<iframe src="javascript:parent.__pwned='iframe'"></iframe>`,
  `<object data="data:text/html,<script>parent.__pwned='object'</script>"></object>`,
  `<embed src="data:text/html,<script>parent.__pwned='embed'</script>">`,
  `<svg><script>window.__pwned="svg-script"</script></svg>`,
  `<svg onload="window.__pwned='svg-onload'"><circle r="2"/></svg>`,
  `<svg><a><animate attributeName="href" values="#;javascript:window.__pwned='animate'"/><text y="20">x</text></a></svg>`,
  `<svg><style><img src=x onerror="window.__pwned='svg-style'"></style></svg>`,
  `<noscript><p title="</noscript><img src=x onerror=window.__pwned='mxss'>"></noscript>`,
  `<!-- a --!><img src=x onerror="window.__pwned='comment'"> -->`,
  `<details open ontoggle="window.__pwned='toggle'">x</details>`,
  `<body onpageshow="window.__pwned='pageshow'">`,
  `<meta http-equiv="refresh" content="0;url=javascript:window.__pwned='meta'">`,
  `<base href="javascript:window.__pwned='base'//">`,
];

const FIXTURE =
  `<!doctype html><html lang="hu"><head><meta charset="utf-8"><title>Injekció</title></head><body>` +
  `<h1>ELEK-TESZT Injekció</h1>` +
  VECTORS.map((v) => `<div class="v">${v}</div>`).join("\n") +
  `<section data-cit-module="booking" data-cit-name="ELEK-TESZT Injekció" data-cit-email="elek@citoviso.com"></section>` +
  `</body></html>`;

// ── ① behaviour ─────────────────────────────────────────────────────────────────────────
const served = await servableMockHtml(FIXTURE, { engine: "ai" });
// A page that already carries our runtime (the stored shape) goes through the same gate.
const stored = await servableMockHtml(await injectRuntime(FIXTURE), { engine: "ai" });
if (!/<script data-cit-runtime>/.test(served)) fail("① a szűrt lapon nincs a mi runtime-unk");
if (/javascript:/i.test(served.replace(/<script data-cit-runtime>[\s\S]*?<\/script>/g, ""))) {
  fail("① a szűrt lapon maradt javascript: érték");
}
const { removed } = sanitizeModelHtml(FIXTURE);
if (removed.scripts < 4 || removed.handlers < 8 || removed.urls < 5 || removed.embeds < 4) {
  fail(`① a szűrő kevesebbet vett ki a vártnál: ${JSON.stringify(removed)}`);
}

const dir = await mkdtemp(path.join(os.tmpdir(), "cit-modelhtml-"));
const browser = await chromium.launch({ executablePath: config.chromiumPath });
try {
  // "nyers" = the fixture WITHOUT the gate: it must fire, or the fixture is dead and every
  // green below would be worthless.
  for (const [label, html] of [
    ["nyers", await injectRuntime(FIXTURE)],
    ["friss", served],
    ["tárolt", stored],
  ] as const) {
    const file = path.join(dir, `${label}.html`);
    await writeFile(file, html, "utf8");
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(`file://${file}`, { waitUntil: "load" });
    await page.waitForTimeout(800);
    const r = await page.evaluate(() => {
      const w = window as unknown as { __pwned?: unknown; CitSeason?: unknown };
      const onLoad = w.__pwned ?? null;
      const fired: string[] = [];
      let handlers = 0;
      for (const el of Array.from(document.querySelectorAll("*"))) {
        for (const a of Array.from(el.attributes)) {
          if (!/^on/i.test(a.name)) continue;
          handlers++;
          w.__pwned = undefined;
          el.dispatchEvent(new Event(a.name.slice(2), { cancelable: true }));
          if (w.__pwned != null) fired.push(`${a.name}→${String(w.__pwned)}`);
        }
      }
      const jsUrls = Array.from(document.querySelectorAll("[href],[src],[action],[formaction],[data]")).filter(
        (el) =>
          ["href", "src", "action", "formaction", "data"].some((n) =>
            /^\s*(javascript|vbscript):/i.test(el.getAttribute(n) ?? ""),
          ),
      ).length;
      const slot = document.querySelector('[data-cit-module="booking"]');
      return {
        onLoad,
        fired,
        handlers,
        jsUrls,
        frames: document.querySelectorAll("iframe,object,embed,frame").length,
        citAnim: document.documentElement.classList.contains("cit-anim"),
        citSeason: typeof w.CitSeason,
        bookingMounted: !!slot && !slot.querySelector("[data-cit-fallback]") && slot.children.length > 0,
      };
    });
    if (label === "nyers") {
      if (r.onLoad == null || r.fired.length < 6) {
        fail(`① a fixture HALOTT: szűrés nélkül is csak ${r.fired.length} kezelő futott (betöltés: ${String(r.onLoad)})`);
      }
      console.log(`  nyers (szűrés nélkül): betöltéskor ${String(r.onLoad)} · ${r.fired.length} kezelő futott · ${r.jsUrls} js-URL · ${r.frames} keret`);
      await page.close();
      continue;
    }
    if (r.onLoad != null) fail(`① ${label}: betöltéskor lefutott: ${String(r.onLoad)}`);
    if (r.handlers) fail(`① ${label}: ${r.handlers} on* attribútum maradt (${r.fired.join(", ") || "—"})`);
    if (r.jsUrls) fail(`① ${label}: ${r.jsUrls} javascript:/vbscript: URL maradt`);
    if (r.frames) fail(`① ${label}: ${r.frames} iframe/object/embed maradt`);
    if (!r.citAnim) fail(`① ${label}: a mi fej-őrünk (cit-anim) nem futott le`);
    if (r.citSeason !== "object") fail(`① ${label}: a mi runtime-unk (CitSeason) nem töltődött be`);
    if (!r.bookingMounted) fail(`① ${label}: a foglalás-widget nem épült fel (a runtime nem működik)`);
    if (errors.length) fail(`① ${label}: JS-hiba: ${errors.join(" | ")}`);
    // The javascript: links are gone; a click on what is left must not run anything either.
    for (const sel of ["#v-js", "#v-js2", "#v-form"]) {
      if (!(await page.locator(sel).count())) continue;
      await page.locator(sel).first().click({ timeout: 2000 }).catch(() => undefined);
      await page.waitForTimeout(150);
      const after = await page.evaluate(() => (window as unknown as { __pwned?: unknown }).__pwned ?? null).catch(() => "navigated");
      if (after != null) fail(`① ${label}: a(z) ${sel} kattintásra lefutott: ${String(after)}`);
    }
    console.log(`  ${label}: betöltés ${r.onLoad ?? "—"} · on* ${r.handlers} · js-URL ${r.jsUrls} · runtime ${r.citSeason}/${r.bookingMounted ? "foglalás kész" : "foglalás HIÁNYZIK"}`);
    await page.close();
  }
} finally {
  await browser.close();
  await rm(dir, { recursive: true, force: true });
}

// ── ② engine/template pages pass through untouched ───────────────────────────────────────
const enginePage = await injectRuntime(`<!doctype html><html><head></head><body><script>/* template */</script></body></html>`);
for (const inputs of [
  { engine: "composition", recipe: {}, siteData: {} },
  { engine: "template" },
  { recipe: { template: "fullbleed" }, siteData: { name: "x" } },
]) {
  if ((await servableMockHtml(enginePage, inputs)) !== enginePage) {
    fail(`② az engine/sablon lap megváltozott (${JSON.stringify(inputs)})`);
  }
}
if ((await servableMockHtml(FIXTURE, {})) === FIXTURE) fail("② ismeretlen eredetű lap szűretlenül ment át");

// ── ③ wiring ─────────────────────────────────────────────────────────────────────────────
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const src = async (f: string): Promise<string> => readFile(path.join(root, f), "utf8");
const gen = await src("src/generator/generate.ts");
if (!/injectRuntime\(clean\.html\)/.test(gen) || !/sanitizeModelHtml\(ai\.html\)/.test(gen)) {
  fail("③ generate.ts: az AI-út nem szűr az injectRuntime ELŐTT");
}
const RAW_READS: ReadonlyArray<[string, RegExp]> = [
  ["src/console/server.ts", /readFile\(\s*(a\.path|p\.artifactPath)\b/],
  ["src/server/public.ts", /readFile\(path\.resolve\(process\.cwd\(\), row\.path\)/],
  ["src/conversion/provision.ts", /readFile\(path\.resolve\(process\.cwd\(\), artifact\.path\)/],
];
for (const [f, re] of RAW_READS) {
  if (re.test(await src(f))) fail(`③ ${f}: tárolt mockot a szűrő megkerülésével olvas (${re.source})`);
}

if (failures.length) {
  console.error(`⛔ model-html-sanitize: ${failures.length} hiba`);
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
console.log(`✅ model-html-sanitize: ${VECTORS.length} vektor · 0 lefutás · a runtime működik · engine érintetlen · bekötés rendben`);
