// ÁR-KOHERENCIA ŐR — a RENDERELT lapon veti össze a három árat (Elek FK-007, 2026-09-11).
//
// A lelet, ami ezt az őrt kikényszerítette: EGY lapon, EGY időszakra három szám állt.
//   „Szobák, apartmanok" kártya:  24 000 Ft/éj   (minősítés nélkül)
//   Árak tábla, 09. 15. – 09. 30.: 32 000 Ft
//   Foglalás-widget, 09.21–23:     64 000 Ft     (= 2 × 32 000, ez a helyes)
// A vendég ELŐSZÖR a kártyát látja, és az a szám a főszezoni éjszakákra VALÓTLAN.
//
// Miért a renderelt lapon mér és nem a modelleken: mind a három szám ugyanabból a
// `unit_price` táblából jött, mégis eltért — a hiba a MEGJELENÍTÉS három külön útján
// keletkezett (szerver-oldali kártya-sor, szerver-oldali tábla, kliens-oldali JS).
// Egy egység-teszt a `quoteStayFrom`-ra mind a háromszor zöld lett volna.
//
// Amit állít:
//   ① A kártya-ár SÁVJA pontosan az ártábla sávja: min=min és max=max. Egyetlen
//      szám a kártyán, több különböző ár a táblában ⇒ PIROS (ez volt a bejelentett
//      hiba: a kártya a mai napot mutatta, minősítés nélkül).
//   ② A kártyán látható LEGNAGYOBB szám >= a tábla legnagyobb ára — a vendég soha
//      ne olvasson kisebb árat, mint amit fizetni fog (tulajdonosi elvárás ①).
//   ③ A widget összege egyezik azzal, amit a GUARD SAJÁT KEZŰLEG számol ki az
//      ÁRTÁBLÁBÓL ugyanarra az időszakra — éjszakánként, a szezon-sorok szerint.
//      Ez független út: a widget a /api/foglaltsag JSON-ból dolgozik, az őr a
//      képernyőn látható táblából. Ha a kettő elmászik, azt csak így lehet elkapni.
//   A vizsgált időszakok magából a táblából származnak: egy TELJESEN szezonon
//   belüli, egy teljesen szezonon KÍVÜLI, és egy a határon ÁTLÓGÓ — utóbbi az,
//   amelyiket egy „az érkezés napja dönt" típusú hiba elrontana.
//
// Használat:
//   npx tsx scripts/booking-price-coherence-check.mts [<slug> …]
//   npx tsx scripts/booking-price-coherence-check.mts --selftest   ← PIROSNAK KELL LENNIE
//
// A `--selftest` a valódi lapon futtatja a valódi kinyerést és a valódi
// összehasonlítást, csak a bemenetet rontja el: a kártya-árat visszaírja a régi
// viselkedésre (egyetlen szám, a legkisebb). Ha ettől NEM pirosodik, az őr vak —
// és ezt maga jelenti be hibával (feedback_fixture_must_prove_its_own_path).

process.env.CIT_SHOT = "1"; // no boot self-heal: no AI calls, no DB writes

import { once } from "node:events";
import type { Server } from "node:http";
import type { Page } from "playwright-core";

import { chromium } from "playwright-core";

import { config } from "../src/config.js";
import { db } from "../src/db/client.js";

const args = process.argv.slice(2);
const selftest = args.includes("--selftest");
const slugArgs = args.filter((a) => !a.startsWith("--"));

interface Problem {
  readonly slug: string;
  readonly what: string;
}
const problems: Problem[] = [];
const notes: string[] = [];
/**
 * Pages where a comparison ACTUALLY happened. Without this the guard printed a
 * green "minden vizsgált oldalon EGY ár szól egy időszakról" after skipping the
 * only site it was given (503 — the park was frozen): zero comparisons read as
 * zero problems. A guard that cannot measure must say so, not pass.
 */
let compared = 0;

function fail(slug: string, what: string): void {
  problems.push({ slug, what });
}

/** "32 000 Ft" / "32 000 Ft" (nbsp) / "1 234 €" → 32000. Null when it is not money. */
function parseMoney(s: string): number | null {
  const m = /(\d[\d\s .]*)\s*(Ft|€|EUR|HUF)/i.exec(s);
  if (!m) return null;
  const n = Number(m[1]!.replace(/[\s .]/g, ""));
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * Every money amount in a blob of text, in reading order.
 *
 * ⚠️ RANGES FIRST, and this is not a detail: the fixed room card reads
 * "24 000–32 000 Ft / éj" — ONE currency mark for TWO amounts. A naive
 * "number followed by Ft" scan sees only the 32 000 and reports the card as showing
 * a single price. Measured 2026-09-12: the guard went red on a CORRECT page, and its
 * self-test then "passed" for the wrong reason — precisely the failure a red control
 * is supposed to rule out. A parser bug in an oracle reads exactly like a product bug.
 */
function allMoney(s: string): number[] {
  const out: number[] = [];
  const num = (raw: string): number => Number(raw.replace(/[\s .]/g, ""));
  // A range gives both ends and is consumed, so it is never counted twice.
  // No dots in the operands and at least three characters each — otherwise the
  // price table's OWN date range ("09. 15. – 09. 30. 32 000 Ft") parses as money.
  // Found by the parser's case list, not by luck.
  const rest = s.replace(
    /(\d[\d\s]{2,})\s*[\u2013\u2014-]\s*(\d[\d\s]{2,})\s*(?:Ft|\u20ac|EUR|HUF)/gi,
    (_all: string, a: string, b: string) => {
      const x = num(a);
      const y = num(b);
      if (Number.isFinite(x) && x > 0) out.push(x);
      if (Number.isFinite(y) && y > 0) out.push(y);
      return " ";
    },
  );
  // Dots are NOT separators in our own money formatting (formatAmount groups with
  // spaces), and allowing them let "9. 30. 32 000 Ft" collapse into 93 032 000.
  const re = /(\d[\d\s]*)\s*(?:Ft|\u20ac|EUR|HUF)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(rest))) {
    const n = num(m[1]!);
    if (Number.isFinite(n) && n > 0) out.push(n);
  }
  return out;
}

/** "09. 15. – 09. 30." → { from: "09-15", to: "09-30" }; null for the base row. */
function parseWhen(s: string): { from: string; to: string } | null {
  const m = /(\d{2})\.\s*(\d{2})\.\s*[–\-—]\s*(\d{2})\.\s*(\d{2})\./.exec(s);
  return m ? { from: `${m[1]}-${m[2]}`, to: `${m[3]}-${m[4]}` } : null;
}

/** Same wrap-aware rule as src/tenant/prices.ts — deliberately re-implemented here:
 *  an oracle that imports the code under test cannot disagree with it. */
function covers(from: string, to: string, monthDay: string): boolean {
  return from <= to ? monthDay >= from && monthDay <= to : monthDay >= from || monthDay <= to;
}

interface TableRow {
  readonly label: string;
  readonly season: { from: string; to: string } | null;
  readonly amount: number;
}

/** The guard's OWN arithmetic from the on-screen table: night by night. */
function expectedTotal(rows: readonly TableRow[], from: string, to: string): number | null {
  const seasons = rows.filter((r) => r.season);
  const base = rows.find((r) => !r.season);
  let total = 0;
  const d = new Date(`${from}T00:00:00Z`);
  const end = Date.parse(`${to}T00:00:00Z`);
  if (!(d.getTime() < end)) return null;
  while (d.getTime() < end) {
    const md = d.toISOString().slice(5, 10);
    const hit = seasons.find((r) => covers(r.season!.from, r.season!.to, md)) ?? base;
    if (!hit) return null;
    total += hit.amount;
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return total;
}

function addDays(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/**
 * Test stays derived FROM the table, in the next 12 months and never in the past
 * (the widget refuses past days, and a refused form renders no quote at all).
 */
function stayProbes(rows: readonly TableRow[]): { label: string; from: string; to: string }[] {
  const today = new Date().toISOString().slice(0, 10);
  const start = addDays(today, 3);
  const year = Number(start.slice(0, 4));
  const probes: { label: string; from: string; to: string }[] = [];
  const season = rows.find((r) => r.season);
  const inYear = (md: string): string => {
    const iso = `${year}-${md}`;
    return iso >= start ? iso : `${year + 1}-${md}`;
  };
  if (season) {
    // (a) fully INSIDE the season — this is where the reported 24 000 vs 32 000 lived
    const sFrom = inYear(season.season!.from);
    probes.push({ label: "szezonon belül", from: addDays(sFrom, 1), to: addDays(sFrom, 3) });
    // (b) ACROSS the closing edge — one night in, one night out
    const sTo = inYear(season.season!.to);
    probes.push({ label: "szezon-határon átlógó", from: addDays(sTo, -1), to: addDays(sTo, 2) });
    // (c) fully OUTSIDE every season
    const out = addDays(sTo, 30);
    if (!rows.some((r) => r.season && covers(r.season.from, r.season.to, out.slice(5))))
      probes.push({ label: "szezonon kívül", from: out, to: addDays(out, 2) });
  } else {
    probes.push({ label: "alapár", from: addDays(start, 10), to: addDays(start, 12) });
  }
  return probes;
}

async function bootServer(): Promise<number> {
  process.env.PUBLIC_PORT = "0";
  const { server } = (await import("../src/server/public.js")) as { server: Server };
  if (!server.listening) await once(server, "listening");
  const addr = server.address();
  if (!addr || typeof addr === "string") throw new Error("public szerver cím nélkül");
  return addr.port;
}

/** Sites worth checking: rendered, with BOTH a rooms price line and a price table. */
async function targetSlugs(): Promise<string[]> {
  if (slugArgs.length) return slugArgs;
  const rows = await db
    .selectFrom("site")
    .select(["slug"])
    .where("slug", "is not", null)
    .where("status", "in", ["provisioned", "live"])
    .execute();
  return rows.map((r) => r.slug!).filter(Boolean);
}

async function checkSite(page: Page, port: number, slug: string): Promise<void> {
  const url = `http://localhost:${port}/t/${slug}/`;
  const resp = await page.goto(url, { waitUntil: "networkidle", timeout: 30_000 }).catch(() => null);
  if (!resp || !resp.ok()) {
    notes.push(`${slug}: a lap nem nyílt meg (${resp?.status() ?? "hiba"}) — kihagyva`);
    return;
  }

  // ── the price TABLE (stable module hook, not a template class) ──────────────
  const rows: TableRow[] = await page.$$eval(
    '[data-cit-module="pricing"] table tbody tr',
    (trs) =>
      trs.map((tr) => {
        const td = tr.querySelectorAll("td");
        return {
          label: (td[0]?.textContent ?? "").trim(),
          when: (td[1]?.textContent ?? "").trim(),
          amount: (td[2]?.textContent ?? "").trim(),
        };
      }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ).then((raw: { label: string; when: string; amount: string }[]) =>
    raw
      .map((r) => ({ label: r.label, season: parseWhen(r.when), amount: parseMoney(r.amount) ?? 0 }))
      .filter((r) => r.amount > 0),
  );
  if (!rows.length) {
    notes.push(`${slug}: nincs ártábla a lapon — kihagyva`);
    return;
  }

  // ── the room CARD prices ────────────────────────────────────────────────────
  const cardText = await page
    .$$eval('[data-cit-module="rooms"]', (els) => els.map((e) => e.textContent ?? "").join(" "))
    .catch(() => [] as string[]);
  let cardAmounts = allMoney(Array.isArray(cardText) ? cardText.join(" ") : String(cardText));

  if (selftest) {
    // RED CONTROL — feed the comparison the OLD behaviour (one unqualified number,
    // today's price) through the very same code path. Nothing else is touched.
    cardAmounts = cardAmounts.length ? [Math.min(...cardAmounts)] : [Math.min(...rows.map((r) => r.amount))];
  }

  compared++;
  const tableMin = Math.min(...rows.map((r) => r.amount));
  const tableMax = Math.max(...rows.map((r) => r.amount));

  if (cardAmounts.length) {
    const cardMin = Math.min(...cardAmounts);
    const cardMax = Math.max(...cardAmounts);
    if (cardMax < tableMax) {
      fail(
        slug,
        `a szoba-kártya legnagyobb ára ${cardMax} Ft, az ártábláé ${tableMax} Ft — a vendég KISEBB árat olvas, mint amit fizetni fog`,
      );
    }
    if (cardMin !== tableMin) {
      fail(
        slug,
        `a szoba-kártya legkisebb ára ${cardMin} Ft, az ártábláé ${tableMin} Ft — a két felület ugyanarról az egységről mást állít`,
      );
    }
    const distinct = new Set(rows.map((r) => r.amount));
    if (distinct.size > 1 && new Set(cardAmounts).size === 1) {
      fail(
        slug,
        `a szoba-kártya EGYETLEN árat mutat (${cardMin} Ft), miközben az ártáblában ${distinct.size} különböző ár van — minősítés nélkül ez féligazság`,
      );
    }
  } else {
    notes.push(`${slug}: a szoba-kártyákon nincs ár — nincs mit ütköztetni`);
  }

  // ── the WIDGET, driven for real ─────────────────────────────────────────────
  const hasWidget = await page.$('[data-cit-module="booking"] #cit-from');
  if (!hasWidget) {
    // The form may sit behind the "SZABAD IDŐPONTOT KÉREK" opener.
    const opener = page.locator('[data-cit-module="booking"] button, [data-cit-module="booking"] a').first();
    if (await opener.count()) await opener.click({ timeout: 5_000 }).catch(() => {});
  }
  const from = page.locator("#cit-from").first();
  if (!(await from.count())) {
    notes.push(`${slug}: nincs foglalás-widget a lapon — a widget-ág kihagyva`);
    return;
  }

  for (const probe of stayProbes(rows)) {
    await page.fill("#cit-from", probe.from);
    await page.fill("#cit-to", probe.to);
    await page.waitForTimeout(250);
    const quote = (await page.locator("[data-quote]").first().textContent()) ?? "";
    const shown = allMoney(quote);
    const want = expectedTotal(rows, probe.from, probe.to);
    if (want === null) continue;
    if (!shown.length) {
      fail(
        slug,
        `${probe.label} (${probe.from}→${probe.to}): a widget NEM mutat árat, pedig az ártáblából ${want} Ft jön ki`,
      );
      continue;
    }
    // The total is the LAST amount in the quote block (the breakdown lines precede it).
    const total = shown[shown.length - 1]!;
    if (total !== want) {
      fail(
        slug,
        `${probe.label} (${probe.from}→${probe.to}): a widget ${total} Ft-ot ír, az ártáblából ${want} Ft jön ki`,
      );
    }
  }
}

async function main(): Promise<void> {
  const port = await bootServer();
  const browser = await chromium.launch({ executablePath: config.chromiumPath });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  const slugs = await targetSlugs();
  if (!slugs.length) {
    console.error("⛔ nincs vizsgálható oldal (provisioned/live, slug-gal)");
    process.exit(1);
  }
  console.log(`ÁR-KOHERENCIA ŐR — ${slugs.length} oldal${selftest ? "  [ÖNTESZT: pirosnak kell lennie]" : ""}`);
  for (const slug of slugs) await checkSite(page, port, slug);
  await context.close();
  await browser.close();

  for (const n of notes) console.log(`   · ${n}`);
  if (problems.length) {
    console.log("");
    for (const p of problems) console.log(`⛔ ${p.slug}: ${p.what}`);
    console.log(`\n${problems.length} ÁR-ELLENTMONDÁS`);
    if (selftest) {
      console.log("✅ ÖNTESZT RENDBEN — a rontott bemenetet az őr elkapta.");
      process.exit(0);
    }
    process.exit(1);
  }
  if (selftest) {
    console.error(
      "⛔ ÖNTESZT BUKOTT: a szándékosan elrontott kártya-árat az őr NEM vette észre — az őr vak, a zöldje semmit nem ér.",
    );
    process.exit(1);
  }
  if (!compared) {
    console.error(
      `⛔ EGYETLEN oldalt sem sikerült megmérni (${slugs.length} próbálva) — ez NEM zöld, ez mérés-hiány.`,
    );
    process.exit(1);
  }
  console.log(`✅ ${compared} oldalon EGY ár szól egy időszakról`);
  process.exit(0);
}

await main();
