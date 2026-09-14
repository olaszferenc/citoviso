// MONEY-FORMAT GATE (ADR-0162) — one rule for every amount a person reads.
//
// WHAT IT DEFENDS. Measured 2026-09-14 on 4535965: the same 99 900 HUF came out
// of this codebase in FIVE different spellings, and the two that reached the same
// buyer contradicted each other — six dunning letters said "99 900 HUF", the
// invoice mail for the identical charge said "99 900 Ft". Worse than the sign was
// the CURRENCY: five call sites appended "Ft" to whatever they were handed, so an
// amount from the live EUR pricelist printed as "10 Ft" — on the checkout page the
// buyer pays from, and on the guest's booking quote.
//
// Five independent assertions, because the defect had five independent shapes:
//   ① PARITÁS  — the browser copy (cit-money.js) equals the TS rule, byte for byte.
//   ② SZABÁLY  — the rule itself: sign per currency, no NBSP, never throws.
//   ③ LEVELEK  — the letters a customer actually receives, built from the real
//                builders, agree with each other on one amount.
//   ④ FELÜLET  — the served surfaces carry the rule instead of a private copy.
//   ⑤ DRIFT    — nobody has written a SIXTH formatter since.
//
// ⑤ is the one that makes the others stay true. ①–④ measure today's output; ⑤
// measures whether the next hand-rolled `.replace(/\B(?=(\d{3})+(?!\d))/g, …)` can
// slip in. Every guard here proves it can go red: `--self-test` breaks each
// assertion on purpose and requires the break to be caught.
//
//   npx tsx scripts/money-format-check.mts [--self-test]

import { readFileSync } from "node:fs";
import { readdirSync, statSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";

import { currencySign, formatMoney, formatNumber } from "../src/text/money.js";
import {
  buildRenewalPreNoticeEmail,
  buildRenewalChargeEmail,
  buildRenewalReminderEmail,
  buildRenewalFinalWarningEmail,
  buildSiteFrozenEmail,
  buildSiteRestoredEmail,
} from "../src/email/billingEmail.js";
import { buildInvoiceEmail } from "../src/email/invoiceEmail.js";

const ROOT = path.resolve(import.meta.dirname, "..");
const SELF_TEST = process.argv.includes("--self-test");

let pass = 0;
const fails: string[] = [];
function check(ok: boolean, name: string, detail = ""): void {
  if (ok) pass++;
  else fails.push(`${name}${detail ? ` — ${detail}` : ""}`);
}

/** Every source file under a directory, recursively. */
function walk(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(path.join(ROOT, dir))) {
    const rel = path.join(dir, e);
    if (e === "node_modules" || e.startsWith(".")) continue;
    if (statSync(path.join(ROOT, rel)).isDirectory()) walk(rel, out);
    else if (/\.(ts|mts|js)$/.test(e)) out.push(rel);
  }
  return out;
}

/** The forms a money string may never contain. NBSP is the one that actually shipped. */
const NBSP_RE = /[\u00a0\u202f\u2009]/;

// ─────────────────────────────────────────────────────────────────────────────
// The browser mirror, loaded the way a page loads it: as a plain script.
// ─────────────────────────────────────────────────────────────────────────────
const MIRROR_SRC = readFileSync(path.join(ROOT, "assets/runtime/cit-money.js"), "utf8");

function loadMirror(src = MIRROR_SRC): {
  formatMoney: (a: unknown, c: unknown, l?: string) => string;
  formatNumber: (a: unknown, l?: string) => string;
  currencySign: (c: unknown) => string;
} {
  const ctx: Record<string, unknown> = { Intl, isFinite, Math, String, Object, module: { exports: {} } };
  vm.createContext(ctx);
  vm.runInContext(src, ctx);
  return ctx.CitMoney as ReturnType<typeof loadMirror>;
}

// ─────────────────────────────────────────────────────────────────────────────
// ① PARITÁS — the deliberate second copy must be an identical copy.
// ─────────────────────────────────────────────────────────────────────────────
const LANGS = ["hu", "en", "de", "pl", "sk", "ro", "fr", "it", "cs", "sr"];
const AMOUNTS = [0, 7, 999, 1000, 99900, 1234567, -4880, 0.4, 2.6];
// Real inputs, not invented ones: 'HUF'/'EUR' are the pricing_config rows, 'RON'
// is an ISO code we do not price in, and "Ft"/"€"/"" are what the scraper and the
// old configurator manifest actually handed the formatters (scraper/types.ts:323).
const CURRENCIES = ["HUF", "EUR", "RON", "Ft", "€", "", "huf"];

function parity(mirror: ReturnType<typeof loadMirror>): { n: number; bad: string[] } {
  const bad: string[] = [];
  let n = 0;
  for (const lang of LANGS) {
    for (const amount of AMOUNTS) {
      for (const cur of CURRENCIES) {
        n++;
        const a = formatMoney(amount, cur, lang);
        const b = mirror.formatMoney(amount, cur, lang);
        if (a !== b) bad.push(`formatMoney(${amount},"${cur}","${lang}"): TS=${JSON.stringify(a)} JS=${JSON.stringify(b)}`);
      }
      n++;
      const a = formatNumber(amount, lang);
      const b = mirror.formatNumber(amount, lang);
      if (a !== b) bad.push(`formatNumber(${amount},"${lang}"): TS=${JSON.stringify(a)} JS=${JSON.stringify(b)}`);
    }
  }
  for (const cur of CURRENCIES) {
    n++;
    if (currencySign(cur) !== mirror.currencySign(cur)) bad.push(`currencySign("${cur}")`);
  }
  return { n, bad };
}

{
  const mirror = loadMirror();
  const { n, bad } = parity(mirror);
  check(bad.length === 0, "① paritás: a böngésző-tükör = a TS szabály", bad.slice(0, 3).join(" · "));
  console.log(`① paritás: ${n - bad.length}/${n} egyezés (${LANGS.length} nyelv × ${AMOUNTS.length} összeg × ${CURRENCIES.length} pénznem)`);
}

// ─────────────────────────────────────────────────────────────────────────────
// ② SZABÁLY — what the formatter promises.
// ─────────────────────────────────────────────────────────────────────────────
check(formatMoney(99900, "HUF") === "99 900 Ft", "② HUF → „Ft” magyarul", formatMoney(99900, "HUF"));
check(formatMoney(10, "EUR") === "10 €", "② EUR → „€” magyarul", formatMoney(10, "EUR"));
// The defect this file exists for: an unknown currency must NOT become forint.
check(formatMoney(50, "RON") === "50 RON", "② ismeretlen pénznem ≠ „Ft”", formatMoney(50, "RON"));
check(!NBSP_RE.test(formatMoney(1234567, "HUF")), "② nincs NBSP a magyar alakban");
check(
  LANGS.every((l) => CURRENCIES.every((c) => !NBSP_RE.test(formatMoney(1234567, c, l)))),
  "② nincs NBSP EGYETLEN nyelven sem",
  LANGS.map((l) => `${l}:${JSON.stringify(formatMoney(1234567, "HUF", l))}`).filter((s) => NBSP_RE.test(s)).join(" "),
);
// The hostile inputs that made Intl's currency style unusable.
for (const bad of ["Ft", "€", "", null, undefined] as unknown[]) {
  let threw = false;
  try {
    formatMoney(1000, bad as string);
  } catch {
    threw = true;
  }
  check(!threw, `② nem dob kivételt erre: ${JSON.stringify(bad)}`);
}
// A missing amount must render as nothing, never as a price the reader could believe.
for (const empty of [null, undefined, NaN, Infinity] as unknown[]) {
  check(formatMoney(empty as number, "HUF") === "", `② üres összeg → üres string (${String(empty)})`);
}

// ─────────────────────────────────────────────────────────────────────────────
// ③ LEVELEK — the seven letters one customer can receive about ONE charge.
// ─────────────────────────────────────────────────────────────────────────────
const AMOUNT = 99900;
function lettersFor(currency: string, lang = "hu"): { name: string; text: string }[] {
  const base = { to: "a@b.hu", siteName: "Mirabella", amount: AMOUNT, currency, dueDate: "2027-09-10", lang };
  const chg = { ...base, payUrl: "https://x/p", periodStart: "2027-09-10", periodEnd: "2028-09-10" };
  return [
    ["T−3 előértesítő", buildRenewalPreNoticeEmail({ ...base, autoCharge: true })],
    ["T terhelés", buildRenewalChargeEmail(chg)],
    ["T+3 emlékeztető", buildRenewalReminderEmail({ ...chg, freezeDate: "2027-09-20" })],
    ["T+7 utolsó figyelmeztetés", buildRenewalFinalWarningEmail({ ...chg, freezeDate: "2027-09-20" })],
    ["fagyasztás", buildSiteFrozenEmail(chg)],
    ["visszakapcsolás", buildSiteRestoredEmail({ ...base, siteUrl: "https://s" })],
    [
      "számla-levél",
      buildInvoiceEmail({
        to: "a@b.hu",
        buyerName: "X",
        invoiceNumber: "CIT-1",
        gross: AMOUNT,
        currency,
        period: "annual",
        lang,
      }),
    ],
  ].map(([name, m]) => ({ name: name as string, text: (m as { text: string; html: string }).text + "\n" + (m as { html: string }).html }));
}

/** Every money-shaped token in a body: digits (any spacing) followed by a unit. */
function moneyTokens(s: string): string[] {
  return [...s.matchAll(/\d[\d\u00a0\u202f\u2009 .,]*\s*(?:Ft|HUF|EUR|€|RON)/gu)].map((m) => m[0]);
}

for (const [currency, want] of [
  ["HUF", `${formatMoney(AMOUNT, "HUF")}`],
  ["EUR", `${formatMoney(AMOUNT, "EUR")}`],
] as [string, string][]) {
  const letters = lettersFor(currency);
  const spellings = new Map<string, string[]>();
  for (const { name, text } of letters) {
    for (const t of moneyTokens(text)) {
      spellings.set(t, [...(spellings.get(t) ?? []), name]);
    }
  }
  const seen = [...spellings.keys()];
  check(
    seen.length === 1 && seen[0] === want,
    `③ mind a ${letters.length} levél UGYANAZT írja (${currency})`,
    `talált alakok: ${seen.map((s) => JSON.stringify(s)).join(", ")} · várt: ${JSON.stringify(want)}`,
  );
  check(
    !letters.some(({ text }) => NBSP_RE.test(text.replace(/<[^>]*>/g, ""))),
    `③ nincs NBSP a levelek szövegében (${currency})`,
  );
  console.log(`③ levelek (${currency}): ${letters.length} levél · ${seen.length} alak · ${JSON.stringify(seen[0] ?? "—")}`);
}
// The reported defect, pinned by name: the machine code must not reach a Hungarian reader.
check(
  !lettersFor("HUF").some(({ text }) => /\d[\d ]*\s*HUF/.test(text)),
  "③ magyar olvasó nem kap „HUF”-ot",
  lettersFor("HUF").filter(({ text }) => /\d[\d ]*\s*HUF/.test(text)).map((l) => l.name).join(", "),
);

// ─────────────────────────────────────────────────────────────────────────────
// ④ FELÜLET — the served surfaces carry the rule, not a private copy.
// ─────────────────────────────────────────────────────────────────────────────
const RUNTIME_JS = readFileSync(path.join(ROOT, "assets/runtime/cit-runtime.js"), "utf8");
const CONFIGURATOR_JS = readFileSync(path.join(ROOT, "assets/runtime/cit-configurator.js"), "utf8");
const RUNTIME_TS = readFileSync(path.join(ROOT, "src/generator/runtime.ts"), "utf8");
const CONFIGURATOR_TS = readFileSync(path.join(ROOT, "src/generator/configurator.ts"), "utf8");
const ADMIN_TS = readFileSync(path.join(ROOT, "src/server/adminViews.ts"), "utf8");

for (const [name, src] of [
  ["a generált lap futtatókörnyezete", RUNTIME_TS],
  ["a fizetőoldal (konfigurátor)", CONFIGURATOR_TS],
  ["a bérlői admin", ADMIN_TS],
] as [string, string][]) {
  check(src.includes("cit-money.js"), `④ ${name} beágyazza a közös szabályt`);
}
check(
  RUNTIME_JS.includes("CitMoney.formatMoney"),
  "④ a vendég foglalás-előnézete a közös szabályt hívja",
);
check(
  CONFIGURATOR_JS.includes("CitMoney.formatMoney"),
  "④ a fizetőoldal a közös szabályt hívja",
);
// The manifest must carry the ISO CODE. It used to carry the literal "Ft", which
// the client glued onto every amount — so an EUR buyer read forint on the page
// they pay from.
check(
  !/currency:\s*"Ft"/.test(CONFIGURATOR_TS),
  "④ a manifest ISO-kódot küld, nem pénznem-jelet",
  "configurator.ts: currency: \"Ft\"",
);

// ⛔ PAIRING. A script that splices the widget runtime into a page of its own —
// instead of going through injectRuntime/injectConfigurator — must splice the money
// rule in too, or the page dies on an undefined CitMoney and the failure looks like
// a LAYOUT defect. Measured: shot-booking-form.mts was exactly such a consumer.
for (const rel of walk("scripts")) {
  const src = readFileSync(path.join(ROOT, rel), "utf8");
  const inlinesWidget = /\$\{(runtimeJs|configuratorJs|cfgJs)\}/.test(src);
  if (!inlinesWidget) continue;
  check(
    src.includes("cit-money.js"),
    `④ ${rel} beágyazza a widgetet, de a pénz-szabályt is`,
  );
}

// ⛔ EVERY inline <script> that CALLS the rule must also CARRY it. Measured the
// hard way: injecting cit-money.js once in the page shell looked tidier, but the
// tenant-admin sections are also rendered STANDALONE (their own guards do exactly
// that), and those pages never run the shell — multilang-tier-check went red with
// seven `ReferenceError: CitMoney is not defined`, and the module editor's live
// total silently stopped updating, reporting 61 500 Ft where 68 400 Ft was due.
// A wrong NUMBER, from a missing formatter. The dependency travels with the script.
function unpairedScripts(src: string): number[] {
  const bad: number[] = [];
  const lines = src.split("\n");
  let inScript = false;
  let carries = false;
  let start = 0;
  lines.forEach((line, i) => {
    if (line.includes("<script")) {
      inScript = true;
      carries = false;
      start = i + 1;
    }
    if (inScript && line.includes("${MONEY_JS}")) carries = true;
    if (inScript && line.includes("CitMoney.") && !carries) bad.push(start);
    if (line.includes("</script>")) inScript = false;
  });
  return [...new Set(bad)];
}

for (const rel of walk("src")) {
  const src = readFileSync(path.join(ROOT, rel), "utf8");
  if (!src.includes("CitMoney.")) continue;
  const bad = unpairedScripts(src);
  check(bad.length === 0, `④ ${rel}: minden CitMoney-t hívó script HOZZA is a szabályt`, `script @ ${bad.join(", ")}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// ⑤ DRIFT — no SIXTH formatter. This is what keeps ①–④ true next month.
// ─────────────────────────────────────────────────────────────────────────────
/** The hand-rolled thousands grouping every one of the old copies used. */
const GROUPING = /\\?B\(\?=\(\\\\?d\{3\}\)\+\(\?!\\\\?d\)\)/;
/** `currency === "EUR" ? "€" : "Ft"` and friends — a sign chosen outside the rule. */
const SIGN_TERNARY = /\?\s*[`"'][^`"']*(?:Ft|€)[^`"']*[`"']\s*:\s*[`"'][^`"']*(?:Ft|€)/;

/** The two files that ARE the rule, plus this guard, may contain both patterns. */
const RULE_FILES = new Set([
  "src/text/money.ts",
  "assets/runtime/cit-money.js",
  "scripts/money-format-check.mts",
]);

function driftHits(extra?: { file: string; src: string }): string[] {
  const hits: string[] = [];
  const files = [...walk("src"), ...walk("assets/runtime")];
  for (const rel of files) {
    if (RULE_FILES.has(rel)) continue;
    const src = extra && extra.file === rel ? extra.src : readFileSync(path.join(ROOT, rel), "utf8");
    src.split("\n").forEach((line, i) => {
      // Comments narrate the history of this very bug; only CODE counts.
      const code = line.replace(/^\s*(\/\/|\*|\/\*).*$/, "");
      if (GROUPING.test(code)) hits.push(`${rel}:${i + 1} saját ezres-csoportosítás`);
      else if (SIGN_TERNARY.test(code)) hits.push(`${rel}:${i + 1} saját pénznem-jel elágazás`);
    });
  }
  return hits;
}

{
  const hits = driftHits();
  check(hits.length === 0, "⑤ nincs második pénz-formázó", hits.slice(0, 5).join(" · "));
  console.log(`⑤ drift: ${hits.length} saját formázó a szabály-fájlokon kívül`);
}

// ─────────────────────────────────────────────────────────────────────────────
// PIROS ÖNTESZT — every assertion above must be ABLE to fail.
// ─────────────────────────────────────────────────────────────────────────────
if (SELF_TEST) {
  console.log("\n── piros önteszt: minden állítást elrontunk, és el kell kapni ──");
  const reds: [string, () => boolean][] = [
    // ① a mirror that groups with a NBSP — exactly the split that shipped
    [
      "① a tükör NBSP-vel csoportosít",
      () => parity(loadMirror(MIRROR_SRC.replace('.replace(/\\B(?=(\\d{3})+(?!\\d))/g, " ")', '.replace(/\\B(?=(\\d{3})+(?!\\d))/g, "\\u00a0")'))).bad.length > 0,
    ],
    // ① a mirror that writes "Ft" for everything — the wrong-currency defect
    [
      "① a tükör mindenre „Ft”-ot ír",
      () => parity(loadMirror(MIRROR_SRC.replace('var SIGN = { HUF: "Ft", EUR: "€" };', 'var SIGN = { HUF: "Ft", EUR: "Ft", RON: "Ft" };'))).bad.length > 0,
    ],
    // ② the rule itself, mutated
    ["② RON → „Ft” elcsúszás", () => formatMoney(50, "RON") !== "50 Ft"],
    ["② NBSP-s alak megbukna", () => NBSP_RE.test("99\u00a0900 Ft")],
    // ③ the reported defect, reconstructed from the raw pair
    [
      "③ a régi „{amount} {currency}” alak megbukna",
      () => {
        const old = `A megújulás díja: ${formatNumber(AMOUNT)} HUF.`;
        return /\d[\d ]*\s*HUF/.test(old);
      },
    ],
    [
      "③ két különböző alak egy körben megbukna",
      () => new Set([...moneyTokens("99 900 Ft"), ...moneyTokens("99 900 HUF")]).size !== 1,
    ],
    // ④ a surface that stops embedding the rule
    [
      "④ beágyazás nélküli felület megbukna",
      () => !RUNTIME_TS.replace(/cit-money\.js/g, "x.js").includes("cit-money.js"),
    ],
    [
      "④ a manifest pénznem-jelet küldene",
      () => /currency:\s*"Ft"/.test('      currency: "Ft",'),
    ],
    // ④ a page-building script that forgets the pairing
    [
      "④ widget beágyazás pénz-szabály nélkül megbukna",
      () => {
        const fake = "const x = `<script>${runtimeJs}</script>`;";
        return /\$\{(runtimeJs|configuratorJs|cfgJs)\}/.test(fake) && !fake.includes("cit-money.js");
      },
    ],
    // ④ the exact mistake that shipped: the rule injected by the PAGE, not the script
    [
      "④ script a szabály nélkül megbukna (a valódi ReferenceError)",
      () =>
        unpairedScripts(
          ['`<script>` +', '`var HUF=function(n){return CitMoney.formatMoney(n,CUR)};` +', '`</script>`'].join("\n"),
        ).length > 0,
    ],
    [
      "④ (kontroll) a szabályt HOZÓ script nem lelet",
      () =>
        unpairedScripts(
          ['`<script>` +', "`${MONEY_JS}` +", '`var HUF=function(n){return CitMoney.formatMoney(n,CUR)};` +', '`</script>`'].join("\n"),
        ).length === 0,
    ],
    // ⑤ a newly planted sixth formatter must be found
    [
      "⑤ új saját formázó megbukna",
      () =>
        driftHits({
          file: "src/pricing.ts",
          src: 'const huf = (n) => String(n).replace(/\\B(?=(\\d{3})+(?!\\d))/g, " ") + " Ft";',
        }).some((h) => h.startsWith("src/pricing.ts:")),
    ],
    [
      "⑤ új pénznem-jel elágazás megbukna",
      () =>
        driftHits({
          file: "src/pricing.ts",
          src: 'const s = currency === "EUR" ? "€" : "Ft";',
        }).some((h) => h.startsWith("src/pricing.ts:")),
    ],
    // ⛔ álpozitív-kontroll: a comment that QUOTES the old bug must NOT be a hit.
    [
      "⑤ (kontroll) a hibát IDÉZŐ komment nem lelet",
      () =>
        driftHits({
          file: "src/pricing.ts",
          src: '// it used to be `currency === "EUR" ? "€" : "Ft"` — see ADR-0162.',
        }).every((h) => !h.startsWith("src/pricing.ts:")),
    ],
  ];
  let red = 0;
  for (const [name, fn] of reds) {
    const caught = fn();
    console.log(`  ${caught ? "🔴 elkapva" : "⚪ ÁTENGEDVE"} — ${name}`);
    if (caught) red++;
    else fails.push(`ÖNTESZT nem ment pirosra: ${name}`);
  }
  console.log(`önteszt: ${red}/${reds.length} elrontott állítást kapott el az őr`);
}

// ─────────────────────────────────────────────────────────────────────────────
console.log(`\n${fails.length ? "❌" : "✅"} money-format-check: ${pass} állítás zöld, ${fails.length} piros`);
for (const f of fails) console.error(`  ✗ ${f}`);
process.exit(fails.length ? 1 : 0);
