// ADR-0192 ⑥ ② — A LEAD-OLDALI KOSÁR és a RENDELÉS-BEKÜLDÉS függőség-kapuja.
//
// A `module-dependency-check` a szabályt és a TENANT-oldali fogyasztókat méri.
// Ez a kettőt, ami ott HANGOSAN nem volt lefedve (a guard NOT_COVERED listája):
//
//   ① KLIENS-HALMAZ — a kosár bepipálja a függőséget, kimondja MIÉRT, és nem
//     engedi kivenni alóla a lábat;
//   ⑤ „FIZETENDŐ MOST" == a szerver `order.price` — ugyanarra a halmazra, két
//     FÜGGETLEN implementációból (böngésző-JS vs. computeMonthly/computeAnnual).
//     ⛔ Az őr nem hívhatja ugyanazt a függvényt, amit vizsgál
//     (feedback_guard_must_not_borrow_its_subject) — ezért kell a böngésző.
//
// …plusz az, ami az egészet valóban megvédi:
//
//   ② KÉZZEL GYÁRTOTT POST — a beküldő végpont a kiszállított HTTP-úton akad el,
//     nem egy forrás-grep szerint (feedback_gate_measured_text_not_its_source).
//     ⛔ Hozzáíró javítás NEM kapu: a kapu ELUTASÍT, nem kiegészít — kiegészítve
//     a vevő 990-et látna és 2 170-et fizetne (ADR-0192 ④.1 pont ezt zárta ki).
//
// NEGATÍV KONTROLLOK (mind fut, minden módban — egy őr, aminek a kontrolljait
// senki nem futtatja, nem őr):
//   N1. ÉRVÉNYES halmaz → a beküldő végpont NEM ezzel az okkal utasít el.
//   N2. A ⑤ állítás nem üres: a függőségek NÉLKÜLI halmaz ára BIZONYÍTHATÓAN más.
//   N3. A magyarázat a KATALÓGUS mondata, élenként KÜLÖN — ha a két él szövege
//       egybeesne, a kontroll hangosan bukik (a terv-kör mért hibája: a vezérlő
//       indokát írtuk ki mindkettőre, és a második élen üres sztring lett).
//   N4. A pirula PIRULA marad (a mért specificitás-csapda: egy `span{display:block}`
//       teljes szélességű sávvá hizlalta).
//
// Run: npx tsx scripts/module-dependency-cart-check.mts
//      npx tsx scripts/module-dependency-cart-check.mts --selftest  (böngésző + tiszta
//                                                                    állítások, HTTP nélkül)

import { once } from "node:events";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

import { chromium, type Page } from "playwright-core";

import { MODULE_CATALOG, applicableRequirements } from "../src/modules.js";
import { computeAnnual, computeMonthly, loadPricing } from "../src/pricing.js";
import type { Recipe, SiteData } from "../src/engine/recipe.js";
import { renderSite } from "../src/engine/render.js";
import { TEMPLATES } from "../src/engine/templates.js";
import { injectRuntime } from "../src/generator/runtime.js";
import { injectConfigurator } from "../src/generator/configurator.js";

const SELFTEST = process.argv.includes("--selftest");
const PREVIEW = `/tmp/cit-dep-cart-${process.pid}.html`;
const ARTIFACT_ID = "00000000-0000-4000-8000-000000000000";
const PHONE = { width: 390, height: 844 };
const DESK = { width: 1280, height: 900 };

const failures: string[] = [];
const notes: string[] = [];
// ⛔ A SORREND: (címke, feltétel). Az első változatom (feltétel, címke) volt, és
// mivel minden hívás a CÍMKÉT adta elsőnek, a nem üres sztring igazzá értékelődött:
// 39 állítás ment zöldre úgy, hogy egyikük sem mért semmit — a kimenetben
// „✓ false ↳ 82px" állt, azaz a lap KIÍRTA a bukást és zöldre értékelte.
// Ezért a feltétel itt SZIGORÚAN logikai: bármi más azonnal, hangosan bukik.
function check(label: string, ok: boolean, detail = ""): void {
  if (typeof ok !== "boolean") {
    failures.push(
      `⛔ ŐR-HIBA: a(z) „${label}" állítás nem logikai értéket kapott (${typeof ok}) — ` +
        `az ellenőrzés nem mért semmit`,
    );
    return;
  }
  if (ok) notes.push(`  ✓ ${label}${detail ? `  ↳ ${detail}` : ""}`);
  else failures.push(`${label}${detail ? `  ↳ ${detail}` : ""}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// A LÁNC, a katalógusból — ⛔ nem beégetve. Ha a termék változik, ez az őr a
// termékkel változik, nem egy elavult feltevést véd (a fix darabszám hot fájlban
// már egyszer hamis zöldet adott: feedback_narrow_recognizer_is_a_false_green).
// ─────────────────────────────────────────────────────────────────────────────
/** A legmélyebb hard-függőségi lánc a katalógusban, a tetejétől lefelé. */
function hardChain(): { id: string; requires: string; why: string }[] {
  const edges: { id: string; requires: string; why: string }[] = [];
  for (const m of MODULE_CATALOG) {
    for (const r of applicableRequirements(m.id)) {
      if (r.strength === "hard") edges.push({ id: m.id, requires: r.id, why: r.why });
    }
  }
  return edges;
}
const EDGES = hardChain();
/** A lánc TETEJE: hard-függősége van, de rá senki nem hivatkozik hard éllel. */
const DRIVER = EDGES.map((e) => e.id).find((id) => !EDGES.some((e) => e.requires === id));

if (!DRIVER) {
  console.error(
    "⛔ module-dependency-cart-check: a katalógusban NINCS hard függőségi lánc, " +
      "amin ez az őr mérni tudna — az állításai üresek volnának. Ha a lánc " +
      "szándékosan szűnt meg, ezt az őrt kell kivezetni, nem elnémítani.",
  );
  process.exit(1);
}
/** Amit a vezérlő behoz, tranzitívan (a lánc többi tagja). */
function closureOf(id: string): string[] {
  const out = [id];
  for (let g = 0; g <= MODULE_CATALOG.length; g++) {
    const add = EDGES.filter((e) => out.includes(e.id) && !out.includes(e.requires)).map(
      (e) => e.requires,
    );
    if (!add.length) break;
    out.push(...add);
  }
  return out;
}
const CHAIN = closureOf(DRIVER);
const PULLED = CHAIN.filter((id) => id !== DRIVER);
const labelOf = (id: string): string =>
  MODULE_CATALOG.find((m) => m.id === id)?.publicLabel ?? id;

// N3 — az élek indoklása KÜLÖN mondat. Ha egybeesnének, a „mindkettőt kiírtuk"
// állítás igaz lenne egy HIBÁS megvalósításra is.
{
  const whys = EDGES.map((e) => e.why.trim());
  check(
    `N3 minden függőségi él SAJÁT, nem üres indoklással jár (${EDGES.length} él)`,
    whys.every((w) => w.length >= 20) && new Set(whys).size === whys.length,
    whys.map((w) => `${w.slice(0, 24)}…`).join(" | "),
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// A MÉRT LAP — ugyanaz az út, amit a lead kap (injectConfigurator), nem egy vázlat.
// ─────────────────────────────────────────────────────────────────────────────
const demo: SiteData = {
  name: "Hotel Példa",
  tagline: "Csend és kilátás a hegy tetején",
  intro: "Kilenc szobás butikhotel a régi városfal tövében.",
  highlights: ["Panorámás tetőterasz", "Borpince", "Wellness"],
  photos: [
    { url: "https://picsum.photos/seed/cit-hero/1600/1000", alt: "A hotel", provenance: "owner" },
  ],
  contact: {
    email: "foglalas@hotelpelda.hu",
    phone: "+36 30 000 0000",
    address: "3300 Példaváros, Vár utca 2.",
  },
  rooms: [{ name: "Superior szoba", capacity: "2 fő · 26 m²", note: "Városra néző.", price: "42 000 Ft / éj" }],
  reviews: [{ quote: "Pontos, kedves, tiszta.", author: "Andrea", meta: "Budapest" }],
  place: { city: "Példaváros", country: "HU" },
};
const sections: Recipe["sections"] = (
  ["hero", "features", "gallery", "rooms", "reviews", "location", "enquiry"] as const
).map((kind) => ({ kind }));

async function buildPreview(): Promise<void> {
  const id = Object.keys(TEMPLATES)[0]!;
  const tpl = TEMPLATES[id]!;
  const recipe: Recipe = {
    template: id,
    skin: tpl.skins[0] ?? "editorial-warm",
    archetype: "stacked",
    sections,
  };
  await writeFile(
    PREVIEW,
    await injectConfigurator(await injectRuntime(renderSite(recipe, demo)), ARTIFACT_ID, demo.name),
    "utf8",
  );
}

interface CartState {
  on: string[];
  pills: string[];
  rails: Record<string, string>;
  /** A pirula befoglaló doboza — a „pirula maradt-e pirula" méréshez. */
  pillBox: { w: number; rowW: number } | null;
  /** Modulonként a NÉV oszlopának szélessége — a „nem préselődött-e" méréshez. */
  labelW: Record<string, number>;
  /** A magyarázó sáv jobb széle vs. a kártya jobb széle (túllógás). */
  railRight: number;
  cardRight: number;
  sum: string;
}

async function readCart(page: Page): Promise<CartState> {
  return page.evaluate((driverId: string) => {
    // ⚠️ SEMMILYEN névhez kötött függvény ebben a törzsben: a tsx/esbuild
    // `keepNames`-e `__name(...)` hívást fűz minden nevet kapó függvényhez, az
    // pedig a böngészőben nem létezik — a mérés ReferenceError-ral HALNA MEG
    // ahelyett, hogy mérne (és egy meghaló mérés nem piros, hanem semmi).
    // Ezért a láthatóság-feltétel mindenütt kiírva áll.
    const rows = [...document.querySelectorAll<HTMLElement>(".cit-cfg-row")];
    const rails: Record<string, string> = {};
    document.querySelectorAll<HTMLElement>(".cit-cfg-rowbox").forEach((b) => {
      const row = b.querySelector<HTMLElement>(".cit-cfg-row");
      const rail = b.querySelector<HTMLElement>(".cit-cfg-deprail");
      if (row && rail && !rail.hasAttribute("hidden") && rail.offsetWidth > 0) {
        rails[row.dataset.id ?? ""] = (rail.textContent ?? "").trim();
      }
    });
    const labelW: Record<string, number> = {};
    rows.forEach((r) => {
      const l = r.querySelector<HTMLElement>(".cit-cfg-label");
      if (l) labelW[r.dataset.id ?? ""] = l.getBoundingClientRect().width;
    });
    void driverId;
    const anyPill = [...document.querySelectorAll<HTMLElement>(".cit-cfg-deptag")].filter(
      (p) => !p.hasAttribute("hidden") && p.offsetWidth > 0,
    )[0];
    const pillRow = anyPill?.closest<HTMLElement>(".cit-cfg-row") ?? null;
    const railEl = document.querySelector<HTMLElement>(".cit-cfg-deprail:not([hidden])");
    const card = document.querySelector<HTMLElement>(".cit-cfg-body") ?? document.body;
    return {
      on: rows.filter((r) => r.getAttribute("aria-pressed") === "true").map((r) => r.dataset.id ?? ""),
      pills: rows
        .filter((r) => {
          const p = r.querySelector<HTMLElement>(".cit-cfg-deptag");
          return !!p && !p.hasAttribute("hidden") && p.offsetWidth > 0;
        })
        .map((r) => r.dataset.id ?? ""),
      rails,
      pillBox: anyPill && pillRow
        ? { w: anyPill.getBoundingClientRect().width, rowW: pillRow.getBoundingClientRect().width }
        : null,
      labelW,
      railRight: railEl ? railEl.getBoundingClientRect().right : 0,
      cardRight: card.getBoundingClientRect().right,
      sum: (document.querySelector(".cit-cfg-sum")?.textContent ?? "").trim(),
    };
  }, DRIVER!);
}

const tap = async (page: Page, id: string): Promise<void> => {
  // ⛔ NEM page.click(): az auto-scroll az `overflow:hidden` konténert is
  // elgörgeti, és egy elcsúszott vezérlő így ZÖLDRE mérne
  // (feedback_autoscroll_hides_offscreen_control).
  await page.evaluate((i: string) => {
    document.querySelector<HTMLElement>(`.cit-cfg-row[data-id="${i}"]`)?.click();
  }, id);
  await page.waitForTimeout(90);
};

/** A kosár egy méreten: bepipálás · indoklás · zárolás · visszavétel. */
async function auditCart(page: Page, size: string): Promise<{ chosen: string[]; annual: string }> {
  await page.click(".cit-cfg-launch");
  await page.waitForSelector(".cit-cfg-row", { state: "visible" });

  // ⭐ A manifest SZÁLLÍTJA a szabályt — a kliensnek nincs saját példánya belőle.
  const shipped = await page.evaluate(() => {
    const m = JSON.parse(document.querySelector("[data-cit-configurator]")!.textContent!) as {
      modules: { id: string; requires?: { id: string; why: string }[] }[];
    };
    return m.modules.map((x) => ({ id: x.id, requires: x.requires ?? [] }));
  });
  const offeredIds = new Set(shipped.map((s) => s.id));
  check(
    `① [${size}] a manifest szállítja a \`requires\`-t (${EDGES.length} él)`,
    EDGES.every((e) =>
      shipped.some((s) => s.id === e.id && s.requires.some((r) => r.id === e.requires && r.why === e.why)),
    ),
    JSON.stringify(shipped.filter((s) => s.requires.length)),
  );
  // ⛔ Zárvány: a kínálat nem hivatkozhat olyan modulra, amit nem kínál — a kosár
  // különben egy nem létező sort próbálna bepipálni, és néma érvénytelen halmazt
  // küldene be.
  check(
    `① [${size}] minden szállított követelmény BENNE van a kínálatban`,
    shipped.every((s) => s.requires.every((r) => offeredIds.has(r.id))),
    [...offeredIds].join(","),
  );

  // Lecsupaszítás: a láncot kikapcsoljuk, hogy a bekapcsolás MÉRHETŐ legyen.
  for (const id of [DRIVER!, ...PULLED]) {
    const st = await readCart(page);
    if (st.on.includes(id)) await tap(page, id);
  }
  const bare = await readCart(page);
  check(
    `① [${size}] a lánc kikapcsolva (kiinduló állapot)`,
    CHAIN.every((id) => !bare.on.includes(id)),
    bare.on.join(","),
  );
  check(
    `① [${size}] …és tiszta lappal EGYETLEN magyarázó sáv sem kiabál`,
    Object.keys(bare.rails).length === 0,
    JSON.stringify(bare.rails),
  );

  // ── A BEPIPÁLÁS ────────────────────────────────────────────────────────────
  await tap(page, DRIVER!);
  const on = await readCart(page);
  check(
    `① [${size}] a vezérlő (${labelOf(DRIVER!)}) bekapcsolása BEPIPÁLJA a teljes láncot`,
    CHAIN.every((id) => on.on.includes(id)),
    `bekapcsolva: ${CHAIN.filter((id) => on.on.includes(id)).join(",")} / kell: ${CHAIN.join(",")}`,
  );
  check(
    `① [${size}] …és a behozott sorok viselik az „együtt jár" pirulát`,
    PULLED.every((id) => on.pills.includes(id)),
    on.pills.join(","),
  );
  check(
    `① [${size}] …a vezérlő sora NEM visel pirulát (ő a saját választás)`,
    !on.pills.includes(DRIVER!),
  );
  // ⛔ SZÓ SZERINT a katalógus mondata, ÉLENKÉNT — nem szókapcsolatra mérve
  // (a szűk felismerő ugyanúgy hamis zöld, mint a hiányzó állítás).
  for (const e of EDGES) {
    if (!PULLED.includes(e.requires)) continue;
    check(
      `① [${size}] a(z) ${labelOf(e.requires)} sora a SAJÁT él indoklását idézi`,
      (on.rails[e.requires] ?? "").includes(e.why),
      on.rails[e.requires] ?? "NINCS SÁV",
    );
  }
  // N4 — a pirula pirula maradt (a mért specificitás-csapda).
  check(
    `N4 [${size}] a pirula PIRULA maradt, nem hízott teljes szélességű sávvá`,
    !!on.pillBox && on.pillBox.w > 0 && on.pillBox.w < on.pillBox.rowW * 0.6,
    on.pillBox ? `${Math.round(on.pillBox.w)}px / sor ${Math.round(on.pillBox.rowW)}px` : "nincs pirula",
  );
  // ⛔ ALAPVONALHOZ mérve, nem önkényes küszöbhöz: UGYANAZ a sor, pirula nélkül
  // (`bare`) és pirulával (`on`). Egy fix pixelszám vagy hamisan bukna egy rövid
  // modulnévre, vagy némán átengedné a szorítást egy hosszúnál — a kérdés nem az,
  // hogy hány pixel, hanem hogy a pirula ELVESZ-e a névtől.
  for (const id of PULLED) {
    const before = bare.labelW[id] ?? 0;
    const after = on.labelW[id] ?? 0;
    check(
      `N4 [${size}] a pirula NEM veszi el a(z) ${labelOf(id)} nevének helyét`,
      before > 0 && after >= before * 0.92,
      `pirula nélkül ${Math.round(before)}px → pirulával ${Math.round(after)}px`,
    );
  }
  check(
    `① [${size}] a magyarázó sáv nem lóg ki a kártyából`,
    on.railRight <= on.cardRight + 1,
    `sáv jobb széle ${Math.round(on.railRight)}px / kártya ${Math.round(on.cardRight)}px`,
  );
  // ⭐ A CSOPORTOSÍTOTT ár: a vezérlő sora megmondja, MENNYIÉRT — és megnevezi,
  // amit behozott. ⛔ Nyers katalógus-id soha (kontraktus §4).
  const drvRail = on.rails[DRIVER!] ?? "";
  check(
    `① [${size}] a vezérlő sora kimondja a CSOPORTOSÍTOTT árat, névvel`,
    PULLED.every((id) => drvRail.includes(labelOf(id))) && /\d/.test(drvRail),
    drvRail || "NINCS SÁV",
  );
  check(
    `① [${size}] ⛔ nyers katalógus-id NEM szivárog a képernyőre`,
    ![drvRail, ...Object.values(on.rails)].some((t) =>
      CHAIN.some((id) => new RegExp(`(^|[^\\w-])${id}([^\\w-]|$)`).test(t)),
    ),
    JSON.stringify(on.rails),
  );

  // ── A ZÁROLÁS (kontraktus §6: blokkol, nem kaszkádol) ───────────────────────
  const victim = PULLED[PULLED.length - 1]!;
  await tap(page, victim);
  const afterTry = await readCart(page);
  check(
    `① [${size}] a fogott ${labelOf(victim)} NEM vehető le, amíg a lánc él`,
    CHAIN.every((id) => afterTry.on.includes(id)),
    afterTry.on.join(","),
  );

  // ── A VISSZAVÉTEL (kontraktus §5) ──────────────────────────────────────────
  const chosenBefore = afterTry.on.slice();
  await tap(page, DRIVER!);
  const back = await readCart(page);
  check(
    `① [${size}] a vezérlő kikapcsolása VISSZAVESZI, amit behozott`,
    CHAIN.every((id) => !back.on.includes(id)),
    back.on.join(","),
  );
  check(
    `① [${size}] …de NEM visz el olyat, amit a vevő maga választott`,
    chosenBefore.filter((id) => !CHAIN.includes(id)).every((id) => back.on.includes(id)),
    `maradt: ${back.on.join(",")}`,
  );

  // Vissza a lánccal EGYÜTT bekapcsolt állapotba — ezt küldi be a vevő.
  await tap(page, DRIVER!);
  const final = await readCart(page);
  return { chosen: final.on, annual: final.sum };
}

// ─────────────────────────────────────────────────────────────────────────────
let server: Server | undefined;
try {
  await buildPreview();
  const browser = await chromium.launch();
  const jsErrors: string[] = [];
  let clientChosen: string[] = [];
  let clientSum = "";

  for (const [name, viewport] of [
    ["mobil 390", PHONE],
    ["asztali 1280", DESK],
  ] as const) {
    const page = await browser.newPage({ viewport });
    page.on("pageerror", (e) => jsErrors.push(`${name}: ${e}`));
    await page.route("https://picsum.photos/**", (r) => r.abort());
    await page.goto(pathToFileURL(PREVIEW).href);
    const r = await auditCart(page, name);
    clientChosen = r.chosen;
    clientSum = r.annual;
    await page.close();
  }
  await browser.close();
  check("① nulla JS-hiba a kosárban", jsErrors.length === 0, jsErrors.join(" | "));

  // ── ⑤ A KLIENS „FIZETENDŐ MOST" == A SZERVER `order.price` ─────────────────
  // Két FÜGGETLEN implementáció ugyanarra a halmazra: a böngészőben futó
  // kosár-JS, és a szerver ár-forrása. Ha eltérnek, a vevő mást lát, mint amit
  // fizet — pont az a hazugság, amiért a kliens pipál.
  await loadPricing();
  const digits = (s: string): number => Number((/([\d\s  ]+)\s*Ft/.exec(s)?.[1] ?? "").replace(/\D/g, ""));
  // The figure is compared in the cycle the card SHOWS (monthly is the default
  // since ADR-0211) — read from its own unit, never assumed; no unit = red.
  const clientCycle = /\/\s*év/.test(clientSum) ? "annual" : /\/\s*hó/.test(clientSum) ? "monthly" : null;
  const clientAmount = digits(clientSum);
  const serverAnnual = computeAnnual(clientChosen);
  const serverAmount = clientCycle === "annual" ? serverAnnual : computeMonthly(clientChosen);
  const unitLabel = clientCycle === "annual" ? "Ft/év" : "Ft/hó";
  check(
    "⑤ a kliens „Fizetendő most\" == a szerver ára UGYANARRA a halmazra",
    clientCycle !== null && clientAmount === serverAmount,
    `kliens ${clientAmount} ${unitLabel} · szerver ${serverAmount} ${unitLabel} (ütem: ${clientCycle ?? "NINCS egység"}) · halmaz: ${clientChosen.join(",")}`,
  );
  // N2 — az állítás nem üres: a függőségek NÉLKÜLI halmaz ára bizonyíthatóan más.
  const withoutDeps = clientChosen.filter((id) => !PULLED.includes(id));
  check(
    "N2 …és a kontroll nem üres: a függőségek nélküli halmaz ára ELTÉR",
    computeAnnual(withoutDeps) !== serverAnnual && computeMonthly(withoutDeps) !== computeMonthly(clientChosen),
    `függőség nélkül ${computeAnnual(withoutDeps)} Ft/év vs ${serverAnnual} Ft/év`,
  );
  check(
    "⑤ a kosár a TELJES láncot küldené be (a kliens halmaza érvényes)",
    CHAIN.every((id) => clientChosen.includes(id)),
    clientChosen.join(","),
  );

  if (SELFTEST) {
    console.log(notes.join("\n"));
    console.log(
      failures.length
        ? `\n⛔ module-dependency-cart-check --selftest: ${failures.length} állítás bukott:\n${failures.map((f) => `  ❌ ${f}`).join("\n")}`
        : `\n✅ module-dependency-cart-check --selftest: ${notes.length} állítás rendben (HTTP-kapu kihagyva).`,
    );
    process.exit(failures.length ? 1 : 0);
  }

  // ── ② A KÉZZEL GYÁRTOTT POST — a KISZÁLLÍTOTT végponton, nem forrás-grepből ──
  //
  // ⚠️ Két mellékhatást kell elvenni a boot-tól, MIELŐTT a modul kiértékelődik.
  // A hozzárendelés azért ér ide, mert az import DINAMIKUS — egy statikus import
  // a fájl tetején már lefutott volna (reference_env_assignment_loses_to_esm_imports).
  //   · CONSOLE_PORT=0 → efemer port. Fix 4600-on a szálak megölnék egymás
  //     szerverét, és a mérés a MÁSIK fa kódját kérdezné.
  //   · CIT_SHOT=1 → a boot-idejű nyelvi-csomag feltöltés (AI-hívás + DB-írás)
  //     kimarad; egy mérésnek nincs joga ilyet kiváltani.
  process.env.CONSOLE_PORT = "0";
  process.env.CIT_SHOT = "1";
  const mod = (await import("../src/console/server.js")) as { server: Server };
  server = mod.server;
  if (!server.listening) await once(server, "listening");
  const port = (server.address() as AddressInfo).port;
  // ⛔ FAIL-CLOSED: ha a port mégis a megosztott 4600 lenne, a mérés egy IDEGEN
  // (esetleg régebbi) szervert kérdezne, és zöldet adhatna a saját kódomra.
  if (port === 4600) {
    failures.push(
      "⛔ ŐR-HIBA: a mért szerver a MEGOSZTOTT 4600-as porton fut — a mérés nem a " +
        "saját fa kódját kérdezné. A CONSOLE_PORT=0 nem érvényesült.",
    );
    throw new Error("port guard");
  }
  /** Érvényes HU magánszemély vevő — minden, amit a számlázási kapu (0029) kér. */
  const BUYER = {
    buyer_type: "individual",
    buyer_name: "Teszt Elek",
    buyer_country: "HU",
    buyer_zip: "8360",
    buyer_city: "Keszthely",
    buyer_address: "Fő utca 1.",
    buyer_email: "elek@citoviso.com",
    withdrawal_waiver: true,
    terms_accepted: true,
  };
  const post = async (modules: string[]): Promise<{ status: number; error: string; missing: string[] }> => {
    const r = await fetch(`http://127.0.0.1:${port}/configure/${ARTIFACT_ID}/request`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        ...BUYER,
        modules,
        billing_period: "monthly",
        price: 0,
        domain_type: "citoviso_sub",
        photo_rights_declared: true,
        recurring_consent: true,
      }),
    });
    const b = (await r.json().catch(() => ({}))) as { error?: string; missing?: string[] };
    return { status: r.status, error: b.error ?? "", missing: b.missing ?? [] };
  };

  // A kár maga: a vezérlő a kötelező párja NÉLKÜL.
  const forged = await post([DRIVER!]);
  check(
    `② a kézzel gyártott POST (${labelOf(DRIVER!)} a párja nélkül) ELAKAD`,
    forged.status === 400 && forged.error === "module_dependency_unmet",
    `HTTP ${forged.status} · ${forged.error || "(nincs hibakód)"}`,
  );
  check(
    "② …és a válasz MEGNEVEZI, mi hiányzik (a kosár ebből pipál vissza)",
    forged.missing.length > 0 && forged.missing.every((id) => CHAIN.includes(id)),
    forged.missing.join(","),
  );
  // ⛔ A lánc KÖZEPE is: aki csak a szélső élt nézi, a hármas lánc közepét átengedi.
  if (PULLED.length > 1) {
    const mid = await post([DRIVER!, PULLED[0]!]);
    check(
      "② a lánc KÖZEPÉN megszakított halmaz is elakad",
      mid.status === 400 && mid.error === "module_dependency_unmet",
      `HTTP ${mid.status} · ${mid.error || "(nincs hibakód)"} · hiányzik: ${mid.missing.join(",")}`,
    );
  }
  // N1 — a kapu NEM tagadja meg az érvényes halmazt (ADR-0072 nem alku tárgya).
  const valid = await post(CHAIN);
  check(
    "N1 az ÉRVÉNYES halmazt a kapu ÁTENGEDI (nem tagadja meg a fizető vevőt)",
    valid.error !== "module_dependency_unmet",
    `HTTP ${valid.status} · ${valid.error || "(a kapun túljutott)"}`,
  );
  const empty = await post([]);
  check(
    "N1 …és az ÜRES halmaz sem ezen akad el (az ALL-IN tartalék útja)",
    empty.error !== "module_dependency_unmet",
    `HTTP ${empty.status} · ${empty.error || "(a kapun túljutott)"}`,
  );
} finally {
  server?.close();
}

console.log(notes.join("\n"));
if (failures.length) {
  console.error(
    `\n⛔ module-dependency-cart-check: ${failures.length} állítás bukott:\n${failures
      .map((f) => `  ❌ ${f}`)
      .join("\n")}`,
  );
  process.exit(1);
}
console.log(`\n✅ module-dependency-cart-check: ${notes.length} állítás rendben.`);
process.exit(0);
