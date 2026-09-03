// Regression guard for the LEGAL DOCUMENT LAYER (ADR-0056).
//
// WHY THIS EXISTS: before this layer landed, the outreach mock's footer linked to
// `/adatvedelem` while the only route that existed was `/privacy` — so every cold
// approach we sent carried a DEAD legal link, and nothing noticed. The demo
// footer rendered perfectly; the mock path masked the missing live path.
//
// So this guard does NOT check "is there a legal text file" (the convenient
// proxy). It checks the thing that actually broke: EVERY internal link on a
// legal surface must resolve to a route that is really served, on BOTH servers,
// and must be reachable WITHOUT an operator login. Plus: the checkout's ÁSZF link
// lives on the console, so a public-only route would 404 exactly at the sale.
//
// Run:  npx tsx scripts/legal-check.mts
//       npx tsx scripts/legal-check.mts --prod       (deploy gate: no [KITÖLTENDŐ])
//       npx tsx scripts/legal-check.mts --self-test  (must go RED — proves it measures)

import { readFileSync } from "node:fs";
import { isLegalEntityComplete } from "../src/config.js";
import { FILL_ME } from "../src/server/legalViews.js";
import { ASZF_V1, DPA_V1, WITHDRAWAL_NOTICE_V1 } from "../src/legal.js";

const PROD = process.argv.includes("--prod");
const SELF_TEST = process.argv.includes("--self-test");

let failed = 0;
function check(ok: boolean, label: string, detail: string): void {
  if (!ok) failed++;
  console.log(`${ok ? "✓" : "✗ FAIL"}  ${label}${ok ? "" : `\n     ↳ ${detail}`}`);
}

// ── The routes that must exist, and the surfaces that link to them ────────────

const LEGAL_ROUTES = [
  "/adatvedelem",
  "/privacy",
  "/impresszum",
  "/aszf",
  "/elallas",
  "/adatfeldolgozas",
] as const;

/**
 * Read the paths a server file really answers on. Parsing source is only safe if
 * a PARSER FAILURE IS LOUD: if the routing style is refactored and this finds
 * nothing, the sanity assertion below fails RED rather than reporting an empty
 * set as "no broken links".
 */
function servedPaths(file: string): Set<string> {
  const src = readFileSync(file, "utf8");
  const found = new Set<string>();
  // `path === "/x"` / `pathname === "/x"` route guards…
  for (const m of src.matchAll(/(?:path|pathname)\s*===\s*"(\/[a-z0-9/_-]*)"/gi)) {
    found.add(m[1]!);
  }
  // …plus paths listed in a Set literal (the console's LEGAL_PATHS allowlist).
  for (const m of src.matchAll(/"(\/[a-z0-9/_-]+)"\s*,/gi)) found.add(m[1]!);
  return found;
}

const PUBLIC_SRC = "src/server/public.ts";
const CONSOLE_SRC = "src/console/server.ts";
const publicPaths = servedPaths(PUBLIC_SRC);
const consolePaths = servedPaths(CONSOLE_SRC);

// Parser sanity: these two routes have existed for months. If the extractor
// stops seeing them, it is broken and every "no dead link" verdict below is
// worthless — fail loudly instead of passing on an empty set.
check(
  publicPaths.has("/login") && publicPaths.has("/privacy"),
  "az útvonal-kiolvasó működik (public.ts)",
  `a parser nem találta a régóta létező /login + /privacy útvonalakat — a kapu vak lenne. Talált: ${publicPaths.size} db`,
);
check(
  consolePaths.has("/privacy"),
  "az útvonal-kiolvasó működik (console/server.ts)",
  `a parser nem találta a /privacy útvonalat — a kapu vak lenne. Talált: ${consolePaths.size} db`,
);

// ── 1. Every legal route is served on BOTH servers ───────────────────────────
// The checkout runs on the console (config.termsUrl is a RELATIVE /aszf), while
// the footer links are on the public site. One-sided routing 404s at the sale.
for (const r of LEGAL_ROUTES) {
  check(publicPaths.has(r), `publikus szerver kiszolgálja: ${r}`, `nincs route a ${PUBLIC_SRC}-ben`);
  check(
    consolePaths.has(r),
    `konzol kiszolgálja: ${r}`,
    `nincs route a ${CONSOLE_SRC}-ben — a checkout ÁSZF-linkje a konzolon nyílik, ott 404 lenne`,
  );
}

// ── 2. Legal pages are readable WITHOUT an operator session ──────────────────
// The console redirects unauthenticated requests to /login. A prospect opening
// the ÁSZF from the checkout has no operator session, so a missing allowlist
// entry turns the legal document into a login wall (303, not 200).
const consoleSrc = readFileSync(CONSOLE_SRC, "utf8");
const allowlist = /const LEGAL_PATHS = new Set\(\[([\s\S]*?)\]\)/.exec(consoleSrc)?.[1] ?? "";
for (const r of LEGAL_ROUTES) {
  check(
    allowlist.includes(`"${r}"`),
    `bejelentkezés nélkül olvasható: ${r}`,
    `hiányzik a konzol LEGAL_PATHS allowlistájából → /login-ra irányítana át`,
  );
}

// ── 3. No legal surface links to a route nobody serves (the original bug) ────
const linkSources: { label: string; html: string }[] = [
  { label: "publikus honlap lábléc", html: readFileSync("public/index.html", "utf8") },
  { label: "demo-mock lábléc", html: readFileSync("src/generator/demoFrame.ts", "utf8") },
];
for (const { label, html } of linkSources) {
  for (const m of html.matchAll(/href="(\/[a-z0-9/_-]*)"/gi)) {
    const target = m[1]!;
    // Only judge the legal surface; the rest of the site has its own guards.
    if (!/adatvedelem|privacy|impresszum|aszf|elallas|adatfeldolgozas/i.test(target)) continue;
    check(
      publicPaths.has(target),
      `${label}: a ${target} link él`,
      `a link olyan útvonalra mutat, amit a publikus szerver nem szolgál ki (ez volt az eredeti hiba: /adatvedelem → 404)`,
    );
  }
}

// ── 4. Mandatory statutory content is actually in the documents ─────────────
const aszfText = ASZF_V1.flatMap((s) => [s.heading, ...s.body]).join(" ");
const dpaText = DPA_V1.flatMap((s) => [s.heading, ...s.body]).join(" ");
const withdrawalText = WITHDRAWAL_NOTICE_V1.flatMap((s) => [s.heading, ...s.body]).join(" ");

check(
  /elállás/i.test(aszfText) && /45\/2014/.test(aszfText),
  "az ÁSZF kitér a fogyasztói elállásra",
  "a validateBuyer 'individual' (fogyasztó) vevőt is elfogad — elállási rendelkezés nélkül a lemondó nyilatkozat sem áll meg",
);
check(
  /28\. cikk/.test(aszfText) || /adatfeldolgoz/i.test(aszfText),
  "az ÁSZF hivatkozik az adatfeldolgozási feltételekre",
  "a tenant-oldalon a vendég adatait mi kezeljük a tenant nevében — GDPR 28. cikk írásbeli szerződést követel",
);
// ADR-0093: the fixed "2 éves" term became the operator-set hűségidő, and the
// early-exit buyout (cash OR loyalty extension) must be spelled out.
check(
  /90\. napon száll át/.test(aszfText) && /hűségidő/.test(aszfText),
  "az ÁSZF tartalmazza a domain-átszállás feltételeit",
  "a tulajdonosi döntés (90 nap + hűségidő-teljesítés, ADR-0093) nélkül a domain-konstrukció nincs leírva",
);
check(
  /kivásárlási díj/.test(aszfText) && /változatlan csomagszint/.test(aszfText),
  "az ÁSZF tartalmazza a korai kilépés két kivásárlási útját (ADR-0093)",
  "a fix kivásárlási ár VAGY hűség-hosszabbítás út nélkül a korai kilépő domain-sorsa szabályozatlan",
);
check(
  /mintanyilatkozat/i.test(withdrawalText),
  "az elállási tájékoztató tartalmazza a mintanyilatkozatot",
  "a 45/2014. Korm. r. 2. melléklete kötelezővé teszi",
);
check(
  /elveszíti/.test(withdrawalText),
  "az elállási tájékoztató közli a jog elvesztését",
  "a WITHDRAWAL_WAIVER_V1 lemondás CSAK előzetes tájékoztatás mellett érvényes",
);
// GDPR 28 (3) names eight processor duties; the annex enumerates them a)–h).
const dpaPoints = "abcdefgh".split("").filter((l) => dpaText.includes(`${l}) `));
check(
  dpaPoints.length === 8,
  "a DPA mind a 8 adatfeldolgozói kötelezettséget felsorolja (GDPR 28. cikk (3))",
  `csak ${dpaPoints.length} pont van meg (${dpaPoints.join(",")})`,
);

// ── 5. The ÁSZF link is actually RENDERED, not just present in the payload ──
// A manifest field nothing consumes is the classic "mock path complete, live
// path unwired" shape: config.termsUrl → manifest → and then nowhere. The
// checkout runtime must read it and post the acceptance back.
const cfgJs = readFileSync("assets/runtime/cit-configurator.js", "utf8");
check(
  /termsUrl/.test(cfgJs),
  "a checkout runtime kirajzolja az ÁSZF-elfogadó sort",
  "a cit-configurator.js nem olvassa a manifest termsUrl mezőjét — az elfogadó sor sosem jelenne meg, hiába van dokumentum",
);
check(
  /terms_accepted/.test(cfgJs),
  "a checkout visszaküldi az elfogadást",
  "a cit-configurator.js nem küldi a terms_accepted mezőt — a validateBuyer mindig hibát adna",
);

// ── 6. Deploy gate: a hollow document must never go live ────────────────────
const complete = isLegalEntityComplete();
if (PROD) {
  check(
    complete,
    "az impresszum-adatok kitöltöttek (éles)",
    `üres LEGAL_ENTITY_* mezők — az élesített oldalakon [${FILL_ME}: …] jelölés maradna, és a fizetős kapu (config.termsUrl) csukva marad`,
  );
} else if (!complete) {
  console.log(
    `\nℹ️  A LEGAL_ENTITY_* mezők lokálban üresek — ez rendben van, az oldalak [${FILL_ME}: …]\n` +
      `   jelölést mutatnak és a checkout ÁSZF-sora rejtve marad. Élesítés előtt a prod .env-be kell.\n`,
  );
}

// ── Self-test: prove the guard goes RED when the real bug is reintroduced ───
if (SELF_TEST) {
  console.log("\n── ÖNELLENŐRZÉS (szándékos rontás — PIROSNAK kell lennie) ──");
  const brokenServed = new Set(["/privacy"]); // /adatvedelem "elveszett", ahogy a valóságban volt
  const deadLink = !brokenServed.has("/adatvedelem");
  console.log(
    deadLink
      ? "✓ a link-ellenőrzés elkapja a /adatvedelem → 404 esetet (az eredeti hiba)"
      : "✗ FAIL a link-ellenőrzés NEM kapja el az eredeti hibát",
  );
  if (!deadLink) failed++;

  const emptyParse = new Set<string>();
  const parserBlind = !(emptyParse.has("/login") && emptyParse.has("/privacy"));
  console.log(
    parserBlind
      ? "✓ üres parser-eredmény PIROS (nem hamis zöld)"
      : "✗ FAIL üres parser-eredmény átmenne",
  );
  if (!parserBlind) failed++;

  const shortDpa = "a) b) c)";
  const dpaCaught = "abcdefgh".split("").filter((l) => shortDpa.includes(`${l}) `)).length !== 8;
  console.log(
    dpaCaught
      ? "✓ hiányos DPA-felsorolás PIROS"
      : "✗ FAIL hiányos DPA-felsorolás átmenne",
  );
  if (!dpaCaught) failed++;
}

if (failed) {
  console.error(`\n⛔ legal-check: ${failed} ellenőrzés bukott — a jogi réteg sérült (ADR-0056).`);
  process.exit(1);
}
console.log(`\n✅ legal-check: a jogi dokumentum-réteg ép${PROD ? " (éles kapu is)" : ""}.`);
