// A LEAD-LAP JÓVÁHAGYOTT TERVÉNEK ŐRE — `assets/design-refs/console/lead-page/`
// (B változat: munkamenet-sáv és összehasonlító mock-tábla, tulajdonosi döntés 2026-09-14).
//
// A KIRENDERELT lapon mér, VALÓDI STÍLUSLAPPAL — mert a terv fele geometria (mi takar mit,
// mi ragad együtt), amire a forrás-grep és a `setContent` egyaránt vak.
//
// ⚠️⚠️ AMIT KÜLÖN KI KELL EMELNI: a fül-mondat LÁTHATÓSÁGÁT GEOMETRIÁVAL ítéli
// (`elementFromPoint`), nem a meglétével. A megvalósítás első változatában a mondat OTT
// VOLT a lapon, helyes szöveggel, és a teljes-lapos screenshot is „rendben"-nek mutatta —
// közben a RAGADÓS fülsor (top=60, bottom=111) TELJESEN rátakart (top=59, bottom=78), tehát
// az operátor soha nem látta. Egy „létezik-e az elem" próba ezt zölden átengedte volna
// (reference_fullpage_shot_hides_dead_sticky).
//
//   npx tsx scripts/lead-page-plan-check.mts
//   npx tsx scripts/lead-page-plan-check.mts --self-test   (PIROS önteszt)

process.env.CIT_SHOT = "1";

import { once } from "node:events";
import { existsSync, readFileSync, statSync } from "node:fs";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import path from "node:path";

import { chromium } from "playwright-core";

import { config } from "../src/config.js";
import type { ArtifactView, LeadDetail, ProspectView } from "../src/console/data.js";
import { runWithConsoleLang } from "../src/console/i18nCtx.js";
import { mockStatusLabel } from "../src/console/leadFilters.js";
import { leadPage } from "../src/console/views.js";

const SELF_TEST = process.argv.includes("--self-test");
const ROOT = path.resolve(import.meta.dirname, "..");

let bad = 0;
const ok = (label: string, cond: boolean, detail = ""): void => {
  console.log(`  ${cond ? "✅" : "⛔"} ${label}${!cond && detail ? ` — ${detail}` : ""}`);
  if (!cond) bad++;
};

// ── Fixture ─────────────────────────────────────────────────────────────────────
// KÉT artefaktum, AZONOS sablonnal és arculattal — pontosan az az eset, amiben a régi
// kártyák egyforma címet viseltek. A tábla akkor ér valamit, ha ezt a kettőt meg tudja
// különböztetni (más képszám, más nyitókép, más állapot).
const artifact = (over: Partial<ArtifactView> & { id: string }): ArtifactView =>
  ({
    status: "generated",
    path: `/tmp/${over.id}.html`,
    generatedAt: "2026-09-13T16:40:00.000Z",
    inputs: { template: "fullbleed", skin: "tuscan-terracotta", photos: 8, heroSubject: "bathroom", heroScore: 31 },
    decisions: [],
    ...over,
  }) as ArtifactView;

const APPROVED = artifact({
  id: "a-approved",
  status: "approved",
  generatedAt: "2026-09-14T11:18:00.000Z",
  inputs: {
    template: "fullbleed",
    skin: "tuscan-terracotta",
    photos: 10,
    heroSubject: "exterior",
    heroScore: 88,
    factVerdict: "pass",
    // ⛔ ÜRES mező: a terv ⑧ szerint MEG SEM JELENHET a recept-listán.
    heroReason: "",
    // ⚠️ A SZÖVEG-PANEL bemenete — enélkül az összeadó sáv MEG SEM SZÜLETIK, és a ⑥
    // állítás ÜRES HALMAZON mérne (az első futásom pont ezt jelentette).
    // A VALÓS alak: a nevező (18) nagyobb, mint a megnevezett (3 csoport) + kimaradt (1),
    // tehát van „ismétlés vagy általános" maradék is — épp ezt tette láthatóvá a terv.
    marketAmenityTotal: 18,
    marketFactsNamed: ["Játszótér", "Saját parkoló", "Kerthelyiség"],
    marketMissed: ["WiFi a közösségi terekben"],
    marketVerdict: "pass",
    // …és a KIMENET is kell: a `mockCopyPanel` üres sztringet ad, ha nincs se főcím, se
    // alcím, se kiemelés — tehát az összeadó sáv meg sem születne, és a ⑥ állítás
    // csendben üres halmazon mérne (feedback_fixture_must_prove_its_own_path).
    siteData: {
      tagline: "Csendes kert, házias konyha",
      intro: "Családias fogadó a Balaton partján.",
      highlights: ["Játszótér", "Saját parkoló", "Kerthelyiség"],
    },
    recipe: { sections: [{ kind: "hero", copy: { lead: "Nyugalom a vízparton" } }] },
  },
  decisions: [
    { decision: "approve", notes: "mehet ki", decidedBy: "olasz.ferenc", decidedAt: "2026-09-14T11:24:00.000Z" },
  ],
});
const REJECTED = artifact({
  id: "a-rejected",
  status: "rejected",
  decisions: [
    // ⛔ A NYERS `superseded_by:<uuid>` jegyzet — a terv ⑧ szerint MEGNEVEZETT alakban kell.
    { decision: "reject", notes: "superseded_by:a-approved", decidedBy: "olasz.ferenc", decidedAt: "2026-09-13T17:02:00.000Z" },
  ],
});

function lead(over: Partial<LeadDetail> = {}): LeadDetail {
  return {
    id: "11111111-2222-3333-4444-555555555555",
    name: "Őr-teszt Vendégház",
    qualification: "no_site",
    lifecycle: "new",
    matchConfidence: null,
    address: "Teszt utca 1.",
    region: "balaton-north",
    regionLabel: "Balaton",
    regionKnown: true,
    surveyedAt: "2026-09-04T06:00:00.000Z",
    // A MÉRT adat-alak: 11 portál + 1 Street View = 12, és 10 ment a mockba.
    raw: { material: { totalImages: 12, placesPhotos: 0, portalPhotos: 11, websiteImages: 0, streetView: true } },
    provenance: [],
    artifacts: [APPROVED, REJECTED],
    heroScores: {},
    heroPin: null,
    ...over,
  } as unknown as LeadDetail;
}

// ⚠️ TELJES objektum, NEM `as unknown as` csonk: a `scripts/` nincs a tsconfig
// include-jában, tehát egy hiányzó mezőt a fordító NEM fog meg — az első futásom pont
// ezen szállt el (`p.createdAt.slice` undefined-on). A típus-annotáció így valódi
// ellenőrzés, nem díszítés (reference_scripts_are_not_typechecked).
const prospect = (sentAt: string | null): ProspectView => ({
  id: "p-1",
  token: "tok",
  segment: "no_site",
  contactEmail: null,
  status: "created",
  sentAt,
  emailSentAt: sentAt,
  smsSentAt: null,
  mmsSentAt: null,
  unsubscribedAt: null,
  createdAt: "2026-09-14T09:00:00.000Z",
  artifactId: "a-approved",
  views: 12,
  events: 119,
  optoutLog: [],
});

type Gen = { running: boolean; startedAt?: string };
const render = (d: LeadDetail, gen: Gen = { running: false }, prospects: ProspectView[] = [prospect(null)]): string =>
  runWithConsoleLang(() => leadPage(d, gen as never, null, [], [], prospects));

// ── Kiszolgáló a STÍLUSLAPPAL (a `setContent` vak a CSS-re) ─────────────────────
const MIME: Record<string, string> = {
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
};
let served = "<!doctype html><title>üres</title>";
const assetServer = createServer((req, res) => {
  const url = new URL(req.url ?? "/", "http://localhost");
  if (url.pathname === "/") {
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    res.end(served);
    return;
  }
  const rel = path.normalize(url.pathname).replace(/^([/\\])+/, "");
  const abs = path.join(ROOT, "public", rel);
  if (!abs.startsWith(path.join(ROOT, "public")) || !existsSync(abs) || !statSync(abs).isFile()) {
    res.writeHead(404).end();
    return;
  }
  res.writeHead(200, { "content-type": MIME[path.extname(abs)] ?? "application/octet-stream" });
  res.end(readFileSync(abs));
});
assetServer.listen(0);
await once(assetServer, "listening");
const port = (assetServer.address() as AddressInfo).port;

const browser = await chromium.launch({ executablePath: config.chromiumPath });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

/**
 * PIROS ÖNTESZT — a visszarontás pontosan azt veszi el, amit a terv KÖT:
 * a fül-mondatot kiveszi a ragadós egységből (ez a megvalósítás MÉRT első hibája volt),
 * és elrejti az összeadó sávot.
 */
const BREAK_CSS = `
  .con .con-ltabs__head { position: static !important; }
  .con .con-ltabs__bar { position: sticky !important; top: 0 !important; z-index: 30 !important; }
  .con .con-ltabs__say { margin-top: -44px !important; background: transparent !important; }
  .con .cp-sum { display: none !important; }
  .con .con-wf { display: none !important; }
`;

async function open(html: string, width = 1280): Promise<void> {
  served = SELF_TEST ? html.replace("</head>", `<style>${BREAK_CSS}</style></head>`) : html;
  await page.setViewportSize({ width, height: 900 });
  await page.goto(`http://localhost:${port}/`, { waitUntil: "load" });
  await page.waitForTimeout(150);
}

// ═══ ① MUNKAMENET-SÁV ══════════════════════════════════════════════════════════
await open(render(lead()));
{
  const band = await page.evaluate(() => {
    const st = [...document.querySelectorAll<HTMLElement>(".con-wf__st")];
    const wrap = document.querySelector<HTMLElement>(".con-wf");
    // ⚠️ NINCS elnevezett belső függvény (a tsx `__name`-mel csomagolja, a böngészőben
    // nem létezik) — inline számolunk.
    const wrapRect = wrap ? wrap.getBoundingClientRect() : null;
    const visible = !!wrap && !!wrapRect && getComputedStyle(wrap).display !== "none" && wrapRect.height > 0 && wrapRect.width > 0;
    return {
      n: st.length,
      // ⛔ LÁTSZIK-E, nem csak létezik-e. Az öntesztem első változata elrejtette a sávot
      // (`display:none`), és MINDEN állomás-állítás zöld maradt — a DOM-ban ott voltak.
      // Egy elrejtett sáv pontosan azt a hibát hozná vissza, amit a terv lezár.
      visible,
      keys: st.map((x) => x.getAttribute("data-station") ?? ""),
      states: st.map((x) => x.getAttribute("data-state") ?? ""),
      // ⛔ NÉMA GONDOLATJEL SEHOL: minden állomás mond valamit.
      empty: st.filter((x) => !(x.querySelector(".con-wf__v")?.textContent ?? "").trim()).length,
      dashOnly: st.filter((x) => ((x.querySelector(".con-wf__v")?.textContent ?? "").trim() === "–")).length,
      next: st.filter((x) => x.getAttribute("data-state") === "next").length,
      nextKey: st.find((x) => x.getAttribute("data-state") === "next")?.getAttribute("data-station") ?? "",
    };
  });
  ok("① a munkamenet-sáv LÁTSZIK a lapon (nem csak a DOM-ban van)", band.visible, "elrejtve vagy nulla méretű");
  ok("① a sáv HAT állomást visel", band.n === 6, `${band.n}: ${band.keys.join(", ")}`);
  ok(
    "① a sorrend a munkamenet sorrendje",
    band.keys.join(",") === "collected,mock,approved,sent,ordered,paid",
    band.keys.join(","),
  );
  ok("① egyetlen állomás sem néma (nincs üres és nincs csupasz gondolatjel)", band.empty === 0 && band.dashOnly === 0, JSON.stringify(band));
  ok("① PONTOSAN EGY állomás jelöli magát következőnek", band.next === 1, `${band.next} db`);
  ok("① és az a KIKÜLDVE (a fixture-ben ez a soron következő)", band.nextKey === "sent", band.nextKey);
  // A megtett állomások DÁTUMOT mondanak — enélkül a sáv csak színes doboz lenne.
  const done = await page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>('.con-wf__st[data-state="done"]')].map(
      (x) => (x.querySelector(".con-wf__v")?.textContent ?? "").trim(),
    ),
  );
  ok(
    "① a megtett állomások VALÓDI dátumot mondanak",
    done.length >= 3 && done.every((t) => /^\d{4}-\d{2}-\d{2}$/.test(t)),
    done.join(" | "),
  );
}

// ═══ ② ADAT-MEGBÍZHATÓSÁG — a KÖVETKEZMÉNYÉVEL ════════════════════════════════
{
  const t = await page.evaluate(() => {
    const el = document.querySelector<HTMLElement>("[data-cit-trust]");
    return el ? { kind: el.getAttribute("data-cit-trust"), text: (el.textContent ?? "").trim() } : null;
  });
  ok("② van adat-megbízhatóság sor", t !== null);
  ok("② mért érték nélkül azt mondja, hogy NEM MÉRT", t?.kind === "none", String(t?.kind));
  ok(
    "② …és KIMONDJA, mi következik belőle (mit tegyen az operátor)",
    (t?.text ?? "").includes("Adatok fület"),
    t?.text.slice(0, 90) ?? "",
  );
  // A nagy metrika-szám KIVEZETVE: ha visszatér, a terv ② értelmét veszti.
  const bigMetric = await page.evaluate(() => document.querySelectorAll(".con-lhead__big").length);
  ok("② a régi nagy metrika-szám nincs a fejlécben", bigMetric === 0, `${bigMetric} db`);
}

// ═══ ③ FÜL-MONDAT — GEOMETRIÁVAL, nem a meglétével ════════════════════════════
{
  const say = await page.evaluate(() => {
    const el = document.querySelector<HTMLElement>("[data-cit-tabsay]");
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const hit = document.elementFromPoint(Math.round(r.left + 12), Math.round(r.top + r.height / 2));
    return {
      text: (el.textContent ?? "").trim(),
      inView: r.top >= 0 && r.top < window.innerHeight && r.height > 0,
      covered: !!hit && !el.contains(hit) && hit !== el,
      coverer: hit && !el.contains(hit) && hit !== el ? ((hit as HTMLElement).className || hit.tagName) : "",
      counters: document.querySelectorAll(".con-ltab__n").length,
    };
  });
  ok("③ van fül-mondat, tartalommal", !!say && say.text.length > 10, say?.text ?? "");
  ok("③ a mondat a LÁTHATÓ területen van", !!say?.inView);
  ok(
    "③⭐ …és SEMMI NEM TAKARJA (a ragadós fülsor sem) — ez volt a megvalósítás első hibája",
    say?.covered === false,
    `takaró: ${say?.coverer}`,
  );
  ok("③ a magyarázat nélküli fül-SZÁMLÁLÓK kivezetve", say?.counters === 0, `${say?.counters} db maradt`);

  // A mondat KÖVETI a fül-váltást — különben egy állandó sor lenne, nem tájékoztatás.
  const before = say?.text ?? "";
  await page.click('.con-ltab[data-tab="ls-photos"]');
  await page.waitForTimeout(150);
  const after = (await page.textContent("[data-cit-tabsay]"))?.trim() ?? "";
  ok("③ a mondat KÖVETI a fül-váltást", after !== before && after.length > 10, `„${before}" → „${after}"`);
  // …és a FOTÓK fül is mond magáról valamit (eddig egyetlen száma sem volt).
  ok("③ a Fotók fül is mond magáról valamit", /kép/i.test(after), after);
}

// ═══ ④ ÖSSZEHASONLÍTÓ MOCK-TÁBLA ══════════════════════════════════════════════
{
  await page.click('.con-ltab[data-tab="ls-mocks"]');
  await page.waitForTimeout(150);
  const tbl = await page.evaluate(() => {
    const t = document.querySelector("[data-cit-mockcompare] table");
    if (!t) return null;
    // ⚠️ NINCS elnevezett belső függvény: a tsx/esbuild `__name`-mel csomagolja őket,
    // ami a böngészőben nem létezik (a futás ReferenceError-ral halt meg).
    const rows = [...t.querySelectorAll("tbody tr")];
    const cells = rows.map((tr) =>
      [...tr.querySelectorAll("td")].map((td) => (td.textContent ?? "").replace(/\s+/g, " ").trim()),
    );
    return {
      rows: rows.length,
      heads: [...t.querySelectorAll("thead th")].map((th) => (th.textContent ?? "").trim()),
      first: cells[0] ?? [],
      second: cells[1] ?? [],
    };
  });
  ok("④ van összehasonlító mock-tábla", tbl !== null);
  if (tbl) {
    ok("④ mindkét mock SORKÉNT szerepel", tbl.rows === 2, `${tbl.rows} sor`);
    ok(
      "④ a fejléc a KÜLÖNBSÉG tengelyeit nevezi meg",
      ["Készült", "Sablon / arculat", "Kép", "Nyitókép", "Állapot", "Döntés"].every((h) => tbl.heads.includes(h)),
      tbl.heads.join(" | "),
    );
    // ⛔ A LÉNYEG: azonos sablonú mockok NEM olvadnak össze — a sorok eltérnek.
    ok(
      "④⭐ az AZONOS sablonú két mock sora TÉNYLEGESEN különbözik",
      tbl.first.join("|") !== tbl.second.join("|"),
      `azonos sorok: ${tbl.first.join(" · ")}`,
    );
  }
}

// ═══ ⑧ NINCS GÉPI SZÖVEG ══════════════════════════════════════════════════════
{
  const m = await page.evaluate(() => {
    const txt = document.body.innerText || "";
    return {
      rawEnums: ["approved", "generated", "rejected", "approve", "reject"].filter((w) =>
        new RegExp(`(^|[^a-z])${w}([^a-z]|$)`, "i").test(txt),
      ),
      rawContext: (() => {
        const m = /(^|[^a-z])(approved|generated|rejected)([^a-z]|$)/i.exec(txt);
        return m ? txt.slice(Math.max(0, m.index - 60), m.index + 60).replace(/\s+/g, " ") : "";
      })(),
      uuidNote: /superseded_by:/i.test(txt),
      // A NYERS `kulcs=érték` a kinyitható fejlesztői blokkban ÉL — az operátor szeme
      // előtt viszont nem állhat. A `<details>` ZÁRT tartalma nem kerül az innerText-be.
      keyValue: /\b[a-z][a-zA-Z]+=[^\s<]/.test(txt),
      emptyMeta: [...document.querySelectorAll(".con-recipe dd")].filter((x) => !(x.textContent ?? "").trim()).length,
    };
  });
  ok("⑧ nyers adatbázis-enum SEHOL nem látszik", m.rawEnums.length === 0, `${m.rawEnums.join(", ")} · környezet: „${m.rawContext}"`);
  ok("⑧ a `superseded_by:<uuid>` jegyzet MEGNEVEZETT alakra cserélve", !m.uuidNote);
  ok("⑧ nyers `kulcs=érték` nem áll az operátor szeme előtt", !m.keyValue);
  ok("⑧ ÜRES recept-mező meg sem jelenik", m.emptyMeta === 0, `${m.emptyMeta} üres`);
}

// ═══ ⑤ KÉPANYAG — EGY SZÁM, LEVEZETVE ═════════════════════════════════════════
{
  await page.click('.con-ltab[data-tab="ls-data"]');
  await page.waitForTimeout(150);
  const img = await page.evaluate(() => {
    const el = document.querySelector<HTMLElement>("[data-cit-images]");
    return el ? { attr: el.getAttribute("data-cit-images"), text: (el.textContent ?? "").replace(/\s+/g, " ").trim() } : null;
  });
  ok("⑤ a képanyag EGY levezetett állítás", img !== null, "nincs [data-cit-images]");
  ok("⑤ …és megmondja, mennyi ment a mockba", (img?.text ?? "").includes("10"), img?.text ?? "");
  ok("⑤ az összeg a MÉRT adatból jön (12)", (img?.attr ?? "").startsWith("12/"), String(img?.attr));
}

// ═══ ⑥ AZ ÖSSZEADÁS KIJÖN ═════════════════════════════════════════════════════
{
  await page.click('.con-ltab[data-tab="ls-mocks"]');
  await page.waitForTimeout(150);
  const sc = await page.evaluate(() => {
    const el = document.querySelector<HTMLElement>("[data-cit-scale]");
    if (!el) return null;
    const [u, m2, r, t] = (el.getAttribute("data-cit-scale") ?? "").split("/").map(Number);
    const rect = el.getBoundingClientRect();
    // ⛔ Ugyanaz a szabály, mint a sávnál: a LÁTHATÓSÁG a mérce, nem a DOM-jelenlét.
    const vis = getComputedStyle(el).display !== "none" && rect.height > 0;
    return { u, m: m2, r, t, vis, text: (el.textContent ?? "").replace(/\s+/g, " ").trim() };
  });
  if (sc === null) {
    ok("⑥ van összeadó sáv", false, "nincs [data-cit-scale] (a fixture nem termel szöveg-elemzést?)");
  } else {
    ok("⑥ az összeadó sáv LÁTSZIK (nem csak a DOM-ban van)", sc.vis);
    ok("⑥⭐ a három szakasz KIADJA a nevezőt", sc.u + sc.m + sc.r === sc.t, `${sc.u}+${sc.m}+${sc.r} ≠ ${sc.t}`);
    ok("⑥ a lap KI IS ÍRJA az összeadást", /\d\+\d+\+\d+\s*=\s*\d/.test(sc.text), sc.text.slice(0, 80));
    ok("⑥ …és kimondja, hogy a nevező változhat", /változhat/.test(sc.text), sc.text.slice(-60));
  }
}

// ═══ ⑦ FUTÁS KÖZBEN SEM VÉSZ EL A JÓVÁHAGYOTT TÉNY ════════════════════════════
{
  await open(render(lead(), { running: true, startedAt: new Date(Date.now() - 65_000).toISOString() }));
  const run = await page.evaluate(() => {
    const mock = document.querySelector<HTMLElement>('.con-wf__st[data-station="mock"]');
    const appr = document.querySelector<HTMLElement>('.con-wf__st[data-station="approved"]');
    return {
      mockState: mock?.getAttribute("data-state") ?? "",
      mockText: (mock?.querySelector(".con-wf__v")?.textContent ?? "").replace(/\s+/g, " ").trim(),
      apprState: appr?.getAttribute("data-state") ?? "",
      apprText: (appr?.querySelector(".con-wf__v")?.textContent ?? "").trim(),
    };
  });
  ok("⑦ futás közben a MOCK állomás a futást mondja", run.mockState === "running", JSON.stringify(run));
  ok("⑦ …az eltelt idővel", /\d+:\d\d/.test(run.mockText), run.mockText);
  ok(
    "⑦⭐ …ÉS A JÓVÁHAGYVA ÁLLOMÁS A HELYÉN MARAD, a saját dátumával",
    run.apprState === "done" && /^\d{4}-\d{2}-\d{2}$/.test(run.apprText),
    `${run.apprState} / „${run.apprText}"`,
  );
}

// ═══ ⑨ A GOMB A SAJÁT TETTÉT MONDJA ═══════════════════════════════════════════
{
  await open(render(lead()));
  await page.click('.con-ltab[data-tab="ls-outreach"]');
  await page.waitForTimeout(150);
  const txt = await page.evaluate(() => document.body.innerText || "");
  ok("⑨ a gomb nem állítja, hogy „mérés indul”", !/mérés indul/i.test(txt));
}

// ═══ ⑩ TELEFONON A SÁV FÜGGŐLEGES ═════════════════════════════════════════════
{
  await open(render(lead()), 390);
  const geo = await page.evaluate(() => {
    const st = [...document.querySelectorAll<HTMLElement>(".con-wf__st")];
    const tops = st.map((x) => Math.round(x.getBoundingClientRect().top));
    const distinct = new Set(tops).size;
    const wrap = document.querySelector<HTMLElement>(".con-wf")!;
    return { distinct, n: st.length, overflow: wrap.scrollWidth - wrap.clientWidth };
  });
  ok(
    "⑩⭐ 390 px-en az állomások EGYMÁS ALATT állnak (nem egy sorban)",
    geo.distinct === geo.n,
    `${geo.distinct} különböző y-pozíció / ${geo.n} állomás`,
  );
  ok("⑩ …és a sáv nem görget oldalra", geo.overflow <= 0, `${geo.overflow}px túllógás`);
}

// ── Zárás ───────────────────────────────────────────────────────────────────────
await browser.close();
assetServer.close();

if (SELF_TEST) {
  console.log("\n⚑ ÖNTESZT: a futás a VISSZARONTOTT lapon ment (a fül-mondat kikerült a ragadós");
  console.log("   egységből, az összeadó sáv és a munkamenet-sáv elrejtve).");
  const caught = bad > 0;
  console.log(
    caught
      ? `  ✅ az őr képes pirosra menni — ${bad} állítás bukott el a visszarontott lapon.`
      : "  ⛔ AZ ÖNTESZT BUKOTT: az őr a visszarontott lapot is átengedte.",
  );
  process.exit(caught ? 0 : 1);
}

console.log(
  bad === 0
    ? `\n✅ A lead-lap a jóváhagyott terv szerint viselkedik (a „${mockStatusLabel("approved", "hu")}" tény futás közben is megmarad).`
    : `\n⛔ ${bad} eltérés a jóváhagyott tervtől (assets/design-refs/console/lead-page/).`,
);
process.exit(bad === 0 ? 0 : 1);
