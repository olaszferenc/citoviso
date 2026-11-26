// „Országok / Árazás” 4. fázis (0155; terv assets/design-refs/console/orszagok-arazas/ ⑪ + D12–14) — ŐR:
// the dispatch rules live on the COUNTRY ROW, and the values they replaced are read nowhere any more.
//
//   ① no source file reads a replaced code constant or global key: DISPATCH_MIN_OWN_PHOTOS, the
//      app_setting keys 'town_photo_dispatch' / 'nonopener_followup_daily_cap' / 'escalation_followup' /
//      'email_unchecked_ok', NONOPENER_FOLLOWUP_DAYS, outreach_auto's dailyCap / countryCaps (comments excluded);
//   ② the outreach window is the row alone: outreachHoursOf never intersects with MOCK_OUTREACH_WINDOW;
//   ③ the photo gate reads the row (LEAD_MIN_OWN_PHOTOS_SQL / LEAD_TOWN_MODE_SQL) — never app_setting;
//   ④ the auto-approve is in the repo and the dispatch tick calls it ONLY behind outreach_auto.autoApprove;
//      a country in 'owner' mode is never decided;
//   ⑤ the migration creates every column the code reads, and the backfill default of the approval is
//      'owner' (tulaj 2026-11-26: „B” — the owner approves everywhere until a country is set to Automata).
// Static (reads files), no DB. Self-test: --self-test feeds a forbidden line and must go red.
//
//   npx tsx scripts/dispatch-settings-check.mts [--self-test]
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const src = (p: string): string => readFileSync(path.join(ROOT, p), "utf8");
let fails = 0;
function check(name: string, ok: boolean, detail = ""): void {
  if (!ok) fails++;
  console.log(`  ${ok ? "✓" : "✗"} ${name}${!ok && detail ? ` — ${detail}` : ""}`);
}

/** Code without comments (line // … and block comments), strings kept. */
function code(text: string): string {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .map((l) => l.replace(/(^|[^:"'`])\/\/.*$/, "$1"))
    .join("\n");
}

const FORBIDDEN: readonly { re: RegExp; what: string }[] = [
  { re: /\bDISPATCH_MIN_OWN_PHOTOS\b/, what: "DISPATCH_MIN_OWN_PHOTOS (→ country.dispatch_min_own_photos)" },
  { re: /\bTOWN_PHOTO_DISPATCH_KEY\b|["'`]town_photo_dispatch["'`]/, what: "app_setting town_photo_dispatch (→ country.dispatch_photo_mode)" },
  { re: /nonopener_followup_daily_cap|\bNONOPENER_DAILY_CAP_KEY\b/, what: "app_setting nonopener_followup_daily_cap (→ country.nonopener_daily_cap)" },
  { re: /\bNONOPENER_FOLLOWUP_DAYS\b/, what: "NONOPENER_FOLLOWUP_DAYS (→ country.nonopener_days)" },
  { re: /\bESCALATION_FOLLOWUP_KEY\b|getSetting\(\s*["'`]escalation_followup["'`]/, what: "app_setting escalation_followup (→ country.escalation_followup)" },
  { re: /email_unchecked_ok/, what: "app_setting email_unchecked_ok (a régi szkript írta, senki nem olvasta)" },
  { re: /\bcountryCaps\b/, what: "outreach_auto.countryCaps (→ country.daily_quota)" },
  { re: /settings\.dailyCap\b|\bdailyCap:\s*settings\b/, what: "outreach_auto.dailyCap (→ country.daily_quota)" },
];

function walk(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(path.join(ROOT, dir))) {
    const rel = path.join(dir, e);
    if (statSync(path.join(ROOT, rel)).isDirectory()) walk(rel, out);
    else if (/\.ts$/.test(e)) out.push(rel);
  }
  return out;
}

function scan(files: readonly { file: string; text: string }[]): string[] {
  const hits: string[] = [];
  for (const f of files) {
    const c = code(f.text);
    for (const r of FORBIDDEN) if (r.re.test(c)) hits.push(`${f.file}: ${r.what}`);
  }
  return hits;
}

if (process.argv.includes("--self-test")) {
  const red = scan([{ file: "x.ts", text: 'const k = "town_photo_dispatch";\nconst n = DISPATCH_MIN_OWN_PHOTOS;' }]);
  const green = scan([{ file: "y.ts", text: "// DISPATCH_MIN_OWN_PHOTOS was 5 — see 0155\nconst n = 1;" }]);
  const ok = red.length === 2 && green.length === 0;
  console.log(ok ? "✅ önteszt: a tiltott sor piros, a komment zöld" : `⛔ önteszt hibás: ${JSON.stringify({ red, green })}`);
  process.exit(ok ? 0 : 1);
}

console.log("① a kiváltott konstansok és globális kulcsok sehol (src/)");
const hits = scan(walk("src").map((file) => ({ file, text: src(file) })));
check("nincs olvasó", hits.length === 0, hits.join(" · "));

console.log("② a kiküldési ablak az ország sora");
const co = src("src/outreach/countryOutreach.ts");
const hoursFn = co.slice(co.indexOf("export function outreachHoursOf("), co.indexOf("\n}\n", co.indexOf("export function outreachHoursOf(")));
check("outreachHoursOf nem metsz a kódba égetett ablakkal", !/Math\.(max|min)\(\s*MOCK_OUTREACH_WINDOW/.test(code(hoursFn)) && /cfg\.sendWindowFrom/.test(hoursFn));
check("a hétnapok és az ünnepnap-kapcsoló az ablakban él", /weekdays: cfg\.dispatch\.weekdays/.test(co) && /skipHolidays: cfg\.dispatch\.skipHolidays/.test(co));
const clock = src("src/crm/countryClock.ts");
check("a munkanap a sor hétnap-maszkjából", /rules\.weekdays \?\? 31/.test(clock) && /rules\.skipHolidays === false/.test(clock));

console.log("③ a fotó-kapu az ország sorát olvassa");
const pg = code(src("src/outreach/mockPhotoGate.ts"));
check("minimum és mód a sorból", /c\.dispatch_min_own_photos/.test(pg) && /c\.dispatch_photo_mode = 'own_town'/.test(pg));
check("a kapu nem olvas app_setting-et", !/app_setting/.test(pg));

console.log("④ az automata jóváhagyás a repóban, kapcsoló mögött");
const aa = src("src/outreach/autoApprove.ts");
const ad = src("src/outreach/autoDispatch.ts");
check("a tick csak outreach_auto.autoApprove mellett hívja", /if \(settings\.autoApprove\) \{[\s\S]{0,200}autoApproveIfDue\(now\)/.test(ad));
check("'owner' mód nem dönt", /d\.approval !== "auto"[\s\S]{0,80}ownerLeft\+\+/.test(aa));
check("az „ellenőrizve” jel a DB-ből (nem fájlból)", /contact_checked_at/.test(aa) && !/checked-ids\.txt"\s*\)/.test(code(aa)) && !/readFileSync/.test(aa));
check("a mentés a konzolon át (POST /contact-checked)", /path === "\/contact-checked"/.test(src("src/console/server.ts")));

console.log("⑤ a migráció");
const mig = src("migrations/0155_country_dispatch.sql");
const cols = ["dispatch_min_own_photos", "dispatch_photo_mode", "dispatch_stock_ok", "dispatch_sites", "dispatch_channels", "dispatch_approval", "dispatch_rules", "send_weekdays", "skip_holidays", "nonopener_on", "nonopener_days", "nonopener_count", "nonopener_daily_cap", "escalation_followup", "contact_checked_at"];
const missing = cols.filter((c) => !new RegExp(`ADD COLUMN IF NOT EXISTS ${c}\\b`).test(mig));
check("minden oszlop létrejön", missing.length === 0, missing.join(", "));
check("a jóváhagyás alapértéke 'owner' (tulaj 2026-11-26: B)", /dispatch_approval text NOT NULL DEFAULT 'owner'/.test(mig) && /approval: "owner"/.test(src("src/country.ts")));

console.log(fails ? `\n⛔ dispatch-settings-check: ${fails} hiba` : "\n✅ dispatch-settings-check: a kiküldési szabályok az ország során élnek");
process.exit(fails ? 1 : 0);
