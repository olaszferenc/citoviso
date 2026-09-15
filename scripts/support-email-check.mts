/**
 * Kapu — a FIZETŐ ÜGYFÉLNEK mutatott support-cím EGY forrásból jön, és nem a
 * hideg-megkeresés feladó-azonossága.
 *
 * Kiváltó (Elek FK-002 nyomán, tulajdonosi döntés 2026-09-15): a tenant-admin
 * „Kérdése van a csomagról? Írjon:" linkje és a belépési súgó a
 * `config.outreachSender.email`-t kapta — azt a mezőt, ami a HIDEG MEGKERESÉS
 * jogilag kötelező feladó-azonosítása (§C.2, ADR-0130), nem support-cím. A dev
 * konfiguráción mérve ez egy SZEMÉLYNÉV (`olasz.ferenc@…`), miközben a fizetés-
 * lapok mellette már BEÉGETVE `info@citoviso.com`-ot írtak. Két képernyő, két
 * válasz ugyanarra a kérdésre — ugyanaz a „két példány, két igazság" osztály.
 *
 * Amit mér:
 *  ① a vevő-oldali lapok egyike sem ír ki BEÉGETETT e-mail címet (a forrásban);
 *  ② a tenant-admin Modulok fül, a belépési súgó és a három fizetés-lap
 *    UGYANAZT a címet rendereli — és azt, amit a config ad;
 *  ③ a cím NEM a hideg-megkeresés feladó-címe, ha a kettő eltér (szerep-szétválás);
 *  ④ a JOGI cím (Impresszum) a SAJÁT mezőjéből jön, nem ebből — más kötelezettség.
 *
 * ⛔ Amit ez az őr NEM mond meg: hogy a postafiók létezik-e és fogad-e levelet.
 * A 25-ös port kifelé zárva van erről a gépről (mérve: ECONNREFUSED mind a 7
 * próbacímre, a biztosan létező `olasz.ferenc@`-re is), tehát a kézbesíthetőség
 * NEM igazolható innen. Az őr a HIVATKOZÁS egységességét őrzi, nem a kézbesítést
 * (feedback_gate_measured_text_not_its_source: a mérés mondja meg a saját határát).
 */
import { readFileSync } from "node:fs";
import path from "node:path";

import { config } from "../src/config.js";
import { loginHelpPage, modulesSection } from "../src/server/adminViews.js";
import { MODULE_CATALOG } from "../src/modules.js";
import { getAnnualFreeMonths, getBaseMonthly } from "../src/pricing.js";
import type { TenantModuleView } from "../src/tenant/modules.js";
import type { SubscriptionAdminData } from "../src/tenant/subscriptionAdmin.js";

const SELF_TEST = process.argv.includes("--self-test");
const ROOT = path.resolve(import.meta.dirname, "..");

let bad = 0;
const red = new Set<string>();
const check = (c: boolean, m: string, id = "") => {
  if (c) console.log(`  ✓ ${m}`);
  else {
    bad++;
    if (id) red.add(id);
    console.log(`  ✗ ${m}`);
  }
};
/** Névsor: minek KELL elbuknia a 2026-09-15 előtti alakon. */
const MUST_FAIL_ON_OLD = ["no-hardcode", "same-address", "role-separated", "pay-from-support"] as const;

/**
 * ⛔ A vevő-oldali források, ahol e-mail cím JELENHET meg. A hatókör maga a
 * doktrína: „mindenhol keresni ugyanaz, mint sehol sem keresni"
 * (feedback_guard_scope_is_the_doctrine).
 */
const SCOPE = [
  "src/server/adminViews.ts",
  "src/console/views.ts",
  "src/server/public.ts",
] as const;

/** Beégetett cím a forrásban — a `config.*` hivatkozás NEM az. */
const MAIL_RE = /["'>(]\s*([a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,})/gi;
/** Ezek nem vevő-oldali feliratok: minta-adat, séma, placeholder. */
const ALLOW = [
  /example\.(com|test|org)/i,
  /@szallas\./i,
  /\{|\}/, // sablon-hely, nem konkrét cím
];

console.log(
  SELF_TEST
    ? "\n⚠️ PIROS ÖNTESZT — a 2026-09-15 ELŐTTI alakon buknia kell:\n"
    : "\n── A fizető ügyfélnek mutatott support-cím ──\n",
);

/**
 * A 2026-09-15 ELŐTTI alak: a fizetés-lapokon BEÉGETETT cím, a tenant-felületek
 * pedig a hideg-megkeresés feladó-azonosságát kapják. Nem „valami elrontás":
 * pontosan az, amit aznap mértem.
 */
const OLD_HARDCODE = '<a href="mailto:info@citoviso.com">info@citoviso.com</a>';
const regress = (src: string) =>
  src
    .replace(/<a href="\$\{esc\(config\.supportEmail\)\}"[^]*?<\/a>/g, OLD_HARDCODE)
    .replace(/mailto:\$\{esc\(config\.supportEmail\)\}/g, "mailto:info@citoviso.com")
    .replace(/supportEmail:\s*config\.supportEmail/g, "supportEmail: config.outreachSender.email")
    .replace(/config\.supportEmail/g, 'config.outreachSender.email || "hello@citoviso.com"');
/** Az önteszt alanya: a régi ÉRTÉK is a megkeresés-feladó volt. */
const effSupport = SELF_TEST ? (config.outreachSender.email ?? "") : config.supportEmail;

// ── ① nincs beégetett cím a vevő-oldali forrásokban ────────────────────────
console.log("① Nincs BEÉGETETT e-mail cím a vevő-oldali forrásokban:\n");
const hits: string[] = [];
for (const rel of SCOPE) {
  const raw = readFileSync(path.join(ROOT, rel), "utf8");
  const src = SELF_TEST ? regress(raw) : raw;
  for (const m of src.matchAll(MAIL_RE)) {
    const addr = m[1]!;
    if (ALLOW.some((r) => r.test(addr))) continue;
    hits.push(`${rel}: ${addr}`);
  }
}
check(
  hits.length === 0,
  hits.length === 0
    ? `⭐ ${SCOPE.length} vevő-oldali forrásban 0 beégetett cím`
    : `beégetett cím: ${hits.join(" · ")}`,
  "no-hardcode",
);

// ── ② minden vevő-felület UGYANAZT a címet rendereli ───────────────────────
console.log("\n② A tenant-admin, a belépési súgó és a fizetés-lapok UGYANAZT írják:\n");
const BASE = getBaseMonthly();
const MULT = 12 - getAnnualFreeMonths();
const def = MODULE_CATALOG.find((m) => m.id === "gallery")!;
const mv: TenantModuleView = {
  modules: [
    {
      id: def.id,
      label: def.publicLabel,
      publicDesc: def.publicDesc,
      group: def.group,
      spine: false,
      active: true,
      priceMonthly: def.priceMonthly,
      supersededBy: null,
      cancelAtPeriodEnd: false,
      awaitingFirstCharge: false,
    },
  ],
  baseMonthly: BASE,
  totalMonthly: BASE + def.priceMonthly,
};
const sub: SubscriptionAdminData = {
  status: "active",
  periodEnd: "2027-09-10",
  renewDay: 10,
  nextInvoiceTotal: BASE + def.priceMonthly,
  nextInvoiceItems: [{ label: def.publicLabel, price: def.priceMonthly, isNew: false }],
  payUrl: null,
  arrears: null,
  closesOn: "2027-10-10",
  frozenOn: null,
  restoredOn: null,
  cancelAtPeriodEnd: false,
  billingPeriod: "annual",
  pendingAnnual: false,
  pendingEffectiveDate: null,
  annualTotal: (BASE + def.priceMonthly) * MULT,
  annualSavings: 0,
  annualFreeMonths: getAnnualFreeMonths(),
  autoCharge: false,
  coupon: null,
};

/** A SZÁLLÍTOTT alapértelmezés: a hívók a configot adják, a nézet ezt írja ki. */
const mailtoOf = (html: string): string[] => [
  ...new Set([...html.matchAll(/mailto:([^"'>\s]+)/g)].map((m) => decodeURIComponent(m[1]!))),
];

const tabMails = mailtoOf(modulesSection(mv, sub, null, effSupport, null, "hu"));
// ⚠️ A belépési súgó a címet SZÖVEGKÉNT írja ki (`<strong>`), nem `mailto:` linkként.
// Az első változatom csak a linket kereste, és ezért PIROS lett egy helyes lapon —
// más kérdésre válaszolt volna (feedback_badge_answered_one_of_nine_gates). A mért
// állítás az, hogy MELYIK CÍM áll ott; a link hiánya külön lelet (a záró jelentésben).
const addressesOf = (html: string): string[] => [
  ...new Set(
    [...html.matchAll(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi)].map((m) => m[0]),
  ),
];
const loginMails = addressesOf(loginHelpPage(effSupport, "hu"));
// A fizetés-lapok ugyanabból a konstansból élnek; a forrás-szintű ① már igazolta,
// hogy nincs bennük beégetett cím, itt a KÖZÖS ÉRTÉKET nézzük.
// ⚠️ 2026-09-15: egy PÁRHUZAMOS szál ugyanezt a hibát javította, szigorúbban —
// a három fizetés-lap egy `helpLine()`-on át a HÍVÓTÓL kapja a címet, és cím
// hiányában a mondat ELMARAD, nem cserélődik hihetőre (§B.17). Az ő megoldásuk
// maradt; ez a szál a SZEREPET javította alatta. Az őr ezért nem a nézetben
// keresi a configot, hanem azt méri, hogy a HÍVÓ a support-mezőt adja át.
const callerSrc = readFileSync(path.join(ROOT, "src/console/server.ts"), "utf8");
const payFromSupport = /supportEmail:\s*config\.supportEmail/.test(
  SELF_TEST ? regress(callerSrc) : callerSrc,
);
const consoleSrc = readFileSync(path.join(ROOT, "src/console/views.ts"), "utf8");
const payOmitsWhenEmpty = /const helpLine[\s\S]{0,400}:\s*""/.test(consoleSrc);

check(tabMails.length === 1, `a Modulok fül EGY címet ír ki (${tabMails.join(", ") || "—"})`);
check(loginMails.length === 1, `a belépési súgó EGY címet ír ki (${loginMails.join(", ") || "—"})`);
check(
  !/mailto:/.test(loginHelpPage(effSupport, "hu")),
  "ℹ️ a belépési súgón a cím SZÖVEG, nem kattintható link — rögzített lelet, külön döntés",
);
check(
  payFromSupport,
  payFromSupport
    ? "⭐ a fizetés-lapok hívója a SUPPORT-mezőt adja át (nem a megkeresés-feladót)"
    : "a fizetés-lapok hívója nem a support-mezőt adja át",
  "pay-from-support",
);
check(
  payOmitsWhenEmpty,
  payOmitsWhenEmpty
    ? "⭐ cím hiányában a mondat ELMARAD, nem cserélődik hihetőre (§B.17)"
    : "cím hiányában is kiírna valamit — §B.17-sértés",
);
const all = [...tabMails, ...loginMails];
check(
  all.length > 0 && all.every((a) => a === config.supportEmail),
  all.every((a) => a === config.supportEmail)
    ? `⭐ mind a(z) ${config.supportEmail} címet mutatja — egy forrás, egy igazság`
    : `eltérő címek: ${all.join(" ≠ ")} (a config szerint ${config.supportEmail})`,
  "same-address",
);

// ── ③ szerep-szétválasztás ─────────────────────────────────────────────────
console.log("\n③ A support-cím NEM a hideg-megkeresés feladó-azonossága:\n");
const outreach = (config.outreachSender.email ?? "").trim();
check(
  Boolean(config.supportEmail),
  `van support-cím a configban: ${config.supportEmail || "(nincs)"}`,
);
check(
  !outreach || effSupport !== outreach,
  !outreach || effSupport !== outreach
    ? `⭐ külön mező: support=${effSupport} · outreach-feladó=${outreach || "(nincs)"}`
    : `a support-cím megegyezik a hideg-megkeresés feladójával (${outreach}) — a szerepek összecsúsztak`,
  "role-separated",
);

// ── ④ a JOGI cím a saját mezőjéből jön ─────────────────────────────────────
console.log("\n④ Az Impresszum jogi címe NEM ebből a mezőből származik:\n");
const legalSrc = readFileSync(path.join(ROOT, "src/tenant/legalIdentity.ts"), "utf8");
check(
  !/config\.supportEmail/.test(legalSrc),
  "a jogi azonosítás (Eker.tv. 4. §) nem a support-mezőt olvassa — más kötelezettség",
);

// ── ⛔ a mérés HATÁRA, kimondva ─────────────────────────────────────────────
console.log("\n⛔ Amit ez az őr NEM igazol:\n");
console.log(
  "   a postafiók LÉTEZÉSÉT és kézbesíthetőségét. A 25-ös port kifelé zárva\n" +
    "   (mérve: ECONNREFUSED mind a 7 próbacímre, a biztosan létező olasz.ferenc@-re is),\n" +
    "   ezért a kézbesítés innen nem mérhető. Ez EMBERI feladat marad: a Zoho-aliasnak\n" +
    `   élnie kell a(z) ${config.supportEmail} címre, különben a fizető ügyfél levele\n` +
    "   sehova nem érkezik meg.",
);

if (SELF_TEST) {
  const survived = MUST_FAIL_ON_OLD.filter((id) => !red.has(id));
  console.log(
    survived.length === 0
      ? `\n✅ PIROS ÖNTESZT: mind a ${MUST_FAIL_ON_OLD.length} kötött állítás elbukott a régi alakon.\n`
      : `\n❌ PIROS ÖNTESZT: ${survived.length} detektor átengedné a régit: ${survived.join(", ")}\n`,
  );
  process.exit(survived.length === 0 ? 0 : 1);
}

console.log(
  bad === 0
    ? "\n✅ A fizető ügyfélnek mutatott cím egy forrásból jön, és elvált a megkeresés-feladótól.\n"
    : `\n❌ ${bad} hiba.\n`,
);
process.exit(bad === 0 ? 0 : 1);
