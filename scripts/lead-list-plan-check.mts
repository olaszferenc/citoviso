// A LEAD-LISTA JÓVÁHAGYOTT TERVÉNEK ŐRE — `assets/design-refs/console/lead-list/`
// („A — Tábla, ragadó NÉV oszloppal”, tulajdonosi döntés 2026-09-14).
//
// ⚠️⚠️ A LEGFONTOSABB ÁLLÍTÁS, ÉS AMIÉRT KÜLÖN KIKÖTÉS SZÜLETETT RÁ:
// **a ragadást VALÓDI GÖRGETÉSSEL mérjük, nem a DOM-ból következtetve.**
// A `position: sticky` a forrásban és a `getComputedStyle`-ban is „beállítottnak” látszik
// akkor is, ha SOHA nem tapad (elég egy `overflow` a rossz szülőn vagy egy ütköző
// `position`), a teljes-lapos screenshot pedig a sticky elemet a VÉGLEGES helyére festi —
// egy sosem tapadó oszlop is zöldnek látszana rajta
// (`reference_fullpage_shot_hides_dead_sticky`). Ezért az őr ELGÖRGETI a konténert, és a
// NÉV cella KÉPERNYŐ-KOORDINÁTÁJÁT hasonlítja össze görgetés előtt és után — plusz egy
// NEM-ragadó oszlopon igazolja, hogy a görgetés tényleg megtörtént (különben egy halott
// görgető-doboz is „ragadásnak” látszana).
//
// A többi kontraktus-pont ugyanígy a KIRENDERELT lapon dől el, valódi stíluslappal:
// a jelmagyarázat helye és érkezési állapota, a felső lapozó, a magyar állapot-szavak,
// a tizedesvessző, a plafon- és alapérték-jelölés, a két jelvény-ALAK, a `nowrap` és az
// egyenletes sormagasság.
//
//   npx tsx scripts/lead-list-plan-check.mts
//   npx tsx scripts/lead-list-plan-check.mts --self-test   (PIROS önteszt)

process.env.CIT_SHOT = "1";

import { once } from "node:events";
import { existsSync, readFileSync, statSync } from "node:fs";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import path from "node:path";

import { chromium } from "playwright-core";

import { config } from "../src/config.js";
import { buildLeadListResult, type LeadListRow, type LeadQuery } from "../src/console/data.js";
import { runWithConsoleLang } from "../src/console/i18nCtx.js";
import { MOCK_STATUSES, mockStatusLabel, PLACES_PHOTO_CAP } from "../src/console/leadFilters.js";
import { leadsPage } from "../src/console/views.js";

const SELF_TEST = process.argv.includes("--self-test");
const ROOT = path.resolve(import.meta.dirname, "..");

let bad = 0;
const ok = (label: string, cond: boolean, detail = ""): void => {
  console.log(`  ${cond ? "✅" : "⛔"} ${label}${!cond && detail ? ` — ${detail}` : ""}`);
  if (!cond) bad++;
};

// ── Fixture ─────────────────────────────────────────────────────────────────────
// Szándékosan a VALÓS korpusz alakja: a plafonon ülő és 0 fotós sorok (365 / 168 a 595-ből),
// az alapérték-match (54 lead), a match nélküliek (109), és egy kiküldött megkeresés —
// mind a NÉGY jelölés, amit a terv kiköt. A `proveFixture` lentebb megtagadja a futást,
// ha bármelyik alak eltűnik (feedback_fixture_must_prove_its_own_path).
function row(i: number, over: Partial<LeadListRow> = {}): LeadListRow {
  return {
    id: `lead-${i}`,
    name: `Teszt Szállás ${i}`,
    qualification: "no_site",
    matchConfidence: 0.42,
    region: "balaton-north",
    regionLabel: "Balaton",
    regionKnown: true,
    surveyedAt: new Date(Date.UTC(2026, 6, 1 + (i % 60), 6, (i * 7) % 60)).toISOString(),
    country: "HU",
    city: "Siófok",
    photos: 4,
    streetView: false,
    material: 7,
    contact: "email",
    lifecycle: "new",
    latestArtifact: null,
    outreachSentAt: null,
    ...over,
  };
}

const FIXTURE: LeadListRow[] = [
  // A PLAFONON ülő sorok (a valós korpuszban 365/595).
  ...Array.from({ length: 12 }, (_, i) => row(i, { photos: PLACES_PHOTO_CAP, material: 12 + i })),
  // Plafon ALATT — enélkül a „csak a plafonon van jelölés” állítás üres halmazon mérne.
  ...Array.from({ length: 6 }, (_, i) => row(100 + i, { photos: 2 + i, material: 5 + i })),
  // ALAPÉRTÉK-match (a valós korpuszban 54 lead áll pontosan itt).
  ...Array.from({ length: 5 }, (_, i) => row(200 + i, { matchConfidence: 0.85, material: 6 })),
  // Match NÉLKÜL (109 lead) — itt a cellának „nincs találat”-ot kell írnia.
  ...Array.from({ length: 5 }, (_, i) => row(300 + i, { matchConfidence: null, material: 6 })),
  // Mind a négy MOCK-állapot, plusz egy KIKÜLDÖTT megkeresés (a „✓ kiküldve” jelöléshez).
  ...MOCK_STATUSES.filter((s) => s !== "none").map((status, i) =>
    row(400 + i, {
      material: 8,
      latestArtifact: { id: `art-${i}`, status, path: `/tmp/a${i}.html` } as LeadListRow["latestArtifact"],
      outreachSentAt: i === 0 ? "2026-09-04T10:12:00.000Z" : null,
    }),
  ),
  // HOSSZÚ NÉV — a kétsoros vágás és az egyenletes sormagasság ezen dől el.
  row(500, { name: "Nagyon Hosszú Nevű Balatoni Panzió és Étterem Vendégház", material: 9 }),
  row(501, { name: "Rövid", material: 9 }),
  // ⚠️ TÖLTELÉK a LAPOZÓHOZ: a `leadPager` üres sztringet ad, ha egy lapra minden kifér —
  // a „van felső lapozó" állítás enélkül ÜRES HALMAZON mérne, és zöld lenne a lapozó
  // eltűnésekor is. Ennyi sor biztosan több lapot ad (LEAD_PAGE_SIZE = 50).
  ...Array.from({ length: 70 }, (_, i) => row(1000 + i, { material: 4 })),
];

const render = (q: LeadQuery): string =>
  runWithConsoleLang(() => leadsPage(buildLeadListResult(FIXTURE, q), q));

// ── Kiszolgáló a STÍLUSLAPPAL (a `setContent` vak a CSS-re) ──────────────────────
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
const assetPort = (assetServer.address() as AddressInfo).port;

const browser = await chromium.launch({ executablePath: config.chromiumPath });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

/**
 * PIROS ÖNTESZT: a visszarontás a KIRENDERELT lapon történik, stílus-injektálással —
 * pontosan azt veszi el, amit a terv kiköt. Ha egy állítás ettől NEM megy pirosra, az
 * az állítás nem mér semmit.
 */
const BREAK_CSS = `
  /* a ragadás kikapcsolva — a NÉV oszlop együtt csúszik a többivel */
  .con .con-leadtbl td[data-col="name"], .con .con-leadtbl th[data-col="name"] { position: static !important; }
  /* a jelvény-alakok egyformává téve */
  .con .cf-btn i.cf-thresh { border: 0 !important; border-radius: 999px !important;
    background: var(--citui-cyan-500) !important; color: #fff !important; }
  /* a jelölés újra tördelhető */
  .con .pill { white-space: normal !important; }
  /* a görgetés-jelzés elrejtve */
  .con .con-scrollhint { display: none !important; }
`;

async function open(html: string, width: number): Promise<void> {
  served = SELF_TEST ? html.replace("</head>", `<style>${BREAK_CSS}</style></head>`) : html;
  await page.setViewportSize({ width, height: 900 });
  await page.goto(`http://localhost:${assetPort}/`, { waitUntil: "load" });
  await page.waitForTimeout(120);
}

const Q: LeadQuery = { all: true, pageSize: 0 };
/** LAPOZOTT nézet — a lapozó csak itt renderel (egy lapra férő listán nincs mit lapozni). */
const Q_PAGED: LeadQuery = { all: true };

// ═══ 1. A FIXTURE BIZONYÍTJA A SAJÁT ÚTJÁT ═══════════════════════════════════════
await open(render(Q), 1280);
{
  // ⚠️ NINCS elnevezett belső függvény az `evaluate`-ben: a tsx/esbuild `__name`-mel
  // csomagolja őket, ami a böngészőben nem létezik (a futás `ReferenceError`-ral halt).
  const shapes = await page.evaluate((cap) => {
    const photos = [...document.querySelectorAll<HTMLElement>('tbody td[data-col="photos"]')].map(
      (td) => td.getAttribute("data-v") ?? "",
    );
    const match = [...document.querySelectorAll<HTMLElement>('tbody td[data-col="match"]')].map(
      (td) => td.getAttribute("data-v") ?? "",
    );
    return {
      atCap: photos.filter((x) => Number(x) >= cap).length,
      belowCap: photos.filter((x) => Number(x) < cap).length,
      baseMatch: match.filter((x) => Math.abs(Number(x) - 0.85) < 1e-6).length,
      noMatch: match.filter((x) => Number(x) < 0).length,
      sentPills: document.querySelectorAll('tbody td[data-col="mock"] .pill.approved').length,
    };
  }, PLACES_PHOTO_CAP);
  ok("a fixture tartalmaz PLAFONON ülő ÉS plafon alatti sort", shapes.atCap > 0 && shapes.belowCap > 0, JSON.stringify(shapes));
  ok("…alapérték-matchet ÉS match nélküli sort", shapes.baseMatch > 0 && shapes.noMatch > 0, JSON.stringify(shapes));
  ok("…és kiküldött megkeresést", shapes.sentPills > 0, JSON.stringify(shapes));
}

// ═══ 2. ① A JELMAGYARÁZAT A TÁBLA FÖLÖTT, ÉS A „?” A SAJÁT SORÁRA NYIT ══════════
{
  const pos = await page.evaluate(() => {
    const lg = document.querySelector(".con-legend")!;
    const tbl = document.querySelector(".tblwrap")!;
    return {
      legendBeforeTable: !!(lg.compareDocumentPosition(tbl) & Node.DOCUMENT_POSITION_FOLLOWING),
      open: (lg as HTMLDetailsElement).open,
      helpButtons: document.querySelectorAll("thead .con-helpq").length,
      columns: document.querySelectorAll("thead th[data-col]").length,
    };
  });
  ok("① a jelmagyarázat a TÁBLÁZAT ELŐTT áll (nem a lap alján)", pos.legendBeforeTable);
  ok("① asztalin NYITVA fogad", pos.open);
  ok("① MINDEN oszlop fejléce visel „?” gombot", pos.helpButtons === pos.columns, `${pos.helpButtons}/${pos.columns}`);

  // A „?” a SAJÁT oszlopának sorát emeli ki — érintőképernyőn ez az egyetlen út.
  await page.click('thead th[data-col="photos"] .con-helpq');
  await page.waitForTimeout(150);
  const hit = await page.evaluate(() => ({
    onPhotos: !!document.querySelector('.con-legend li[data-legend="photos"].on'),
    onOthers: document.querySelectorAll(".con-legend li.on").length,
  }));
  ok("① a Fotók „?” a FOTÓK jelmagyarázat-sorát emeli ki", hit.onPhotos && hit.onOthers === 1, JSON.stringify(hit));
}

// ═══ 3. ② LAPOZÓ FELÜL IS ════════════════════════════════════════════════════════
await open(render(Q_PAGED), 1280);
{
  const pages = await page.evaluate(() => document.querySelectorAll('[data-pager] .con-pager__p, [data-pager] .con-pager__at').length);
  ok("② a fixture TÖBB lapot ad (különben a lapozó-állítás üres halmazon mérne)", pages > 1, `${pages} lap-gomb`);
  const p = await page.evaluate(() => ({
    top: !!document.querySelector('[data-pager="top"]'),
    bottom: !!document.querySelector('[data-pager="bottom"]'),
    topBeforeTable: (() => {
      const t = document.querySelector('[data-pager="top"]');
      const tbl = document.querySelector(".tblwrap")!;
      return !!t && !!(t.compareDocumentPosition(tbl) & Node.DOCUMENT_POSITION_FOLLOWING);
    })(),
  }));
  ok("② van FELSŐ lapozó, a táblázat előtt", p.top && p.topBeforeTable, JSON.stringify(p));
  ok("② és megmaradt az ALSÓ is", p.bottom, JSON.stringify(p));
}
await open(render(Q), 1280);

// ═══ 4. ③ MAGYAR ÁLLAPOT-SZAVAK — nyers enum SEHOL a látható szövegben ══════════
{
  const raw = await page.evaluate(() => {
    const txt = (document.body.innerText || "").toLowerCase();
    return ["approved", "generated", "rejected"].filter((w) => txt.includes(w));
  });
  ok("③ a nyers adatbázis-érték SEHOL nem látszik a lapon", raw.length === 0, raw.join(", "));
  const cells = await page.$$eval('tbody td[data-col="mock"] .pill', (ps) =>
    ps.map((p) => (p.textContent ?? "").trim()),
  );
  const want = MOCK_STATUSES.filter((s) => s !== "none").map((s) => mockStatusLabel(s, "hu"));
  ok(
    "③ a MOCK cellák a regiszter magyar szavait írják",
    want.every((w) => cells.includes(w)),
    `várt: ${want.join("/")} · kapott: ${[...new Set(cells)].join("/")}`,
  );
  const opts = await page.$$eval('#leadFilters th[data-col="mock"] .cf-opt span', (ss) =>
    ss.map((s) => (s.textContent ?? "").trim()),
  );
  ok(
    "③ …és a SZŰRŐ-OPCIÓK ugyanazokat (nem külön kézzel írt listát)",
    MOCK_STATUSES.every((s) => opts.includes(mockStatusLabel(s, "hu"))),
    opts.join(" / "),
  );
}

// ═══ 5. ④ TIZEDESVESSZŐ — a cellában ÉS az őt leíró mondatban ═══════════════════
{
  const m = await page.evaluate(() => {
    const cells = [...document.querySelectorAll<HTMLElement>('tbody td[data-col="match"]')]
      .map((td) => (td.textContent ?? "").trim())
      .filter((t) => /\d/.test(t));
    return { withDot: cells.filter((t) => /\d\.\d/.test(t)).length, sample: cells.slice(0, 3) };
  });
  ok("④ a Match-cellában nincs tizedesPONT", m.withDot === 0, `${m.withDot} cella · pl. ${m.sample.join(", ")}`);
}
{
  await open(render({ ...Q, minMatch: 0.8 }), 1280);
  const summary = (await page.textContent("[data-filter-summary]"))?.trim() ?? "";
  ok("④ a szűrő-MONDAT is vesszőt ír (egy formázó, egy szabály)", /legalább\s+0,8/.test(summary), summary);
  const thresh = (await page.textContent('th[data-col="match"] .cf-thresh'))?.trim() ?? "";
  ok("④ …és a küszöb-JELVÉNY is", thresh.includes("0,8"), thresh);
}

// ═══ 6. ⑤ PLAFON + ⑥ ALAPÉRTÉK ══════════════════════════════════════════════════
await open(render(Q), 1280);
{
  const c = await page.evaluate((cap) => {
    const tds = [...document.querySelectorAll<HTMLElement>('tbody td[data-col="photos"]')];
    const atCap = tds.filter((td) => Number(td.getAttribute("data-v")) >= cap);
    const below = tds.filter((td) => Number(td.getAttribute("data-v")) < cap);
    return {
      capMarked: atCap.filter((td) => td.querySelector(".con-cap")).length,
      capTotal: atCap.length,
      belowMarked: below.filter((td) => td.querySelector(".con-cap")).length,
      plusSign: atCap.filter((td) => (td.textContent ?? "").includes("+")).length,
    };
  }, PLACES_PHOTO_CAP);
  ok("⑤ MINDEN plafonon ülő cella jelöli, hogy ez felső korlát", c.capMarked === c.capTotal && c.capTotal > 0, JSON.stringify(c));
  ok("⑤ …és a plafon ALATTI cellák NEM (a jelölés nem dekoráció)", c.belowMarked === 0, JSON.stringify(c));
  ok("⑤ a szám „10+” alakban áll", c.plusSign === c.capTotal, JSON.stringify(c));

  const b = await page.evaluate(() => {
    const tds = [...document.querySelectorAll<HTMLElement>('tbody td[data-col="match"]')];
    const base = tds.filter((td) => Math.abs(Number(td.getAttribute("data-v")) - 0.85) < 1e-6);
    const other = tds.filter((td) => Number(td.getAttribute("data-v")) > 0 && Math.abs(Number(td.getAttribute("data-v")) - 0.85) >= 1e-6);
    const none = tds.filter((td) => Number(td.getAttribute("data-v")) < 0);
    return {
      baseMarked: base.filter((td) => td.querySelector(".con-basev")).length,
      baseTotal: base.length,
      otherMarked: other.filter((td) => td.querySelector(".con-basev")).length,
      noneText: none.map((td) => (td.textContent ?? "").trim())[0] ?? "",
      noneDash: none.filter((td) => (td.textContent ?? "").trim() === "–").length,
    };
  });
  ok("⑥ az ALAPÉRTÉK (0,85) minden cellában jelölve", b.baseMarked === b.baseTotal && b.baseTotal > 0, JSON.stringify(b));
  ok("⑥ …és a MÉRT értékek NEM (különben a jelölés semmit nem mondana)", b.otherMarked === 0, JSON.stringify(b));
  ok("⑥ a hiányzó match SZÖVEGESEN áll, nem néma gondolatjelként", b.noneDash === 0 && b.noneText.length > 2, `„${b.noneText}”`);
}

// ═══ 7. ⑦ KÉT JELENTÉS = KÉT ALAK (geometriával, nem osztálynévvel) ═════════════
{
  await open(render({ ...Q, qualification: ["no_site"], minMaterial: 1 }), 1280);
  const shapes = await page.evaluate(() => {
    const cnt = document.querySelector<HTMLElement>(".cf-btn i.cf-count");
    const thr = document.querySelector<HTMLElement>(".cf-btn i.cf-thresh");
    if (!cnt || !thr) return null;
    const cs = getComputedStyle(cnt);
    const ts = getComputedStyle(thr);
    return {
      countRadius: parseFloat(cs.borderTopLeftRadius) || 0,
      threshRadius: parseFloat(ts.borderTopLeftRadius) || 0,
      countBorder: parseFloat(cs.borderTopWidth) || 0,
      threshBorder: parseFloat(ts.borderTopWidth) || 0,
      countFilled: cs.backgroundColor,
      threshFilled: ts.backgroundColor,
      threshText: (thr.textContent ?? "").trim(),
    };
  });
  ok("⑦ mindkét jelvény jelen van egyszerre (ez a megtévesztő eset)", shapes !== null);
  if (shapes) {
    ok(
      "⑦ a KÜSZÖB szögletes, a DARABSZÁM kerek (sarok-sugár szerint)",
      shapes.threshRadius < shapes.countRadius / 2,
      `küszöb ${shapes.threshRadius}px vs darabszám ${shapes.countRadius}px`,
    );
    ok(
      "⑦ a KÜSZÖB körvonalas, a DARABSZÁM kitöltött",
      shapes.threshBorder > 0 && shapes.countBorder === 0 && shapes.countFilled !== shapes.threshFilled,
      JSON.stringify(shapes),
    );
    ok("⑦ a küszöb-jelvény „≥” jelet visel", shapes.threshText.startsWith("≥"), shapes.threshText);
  }
}

// ═══ 8. ⑧ A „✓ kiküldve” EGY SORBAN ═════════════════════════════════════════════
await open(render(Q), 1280);
{
  const sent = await page.evaluate(() => {
    const el = [...document.querySelectorAll<HTMLElement>('tbody td[data-col="mock"] .pill')].find((p) =>
      (p.textContent ?? "").includes("kiküldve"),
    );
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const lh = parseFloat(getComputedStyle(el).lineHeight) || 16;
    return { h: Math.round(r.height), lh: Math.round(lh), ws: getComputedStyle(el).whiteSpace };
  });
  ok("⑧ a „✓ kiküldve” jelölés a lapon van", sent !== null);
  if (sent) {
    // ⚠️ KÉT RÉTEG, mert a geometria EGYEDÜL nem mér semmit: 1280 px-en a MOCK oszlop
    // elég széles ahhoz, hogy a jelölés tördelés-engedéllyel SE törjön meg — az első
    // öntesztem pont ezért maradt zölden a visszarontott lapon. Ezért a HATÁLYOS
    // `white-space` értékét is kimondjuk (azt a visszarontás elveszi), a geometria
    // pedig azt igazolja, hogy a szabály a VALÓSÁGBAN is egy sort eredményez.
    ok("⑧ …a jelölésen HATÁLYOS a nem-tördelő szabály", sent.ws === "nowrap", `white-space: ${sent.ws}`);
    ok("⑧ …és tényleg EGY SORBAN áll", sent.h <= sent.lh + 10, JSON.stringify(sent));
  }
}

// ═══ 9. ⑨ EGYENLETES SORMAGASSÁG (a hosszú és a rövid név egy vonalon) ══════════
{
  // ⚠️ A mérce a NÉV okozta egyenetlenség — nem az, hogy több tartalom ne férjen el.
  // A kiküldött megkeresést viselő sor két jelölést hordoz, ezért LEGITIMEN magasabb;
  // azt külön csoportként mérjük, hogy a csoporton BELÜL se legyen szórás.
  const g = await page.evaluate(() => {
    const plain: number[] = [];
    const twoPill: number[] = [];
    document.querySelectorAll<HTMLElement>("tbody tr").forEach((tr) => {
      const h = Math.round(tr.getBoundingClientRect().height);
      (tr.querySelectorAll('td[data-col="mock"] .pill').length > 1 ? twoPill : plain).push(h);
    });
    return { plain: [...new Set(plain)], twoPill: [...new Set(twoPill)], plainN: plain.length };
  });
  ok(
    "⑨ a NÉV hossza NEM változtatja a sormagasságot (a hosszú és a rövid név egy vonalon)",
    g.plain.length === 1 && g.plainN > 5,
    `magasságok: ${g.plain.join(", ")} (${g.plainN} sor)`,
  );
  ok(
    "⑨ …és a két jelölést viselő sorok is egységesek egymás közt",
    g.twoPill.length <= 1,
    `magasságok: ${g.twoPill.join(", ")}`,
  );
}

// ═══ 10. ⑩ A RAGADÁS — VALÓDI GÖRGETÉSSEL, DIFFERENCIÁLISAN ════════════════════
// ⚠️ EZ A SZÁL LÉNYEGE. Nem `getComputedStyle`, nem screenshot: elgörgetjük a
// konténert, és megnézzük, hogy a NÉV cella a KÉPERNYŐN maradt-e, MIKÖZBEN egy
// nem-ragadó oszlop elmozdult.
await open(render(Q), 390);
{
  const before = await page.evaluate(() => {
    const w = document.querySelector<HTMLElement>(".tblwrap")!;
    const name = document.querySelector<HTMLElement>('tbody td[data-col="name"]')!;
    const other = document.querySelector<HTMLElement>('tbody td[data-col="city"]')!;
    return {
      overflow: w.scrollWidth - w.clientWidth,
      nameX: Math.round(name.getBoundingClientRect().left),
      otherX: Math.round(other.getBoundingClientRect().left),
    };
  });
  // ⛔ ELŐFELTÉTEL: ha nincs mit görgetni, a ragadás-mérés ÜRES HALMAZON állna, és
  // egy sosem tapadó oszlop is zöld lenne.
  ok("⑩ a táblázat 390 px-en TÉNYLEG oldalra görget (van mit mérni)", before.overflow > 200, `túllógás: ${before.overflow}px`);

  const SCROLL = Math.min(400, before.overflow);
  const after = await page.evaluate((px) => {
    const w = document.querySelector<HTMLElement>(".tblwrap")!;
    w.scrollLeft = px;
    // Kikényszerített újraszámolás, hogy a sticky eltolás biztosan érvényesüljön.
    void w.offsetWidth;
    const name = document.querySelector<HTMLElement>('tbody td[data-col="name"]')!;
    const other = document.querySelector<HTMLElement>('tbody td[data-col="city"]')!;
    const head = document.querySelector<HTMLElement>('thead th[data-col="name"]')!;
    return {
      scrolled: Math.round(w.scrollLeft),
      nameX: Math.round(name.getBoundingClientRect().left),
      otherX: Math.round(other.getBoundingClientRect().left),
      headX: Math.round(head.getBoundingClientRect().left),
    };
  }, SCROLL);

  // (a) a görgetés tényleg megtörtént — egy NEM ragadó oszlop elmozdult
  const otherMoved = before.otherX - after.otherX;
  ok(
    "⑩ a görgetés MEGTÖRTÉNT (egy nem-ragadó oszlop elmozdult)",
    after.scrolled >= SCROLL - 2 && otherMoved >= SCROLL - 4,
    `scrollLeft=${after.scrolled}, a Város oszlop ${otherMoved}px-t mozdult`,
  );
  // (b) …és a NÉV oszlop KÖZBEN a helyén maradt
  const nameMoved = Math.abs(after.nameX - before.nameX);
  ok(
    "⑩⭐ a NÉV oszlop a képernyőn MARADT görgetés közben (valódi ragadás)",
    nameMoved <= 2,
    `elmozdult ${nameMoved}px (${before.nameX} → ${after.nameX}), miközben a Város ${otherMoved}px-t`,
  );
  // (c) a FEJLÉC-cella is ragad — különben a név fölött idegen oszlopnév állna
  ok(
    "⑩ a NÉV FEJLÉC-cellája is ragad (a cella fölött a saját neve marad)",
    Math.abs(after.headX - after.nameX) <= 2,
    `fejléc ${after.headX} vs cella ${after.nameX}`,
  );
  // (d) a lap KIMONDJA, hogy oldalra kell görgetni
  const hint = await page.evaluate(() => {
    const el = document.querySelector<HTMLElement>(".con-scrollhint");
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { visible: getComputedStyle(el).display !== "none" && r.height > 0, text: (el.textContent ?? "").trim() };
  });
  ok("⑩ a lap KIMONDJA, hogy oldalra görgetve jön a többi oszlop", !!hint?.visible, JSON.stringify(hint));
  ok("⑩ …és azt is, hogy a Név a helyén marad", (hint?.text ?? "").includes("Név"), hint?.text ?? "");
}

// ═══ 11. ① telefonon a jelmagyarázat CSUKVA fogad (két külön döntés) ════════════
{
  const openOnPhone = await page.evaluate(() => (document.querySelector(".con-legend") as HTMLDetailsElement).open);
  ok("① telefonon CSUKVA fogad (a helye viszont ugyanaz: a döntés előtt)", !openOnPhone);
}

// ── Zárás ───────────────────────────────────────────────────────────────────────
await browser.close();
assetServer.close();

if (SELF_TEST) {
  console.log("\n⚑ ÖNTESZT: a fenti futás a VISSZARONTOTT lapon ment (ragadás kikapcsolva,");
  console.log("   jelvény-alakok egyformává téve, a jelölés újra tördelhető, a jelzés elrejtve).");
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
    ? "\n✅ A lead-lista a jóváhagyott terv szerint viselkedik (a ragadás VALÓDI görgetéssel igazolva)."
    : `\n⛔ ${bad} eltérés a jóváhagyott tervtől (assets/design-refs/console/lead-list/).`,
);
process.exit(bad === 0 ? 0 : 1);
