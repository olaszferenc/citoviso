// Regression gate: an offer has ONE name, decided in ONE place (offerLabel), and
// every surface prints that name (Elek L-2 / F-3, owner-approved 2026-10-02).
//
// WHAT WAS MEASURED (production, 2026-10-01):
//   • the pay page called ONE −50% escalation offer "Bemutatkozó ajánlat a levélből"
//     on the left (item block — hardcoded, kind-blind) and "Döntés-segítő ajánlat"
//     on the right (price card) — while the outreach mail had promised 25%;
//   • the invoice called a 98% CAMPAIGN "Üdvözlő kedvezmény" (hardcoded) — the
//     welcome coupon is a separate 25% offer.
//
// WHAT IT MEASURES:
//   1. offerLabel: four kinds → four DIFFERENT names; the campaign is "Egyedi ajánlat";
//   2. the REAL invoiceComment names a campaign as a campaign, a coupon as a coupon;
//   3. the configurator runtime prints the server-given name on BOTH sides and keeps
//      no hand-written offer name of its own; both server emitters hand the page the
//      name (offerForPage); the tenant receipt names non-coupon offers via offerLabel.
//
// Run:  npx tsx scripts/offer-name-one-source-check.mts
//       npx tsx scripts/offer-name-one-source-check.mts --self-test
//         (the source rules are run on origin/main's PRE-FIX files — must go RED)

import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

const SELF_TEST = process.argv.includes("--self-test");
let failed = 0;
function ok(cond: boolean, label: string, detail = ""): void {
  if (!cond) failed++;
  console.log(`${cond ? "✓" : "✗ FAIL"}  ${label}${cond ? "" : `\n     ↳ ${detail}`}`);
}
/** The file as it stands — or, in the self-test, as it stood before the fix. */
function src(path: string): string {
  if (!SELF_TEST) return readFileSync(path, "utf8");
  return execFileSync("git", ["show", `8493d321:${path}`], { encoding: "utf8" });
}
/** Comments out: this file's own prose (and theirs) names the old shapes. */
function code(s: string): string {
  return s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

// ── 1. THE ONE MAPPING ───────────────────────────────────────────────────────
if (!SELF_TEST) {
  const { offerLabel } = await import("../src/payment/offers.js");
  const kinds = ["outreach", "escalation", "campaign", "coupon"] as const;
  const names = kinds.map((k) => offerLabel("hu", k));
  ok(new Set(names).size === 4, "négy fajta → négy KÜLÖNBÖZŐ név", names.join(" | "));
  ok(offerLabel("hu", "campaign") === "Egyedi ajánlat", "a kampány neve: „Egyedi ajánlat” (tulaj, A)", offerLabel("hu", "campaign"));
  ok(offerLabel("hu", "coupon") === "Üdvözlő kedvezmény", "az üdvözlő kupon neve változatlan");

  // ── 2. THE INVOICE ─────────────────────────────────────────────────────────
  const { invoiceComment } = await import("../src/payment/service.js");
  const camp = invoiceComment(false, 98, 9300, 186, "campaign");
  ok(camp.includes("Egyedi ajánlat") && !camp.includes("Üdvözlő"), "számla: a 98%-os kampány „Egyedi ajánlat”, nem „Üdvözlő kedvezmény”", camp);
  const coup = invoiceComment(false, 25, 19700, 14775, "coupon");
  ok(coup.includes("Üdvözlő kedvezmény"), "számla: az üdvözlő kupon „Üdvözlő kedvezmény”", coup);
  const esc = invoiceComment(false, 50, 9300, 4650, "escalation");
  ok(esc.includes("Döntés-segítő ajánlat"), "számla: az eszkaláció „Döntés-segítő ajánlat”", esc);
  // proba-C / Elek #16 (koordinátor, 2026-10-10): the trial's own offer has ONE name everywhere.
  ok(offerLabel("hu", "trial") === "Próba-kedvezmény", "a próba saját ajánlata: „Próba-kedvezmény”", offerLabel("hu", "trial"));
  const trialInv = invoiceComment(false, 50, 95000, 47500, "trial");
  ok(trialInv.includes("Próba-kedvezmény") && !trialInv.includes("Döntés-segítő"), "számla: a próba-ajánlat „Próba-kedvezmény” (akkor is, ha eszkalációként született)", trialInv);
}
{
  // The producers resolve the trial's offer to "trial" — the name above is only reached if they do.
  const svc = readFileSync(new URL("../src/payment/service.ts", import.meta.url), "utf8");
  const up = readFileSync(new URL("../src/tenant/moduleUpsell.ts", import.meta.url), "utf8");
  const pub = readFileSync(new URL("../src/server/" + "public.ts", import.meta.url), "utf8");
  ok(/isTrialOffer\(p\.offerId\)\)\s*\?\s*"trial"/.test(svc), "számla-megjegyzés: a próba-ajánlatot „trial”-ra oldja (isTrialOffer)");
  ok(/isTrialOffer\(coupon\.id\)\)\s*\?\s*"trial"/.test(up), "modul-vásárlás nyugtája: a próba-ajánlatot „trial”-ra oldja (isTrialOffer)");
  ok(/"campaign", "trial"\] as const\)\.find\(\(k\) => k === q\.get\("mkind"\)\)/.test(pub), "a nyugta-redirect a „trial” fajtát is átengedi (mkind)");
}

// ── 3. EVERY SURFACE READS THE ONE NAME ──────────────────────────────────────
const cfg = code(src("assets/runtime/cit-configurator.js"));
for (const lit of ['tr("Bemutatkozó ajánlat a levélből', 'tr("Döntés-segítő ajánlat: ']) {
  ok(!cfg.includes(lit), `konfigurátor: nincs saját, kézzel írt ajánlat-név (${lit}…)`, "a név a szervertől jön (OFFER.label)");
}
const discAt = cfg.indexOf('querySelector(".cit-cfg-item-disc")');
ok(discAt > -1 && /offerName\(\)/.test(cfg.slice(discAt, discAt + 400)), "konfigurátor bal oldal (tétel): offerName()", "a tétel-sor nem a közös nevet írja");
const cardAt = cfg.indexOf("function offerCardHtml(");
ok(cardAt > -1 && /offerName\(\)/.test(cfg.slice(cardAt, cardAt + 600)), "konfigurátor jobb oldal (ár-kártya): offerName()", "az ár-kártya nem a közös nevet írja");
ok(/OFFER\.label/.test(cfg), "a konfigurátor a szerver adta nevet (OFFER.label) használja");

const consoleSrc = code(src("src/console/" + "server.ts"));
ok(!/kind:\s*offer\.kind,\s*\n\s*percent:\s*offer\.percent/.test(consoleSrc) && (consoleSrc.match(/offerForPage\(/g) ?? []).length >= 2,
  "mindkét szerveroldali kibocsátó (a /p/ lap és a /view válasz) a nevet is átadja (offerForPage)");

const service = code(src("src/payment/service.ts"));
ok(!/Üdvözlő kedvezmény: a \$\{/.test(service), "a számla-megjegyzés nem ír kézzel „Üdvözlő kedvezmény”-t minden fajtára");

const admin = code(src("src/server/adminViews.ts"));
ok(/offerLabel\(lang, applied\.chargedOfferKind\)/.test(admin), "a tulaj-admin nyugtája a nem-kupon ajánlatot offerLabel-lel nevezi meg");

console.log(failed ? `\n✗ ${failed} hiba` : "\n✓ egy ajánlat — egy név, minden felületen");
if (SELF_TEST) {
  if (!failed) { console.log("⛔ ÖNTESZT: a javítás előtti forrást ZÖLDNEK látta — a kapu vak"); process.exit(1); }
  console.log("✓ ÖNTESZT: a javítás előtti forrás pirosat adott"); process.exit(0);
}
process.exit(failed ? 1 : 0);
