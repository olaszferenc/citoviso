/**
 * Kapu — a tenant-admin modulszámai EGY definícióból jönnek, és a Bővítés nem hazudik
 * (Elek2 #14 #15, 2026-10-10).
 *
 * A MÉRT állapot (Elek 2. kör, fizetés UTÁN, `08k`/`08l` képek): egy képernyő-párson
 *   · oldalsáv: „11 modul aktív"         · menü: „Modulok 10"
 *   · Teendők:  „11 modul · 10 számlázott"
 *   · Modulok:  „Aktív az oldalán mind a 10 modul" KÖZVETLENÜL a
 *               „11 modul él az oldalán, ebből 10 szerepel a számlán" fölött.
 * A 11 a LISTÁZOTT sorok száma (a kiváltott „Időpontkérés" is benne), pedig a kiváltott
 * modul NEM jelenik meg az oldalon (KB admin-modules: „A kiváltott szakasz nem jelenik meg
 * a honlapján"). Az „él az oldalán" szám tehát az isRenderedModule() halmaza (10).
 *
 * #14: a próbában bekapcsolt „Saját e-mail cím" fizetés után kikapcsol (ADR-0102: az
 * email-modul nem eladható), a Bővítés mégis ezt írta: „Minden elérhető modult megvett".
 * Az eltűnés OKA nem volt sehol kimondva.
 *
 * Amit mér (a VALÓDI adminDashboard-ot rendereli, DB nélkül, kézi fixture-rel):
 *   ① oldalsáv-kártya „{n} modul aktív"  n = az oldalon élő modulok száma
 *   ② a Modulok menü-számlálója = az alatta álló lista sorai (module-subnav ⑤), és itt = élő
 *   ③ Teendők fejléc: az első szám = élő; ha van „· k számlázott", k = számlázott
 *   ④ Modulok fül: MINDEN „N … él az oldalán" / „mind a N modul" szám = élő,
 *      a „szerepel a számlán" szám = számlázott
 *   ⑤ nem rendelhető modul → a Bővítés NEM mondja, hogy „Minden elérhető modult megvett",
 *      a nevét és az okát kimondja; a próbából jövőnél a próbát is
 *   ⑥ ha a modul eladható, kártyája van a Bővítésben (nem tűnik el)
 *   ⑦ semmi nem maradt és semmi nem tiltott → a „mindent megvett" mondat marad (nem töröltük
 *      el az igaz esetet)
 *   ⑧ a tiszta helper (notOrderableModules) a valódi katalógus-szabályt alkalmazza
 *   ⑨ próba alatt is: a Teendők száma = élő
 *
 * PIROS ÖNTESZT (`--self-test`): a renderelt HTML-re visszaterítjük a JAVÍTÁS ELŐTTI alakot
 * (a listázott szám az élő helyén, a régi „N modul él… ebből K szerepel" mondat, a régi
 * „Minden elérhető modult megvett" a nem-rendelhető jegyzet helyén) — a névvel felsorolt
 * állításoknak bukniuk KELL.
 */
import { adminDashboard } from "../src/server/adminViews.js";
import { MODULE_CATALOG } from "../src/modules.js";
import { getBaseMonthly } from "../src/pricing.js";
import * as tenantModules from "../src/tenant/modules.js";
import type { TenantModuleView } from "../src/tenant/modules.js";
import type { SubscriptionAdminData, SubscriptionSummary } from "../src/tenant/subscriptionAdmin.js";

const SELF_TEST = process.argv.includes("--self-test");

let bad = 0;
const red = new Set<string>();
const check = (c: boolean, id: string, m: string, detail = "") => {
  if (c) console.log(`  ✓ ${m}`);
  else {
    bad++;
    red.add(id);
    console.log(`  ✗ ${m}${detail ? ` — ${detail}` : ""}`);
  }
};

/** What MUST go red on the pre-fix shape — by name, not by count. */
const MUST_FAIL_ON_OLD = ["side-live", "todo-live", "mod-live-sentences", "shop-no-false-all", "shop-names-why"] as const;

// ── fixture: the measured post-payment state (Üdülő tábor) ─────────────────────
const PAID = ["gallery", "rooms", "amenities", "pricing", "location", "hours", "usp", "reviews", "poi", "booking"] as const;

type Mod = TenantModuleView["modules"][number];
const mk = (id: string, active: boolean, supersededBy: string | null = null): Mod => {
  const def = MODULE_CATALOG.find((m) => m.id === id);
  if (!def) throw new Error(`ismeretlen modul a fixture-ben: ${id}`);
  return {
    id,
    label: def.publicLabel,
    publicDesc: def.publicDesc,
    group: def.group,
    spine: Boolean(def.spine),
    active,
    priceMonthly: def.priceMonthly,
    supersededBy,
    cancelAtPeriodEnd: false,
    awaitingFirstCharge: false,
  };
};

// Independent reference — from the fixture by the KB's own words, not from the view.
const LISTED = PAID.length + 1; // + the superseded spine row
const LIVE = PAID.length; // the superseded spine does not render
const BILLED = PAID.length;

const BASE = getBaseMonthly();
const MONTHLY = BASE + PAID.reduce((s, id) => s + MODULE_CATALOG.find((m) => m.id === id)!.priceMonthly, 0);
const emailDef = MODULE_CATALOG.find((m) => m.id === "email")!;

/** `email` inactive: in the module list only when sellable (getTenantModules hides an unsellable one). */
const mkView = (emailState: "unsellable-trial" | "unsellable" | "sellable" | "none"): TenantModuleView =>
  ({
    modules: [
      ...PAID.map((id) => mk(id, true)),
      mk("enquiry", true, "booking"),
      ...(emailState === "sellable" ? [mk("email", false)] : []),
    ],
    baseMonthly: BASE,
    totalMonthly: MONTHLY,
    notOrderable:
      emailState === "unsellable-trial" || emailState === "unsellable"
        ? [{ id: "email", label: emailDef.publicLabel, heldInTrial: emailState === "unsellable-trial" }]
        : [],
  }) as TenantModuleView;

const SUB: SubscriptionAdminData = {
  status: "active",
  periodEnd: "2027-02-21",
  renewDay: 21,
  nextInvoiceTotal: MONTHLY,
  nextInvoiceItems: PAID.map((id) => {
    const d = MODULE_CATALOG.find((m) => m.id === id)!;
    return { label: d.publicLabel, price: d.priceMonthly, isNew: false };
  }),
  payUrl: null,
  arrears: null,
  closesOn: "2027-03-21",
  frozenOn: null,
  restoredOn: null,
  cancelAtPeriodEnd: false,
  billingPeriod: "monthly",
  pendingAnnual: false,
  pendingEffectiveDate: null,
  annualTotal: MONTHLY * 10,
  annualSavings: MONTHLY * 2,
  annualFreeMonths: 2,
  autoCharge: true,
  coupon: null,
} as unknown as SubscriptionAdminData;
const SUMMARY: SubscriptionSummary = { status: "active", billingPeriod: "monthly", periodStart: "2027-01-21", periodEnd: "2027-02-21" };

const NOW = new Date("2027-01-21T12:00:00+01:00");
const render = (tab: string, mv: TenantModuleView, trial: unknown = null): string =>
  adminDashboard(
    { tenantId: "00000000-0000-0000-0000-000000000000", username: "udulo-tabor", displayName: "Üdülő tábor" } as never,
    { lang: "hu", status: "live", name: "Üdülő tábor", usingOwnPhotos: false, intro: "x".repeat(60), photos: [] } as never,
    { siteSlug: "udulo-tabor", tab, modules: mv, subscription: SUB, subSummary: SUMMARY, paidEmpty: [], now: NOW, trial } as never,
  );

/** The pre-fix shape, painted back onto the rendered HTML — the self-test's subject. */
const regress = (html: string): string => {
  let h = html
    .replace(/(\d+) modul aktív/g, `${LISTED} modul aktív`)
    .replace(/<span class="cnt">\d+ modul(?: · \d+ számlázott)?<\/span>/g, `<span class="cnt">${LISTED} modul · ${BILLED} számlázott</span>`)
    .replace(
      /<p class="adm-mine__recon">[\s\S]*?<\/p>/,
      `<p class="adm-mine__recon">${LISTED} modul él az oldalán, ebből ${BILLED} szerepel a számlán — a különbség az „Időpontkérés, kapcsolat”, amit most az „Online foglalás” vált ki.</p>`,
    );
  h = h.replace(
    /<div class="adm-shop__na"[\s\S]*?<\/div>/,
    `<p class="adm-lead">Minden elérhető modult megvett — jelenleg nincs több bővíthető elem.</p>`,
  );
  return h;
};

const text = (html: string): string =>
  html
    .replace(/<script[\s\S]*?<\/script>/g, " ")
    .replace(/<style[\s\S]*?<\/style>/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;| /g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ");
const maybe = (h: string) => (SELF_TEST ? regress(h) : h);

// ── post-payment, email unsellable after a trial ──────────────────────────────
const mvTrial = mkView("unsellable-trial");
const ov = maybe(render("attekintes", mvTrial));
const mod = maybe(render("modulok", mvTrial));
const ovT = text(ov);
const modT = text(mod);

console.log("① oldalsáv-kártya");
const side = [...ovT.matchAll(/(\d+) modul aktív/g)].map((m) => Number(m[1]));
check(side.length > 0 && side.every((n) => n === LIVE), "side-live", `„{n} modul aktív” = ${LIVE} (az oldalon élő)`, side.join(","));

console.log("② menü-számláló");
const navBlock = ov.match(/<div class="adm-nav__mod[\s\S]*?<\/div><\/div>|<a [^>]*tab=modulok"[\s\S]*?<\/a>/)?.[0] ?? "";
const badge = Number(ov.match(/tab=modulok"[^>]*>[\s\S]*?<span class="adm-nav__n">(\d+)<\/span>/)?.[1] ?? NaN);
const subRows = (ov.match(/class="adm-nav__sub"[\s\S]*?(?=<div class="adm-nav__buyh"|<\/div>)/)?.[0].match(/tab=modulok&amp;m=/g) ?? []).length;
check(badge === subRows && badge === LIVE, "badge", `a Modulok-számláló (${badge}) = a lista sorai (${subRows}) = élő (${LIVE})`, navBlock ? "" : "nincs nav-blokk");

console.log("③ Teendők fejléc");
const cnt = ov.match(/<span class="cnt">(\d+) modul(?: · (\d+) számlázott)?<\/span>/);
check(Boolean(cnt) && Number(cnt![1]) === LIVE && (cnt![2] === undefined || Number(cnt![2]) === BILLED), "todo-live", `Teendők: első szám = élő (${LIVE}), számlázott = ${BILLED}`, cnt?.[0] ?? "(nincs)");

console.log("④ Modulok fül");
const liveNums = [
  ...[...modT.matchAll(/(\d+) (?:modul )?él az oldalán/g)].map((m) => Number(m[1])),
  ...[...modT.matchAll(/mind a (\d+) modul/g)].map((m) => Number(m[1])),
  ...[...modT.matchAll(/(\d+) modul aktív/g)].map((m) => Number(m[1])),
];
check(liveNums.length >= 2 && liveNums.every((n) => n === LIVE), "mod-live-sentences", `minden „él az oldalán / mind a N / N modul aktív” szám = ${LIVE}`, liveNums.join(","));
const billedNums = [...modT.matchAll(/(\d+) szerepel a számlán/g)].map((m) => Number(m[1]));
check(billedNums.every((n) => n === BILLED), "mod-billed", `„szerepel a számlán” = ${BILLED}`, billedNums.join(","));
const listedNums = [...modT.matchAll(/(?:Alább|listában) (\d+) modul áll/g)].map((m) => Number(m[1]));
check(listedNums.every((n) => n === LISTED), "mod-listed", `„Alább N modul áll” = a sorok száma (${LISTED})`, listedNums.join(","));

console.log("⑤ Bővítés — nem rendelhető modul");
check(!modT.includes("Minden elérhető modult megvett"), "shop-no-false-all", "nem mondja, hogy „Minden elérhető modult megvett”");
check(
  modT.includes(`„${emailDef.publicLabel}”`) && /most nem rendelhető/.test(modT) && /ingyenes próbában be volt kapcsolva/.test(modT),
  "shop-names-why",
  "megnevezi a „Saját e-mail cím”-et, hogy most nem rendelhető, és hogy a próbában be volt kapcsolva",
);
const modPlain = text(maybe(render("modulok", mkView("unsellable"))));
check(
  !modPlain.includes("Minden elérhető modult megvett") && /most nem rendelhető/.test(modPlain) && !/ingyenes próbában be volt kapcsolva/.test(modPlain),
  "shop-no-trial-claim",
  "próba nélkül: megnevezi, de a próbát NEM állítja",
);

console.log("⑥ eladható e-mail modul");
const modSell = render("modulok", mkView("sellable"));
check(modSell.includes('id="mod-email"') && !text(modSell).includes("Minden elérhető modult megvett"), "shop-card", "eladhatóként kártyája van a Bővítésben");

console.log("⑦ igaz „mindent megvett”");
const modAll = text(render("modulok", mkView("none")));
check(modAll.includes("Minden elérhető modult megvett") && !/most nem rendelhető/.test(modAll), "shop-all-true", "semmi nem maradt, semmi nem tiltott → a mondat marad");

console.log("⑧ notOrderableModules (tiszta helper)");
const helper = (tenantModules as Record<string, unknown>).notOrderableModules as
  | ((active: Iterable<string>, disabled: Iterable<string>, heldInTrial: boolean) => { id: string; heldInTrial: boolean }[])
  | undefined;
if (typeof helper !== "function") check(false, "helper", "notOrderableModules exportálva");
else {
  const a = helper(["gallery"], ["email", "newsletter"], true);
  const b = helper(["email"], ["email"], true);
  check(
    a.length === 1 && a[0]!.id === "email" && a[0]!.heldInTrial && b.length === 0,
    "helper",
    "tiltott+nem birtokolt → listán; birtokolt → nincs; kivezetett (newsletter) → nincs",
    JSON.stringify({ a, b }),
  );
}

console.log("⑨ próba alatt");
const trialState = { status: "active", daysLeft: 5, totalDays: 14, untilIso: "2027-01-26", coupon: null, continueUrl: null, purgeIso: "2027-04-26", purgeWarned: false };
const ovTrial = maybe(render("attekintes", mkView("none"), trialState));
const cntTrial = ovTrial.match(/<span class="cnt">(\d+) modul/);
check(Boolean(cntTrial) && Number(cntTrial![1]) === LIVE, "trial-live", `próba-Teendők: ${LIVE} modul (élő)`, cntTrial?.[0] ?? "(nincs)");

if (SELF_TEST) {
  const missing = MUST_FAIL_ON_OLD.filter((id) => !red.has(id));
  if (missing.length) {
    console.log(`\n⛔ ÖNTESZT BUKOTT: a régi alakon ZÖLD maradt: ${missing.join(", ")}`);
    process.exit(1);
  }
  console.log(`\n✅ PIROS ÖNTESZT: a régi alakon mind a ${MUST_FAIL_ON_OLD.length} kötött állítás elbukott.`);
  process.exit(0);
}
console.log(bad === 0 ? "\n✅ admin-module-count-truth-check: minden állítás zöld" : `\n⛔ admin-module-count-truth-check: ${bad} BUKÁS`);
process.exit(bad ? 1 : 0);
