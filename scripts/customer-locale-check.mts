// NEMZETKÖZI MODUL-AUDIT ŐR (2026-11-27) — a VEVŐ-oldali útvonalakon nincs égetett magyar locale.
//
// Why: the country tests checked the labels' language; nothing stopped a customer-facing path from
// formatting in Hungarian. Measured on the live [TESZT] Ruža (HR): the price table's dates in the
// Hungarian year-first form, amounts formatted without the reader's language (formatAmount(x, cur) →
// "1 200 €" on a Croatian page), a Croatian phone squeezed by the Hungarian displayPhone(), the
// weekly programs searching in Hungarian only (MONTHS_HU, "hu", name:hu).
//
// THE SCOPE IS DIRECTORIES, NOT A FILE LIST: every .ts under the customer-facing trees is scanned, so a
// NEW file (or a next country) is covered without anybody remembering to add it — the reason the
// country-layer-check ④/⑥ lists could not catch this class (they name the files they knew about).
// Operator-only trees (src/console, src/ops, src/scraper — the last has its own ④ scan) are out.
//
// Each remaining hit is on ALLOW with its REASON (the Hungarian branch of a language switch, an
// operator log line, the platform's own clock …), and an ALLOW entry that no longer matches FAILS
// (it must be deleted, so a fixed spot cannot be silently re-burned under an old excuse).
//
//   npx tsx scripts/customer-locale-check.mts            the scan
//   npx tsx scripts/customer-locale-check.mts --self-test  red self-test (every rule must fire)
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const ROOTS = [
  "src/engine", "src/tenant", "src/booking", "src/ui", "src/server", "src/email", "src/reviews", "src/events",
  "src/payment", "src/invoicing", "src/domains", "src/trial", "src/outreach", "src/conversion", "src/text",
];
const ROOT_FILES = /^src\/legal[A-Za-z]*\.ts$/;

/** One rule = one MEASURED defect class. */
const RULES: ReadonlyArray<{ id: string; re: RegExp; why: string }> = [
  { id: "hu-HU", re: /["'`]hu-HU["'`]/, why: "a magyar locale égetve — a lap/olvasó nyelve kell (dateLocale/numberLocale)" },
  { id: "budapest", re: /Europe\/Budapest/, why: "a magyar óra égetve — a szállás / a lead zónája kell" },
  { id: "hu-months", re: /\b(?:MONTHS_HU|HU_MONTHS\w*)\b/, why: "magyar hónapnevek — Intl a lap nyelvén" },
  { id: "osm-name-hu", re: /name:hu/, why: "OSM magyar név-tag — a lexikon osmNameTag-je" },
  { id: "search-hu", re: /[?&](?:hl|gl)=hu\b|acceptLanguage:\s*["'`]hu|search_lang=hu/, why: "magyar keresési nyelv — az ország sora" },
  { id: "hu-arg", re: /,\s*["'`]hu["'`]\s*\)/, why: "„hu” mint nyelv-argumentum — a hívó nyelve kell" },
  { id: "hu-lang-prop", re: /\blang:\s*["'`]hu["'`]/, why: "égetett lang: \"hu\" — a tenant / az olvasó nyelve" },
  { id: "money-no-lang", re: /\bformat(?:Amount|Money)\(\s*[^,()]+,\s*[^,()]+\)/, why: "összeg nyelv nélkül = magyar számforma („1 200 €”) — add át a lap nyelvét" },
  { id: "html-lang-hu", re: /<html lang="hu">/, why: "égetett <html lang=\"hu\"> — a böngésző magyarból fordítást ajánl a horvát vendégnek; a lap nyelve kell" },
  { id: "phone-hu-only", re: /\bdisplayPhone\(\s*[^,()]+\)|(?<![\w.])onePhone\(/, why: "csak-magyar telefon-forma — displayPhone(x, ország) / onePhoneIn" },
];

// file → exact code fragment that may stay, and WHY.
const ALLOW: ReadonlyArray<{ file: string; frag: string; why: string }> = [
  { file: "src/engine/legalPages.ts", frag: 'lang: "hu"', why: "a jogi csomag MAGYAR forrás-kulcsainak gyűjtője (kulcs-leltár, nem lap)" },
  { file: "src/engine/moduleSections.ts", frag: '? "hu-HU" : lang;', why: "numberLocale(): a magyar ág EGY helyen, a többi nyelv a sajátja" },
  { file: "src/tenant/zonePicker.ts", frag: '"Europe/Budapest": T(lang, "Budapest")', why: "a zóna-választó egyik OPCIÓJA (felirata T()-n át), nem alapérték" },
  { file: "src/tenant/zonePicker.ts", frag: 'lang === "hu" ? "hu-HU" : lang', why: "nyelvi ág: a magyar olvasó locale-je, más nyelv a sajátja" },
  { file: "src/tenant/availability.ts", frag: "HU_MONTHS", why: "a naptár magyar hónap-felirata; nem magyar nyelvre a bookingViews monthName() (Intl) váltja" },
  { file: "src/tenant/prices.ts", frag: "formatAmount(min, currency).replace(", why: "formatSpan magyar ága (a nem magyar nyelv fent, két teljes összeggel tér vissza)" },
  { file: "src/tenant/prices.ts", frag: "formatAmount(max, currency)}", why: "ugyanaz (formatSpan magyar ága)" },
  { file: "src/booking/requests.ts", frag: 'outcome: "unknown", lang: "hu"', why: "ismeretlen token: nincs szállás, nincs nyelv — a forrásnyelv a tartalék" },
  { file: "src/booking/requests.ts", frag: 'outcome: "unknown", errors: [], lang: "hu"', why: "ugyanaz (ismeretlen token, az ajánlat-POST ága)" },
  { file: "src/payment/offers.ts", frag: "at time zone 'Europe/Budapest')::date", why: "⚠️ ismert, látens: az eszkalációs ajánlat „különböző napjai” a cég órájában (CET-országokban azonos; nem CET ország előtt a lead zónájára) — a zárójelentés tétele" },
  { file: "src/payment/service.ts", frag: 'toLocaleString("hu-HU")', why: "a számla-megjegyzés FORINT-ága (magyar számlanyelv); más nyelv az invoiceCommentIn-en át" },
  { file: "src/payment/providers.ts", frag: '"en-US", "hu-HU", "de-DE"', why: "a Barion fizetőoldal TÁMOGATOTT locale-listája (a vevő nyelve választ belőle)" },
  { file: "src/payment/restoreNotice.ts", frag: "[billing] VISSZAKAPCSOLVA", why: "operátori napló-sor, nem vevőnek szól" },
  { file: "src/outreach/nonOpenerFollowup.ts", frag: 'localeCompare(b.leadName, "hu")', why: "feldolgozási sorrend (senki nem látja)" },
  { file: "src/outreach/nonOpenerFollowup.ts", frag: "at time zone 'Europe/Budapest'", why: "a NAPI KERET a cég órájában számol (operátori kvóta), a küldési ablak a lead zónája" },
  { file: "src/outreach/autoApprove.ts", frag: 'toLocaleString("hu-HU", { timeZone: "Europe/Budapest" })', why: "operátori napló-bélyeg" },
  { file: "src/outreach/trialCampaign.ts", frag: 'localeCompare(b.name, "hu")', why: "feldolgozási sorrend (senki nem látja)" },
  { file: "src/outreach/behaviorMessage.ts", frag: 'localeCompare(b.name, "hu")', why: "feldolgozási sorrend (senki nem látja)" },
  { file: "src/outreach/autoDispatch.ts", frag: "AT TIME ZONE 'Europe/Budapest'", why: "a NAPI KERET a cég órájában (operátori kvóta)" },
  { file: "src/text/zoneTime.ts", frag: 'APP_TZ = "Europe/Budapest"', why: "a PLATFORM órája (operátori idő), EGY helyen" },
  { file: "src/text/zoneTime.ts", frag: 'HU: "Europe/Budapest"', why: "az ország → alapzóna tábla HU sora (adat)" },
  { file: "src/text/phone.ts", frag: "export function onePhone(", why: "a magyar terv definíciója (onePhoneIn hívja a HU ágon)" },
  { file: "src/text/phoneCountry.ts", frag: "return onePhone(raw);", why: "onePhoneIn magyar ága (bájtra a régi)" },
  { file: "src/server/homepage.ts", frag: "s.replace('<html lang=\"hu\">', `<html lang=\"${lang}\">`)", why: "épp ez CSERÉLI a magyar forrás-attribútumot a látogató nyelvére" },
  { file: "src/text/day.ts", frag: "HU_MONTHS", why: "a dátum-formázók MAGYAR ága (lang === \"hu\"), a többi nyelv Intl" },
];

const stripComments = (line: string): string => {
  const t = line.trimStart();
  if (t.startsWith("//") || t.startsWith("*") || t.startsWith("/*")) return "";
  const i = line.search(/\s\/\/\s/);
  return i >= 0 ? line.slice(0, i) : line;
};

function walk(dir: string, out: string[]): void {
  for (const e of readdirSync(dir)) {
    const p = path.join(dir, e);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (p.endsWith(".ts") && !p.endsWith(".test.ts") && !p.endsWith(".d.ts")) out.push(p);
  }
}

export function scan(files: ReadonlyArray<{ file: string; text: string }>, allow = ALLOW) {
  const hits: string[] = [];
  const used = new Set<number>();
  for (const { file, text } of files) {
    text.split("\n").forEach((raw, n) => {
      const code = stripComments(raw);
      const rule = RULES.find((r) => r.re.test(code));
      if (!rule) return;
      const a = allow.findIndex((x) => x.file === file && code.includes(x.frag));
      if (a >= 0) {
        used.add(a);
        return;
      }
      hits.push(`${file}:${n + 1} [${rule.id}] ${raw.trim()}\n        → ${rule.why}`);
    });
  }
  return { hits, stale: allow.filter((_, i) => !used.has(i)) };
}

if (process.argv.includes("--self-test")) {
  // Every rule must fire on its measured shape; the comment form must not.
  const bad = [
    'const d = new Intl.DateTimeFormat("hu-HU").format(x);',
    'const tz = "Europe/Budapest";',
    "const m = MONTHS_HU[i];",
    'const n = tags["name:hu"];',
    'const u = `${base}?q=x&hl=hu`;',
    'await multiOfferSplit(req, "hu");',
    'return { lang: "hu" };',
    "const s = formatAmount(req.quoted_total, cur);",
    "const p = displayPhone(c.phone);",
    "const one = onePhone(raw);",
    'const h = `<!doctype html><html lang="hu"><head>`;',
  ];
  const r = scan([{ file: "src/engine/x.ts", text: bad.join("\n") + '\n// "hu-HU" in a comment' }], []);
  let ok = r.hits.length === bad.length;
  const good = scan([{ file: "src/engine/x.ts", text: 'formatAmount(a, cur, lang);\ndisplayPhone(c.phone, rules);\nonePhoneIn(raw, cfg);' }], []);
  ok = ok && good.hits.length === 0;
  console.log(ok ? `✅ customer-locale-check --self-test: ${bad.length}/${bad.length} szabály tüzel, a helyes forma csendes` : `⛔ self-test: ${r.hits.length}/${bad.length} tüzelt, helyes formán ${good.hits.length} hamis\n${r.hits.join("\n")}`);
  process.exit(ok ? 0 : 1);
}

const files: string[] = [];
for (const r of ROOTS) walk(r, files);
for (const f of readdirSync("src")) if (ROOT_FILES.test(`src/${f}`)) files.push(`src/${f}`);
const { hits, stale } = scan(files.map((f) => ({ file: f.split(path.sep).join("/"), text: readFileSync(f, "utf8") })));
for (const h of hits) console.log(`  ✗ ${h}`);
for (const a of stale) console.log(`  ✗ ALLOW nem él (törlendő): ${a.file} — „${a.frag}” (${a.why})`);
const n = hits.length + stale.length;
console.log(n ? `\n⛔ customer-locale-check: ${n} hiba (vevő-oldali útvonalon égetett magyar locale)` : `\n✅ customer-locale-check: ${files.length} vevő-oldali fájl, nincs égetett magyar locale (${ALLOW.length} indokolt kivétel)`);
process.exit(n ? 1 : 0);
