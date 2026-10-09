// ADR-0342 — the free trial's length is OPERATOR-SET on /pricing („Ingyenes próba” section, the
// ADR-0285 „Lead-ajánlatok” pattern); ADR-0346 — the ONE coupon (first payment OR trial start)
// is set in the „Kupon” section beside it. What this proves — each leg is a way the setting
// could silently stop meaning anything:
//   ① the validity rules: trial days 1–90; coupon 0–90% (0 = no coupon), 1–365 days; whole numbers;
//   ② the /pricing POST parse: no section → null (an old open tab resets nothing), switched off
//      → the STORED numbers survive, "20%" / " 30 " normalise, "2,5" / "-1" / junk are refused;
//   ③ the POST handler validates the trial section BEFORE anything is written — a refused value
//      must not leave half a save (prices or escalation stored, trial not) (structural);
//   ④ the page renders the section with the STORED values (not the defaults), the presence
//      marker, the switch state, and the running-trial count; switched off → inputs disabled;
//   ⑤ switched off → startTrial refuses a NEW trial ('disabled') — before any row is written;
//   ⑥ the running-trial count reads the DB without error;
//   ⑦ ONE coupon rule: both minting paths (first payment, trial start) read getCouponConfig and
//      nothing else (no fixed constant), and the ADR-0342 trial percent migrates (structural + pure).
//
// The dev DB is SHARED by parallel worktrees: the config is set with the PROCESS-LOCAL override,
// never by writing the app_setting row. This guard writes NO row at all (leg ⑤ is refused
// before the claim).
//
// Run: npx tsx scripts/free-trial-config-check.mts

import { readFileSync } from "node:fs";

import { db } from "../src/db/client.js";
import { pricingPage } from "../src/console/views.js";
import { ESCALATION_CONFIG_DEFAULT } from "../src/payment/offers.js";
import {
  couponConfigErrors,
  couponFromForm,
  legacyTrialCouponPercent,
  liveTenantCoupons,
  parseCouponSetting,
  type CouponConfig,
} from "../src/payment/couponConfig.js";
import { loadPricing, pricingRegions, pricingSnapshot } from "../src/pricing.js";
import {
  FREE_TRIAL_CONFIG_DEFAULT,
  freeTrialConfigErrors,
  freeTrialFromForm,
  overrideFreeTrialConfigInProcess,
  runningFreeTrials,
  type FreeTrialConfig,
} from "../src/trial/config.js";
import { startTrial } from "../src/trial/start.js";

let failures = 0;
function check(name: string, got: unknown, want: unknown): void {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  console.log(`${ok ? "✓ " : "✗ "} ${name}${ok ? "" : `\n     várt: ${JSON.stringify(want)} · kapott: ${JSON.stringify(got)}`}`);
  if (!ok) failures++;
}

const f = (o: Record<string, string>): { get(name: string): string | null } => ({
  get: (n) => (n in o ? o[n] : null),
});

try {
  // ① bounds
  const errs = (days: number) => freeTrialConfigErrors({ days });
  check("① 14 nap érvényes", errs(14), []);
  check("① 1 és 90 nap érvényes", [errs(1), errs(90)], [[], []]);
  check("① 0 / 91 / 2,5 / NaN nap hibás", [errs(0), errs(91), errs(2.5), errs(Number.NaN)], [["days"], ["days"], ["days"], ["days"]]);
  const cerr = (percent: number, days: number) => couponConfigErrors({ percent, days });
  check("① kupon 25% / 90 nap érvényes", cerr(25, 90), []);
  check("① kupon 0% (nincs kupon) / 1 nap, 90% / 365 nap érvényes", [cerr(0, 1), cerr(90, 365)], [[], []]);
  check("① kupon 91% · −1% · 10,5% hibás", [cerr(91, 90), cerr(-1, 90), cerr(10.5, 90)], [["percent"], ["percent"], ["percent"]]);
  check("① kupon 0 · 366 · NaN nap hibás", [cerr(25, 0), cerr(25, 366), cerr(25, Number.NaN)], [["days"], ["days"], ["days"]]);

  // ② POST parse
  const stored: FreeTrialConfig = { enabled: true, days: 21 };
  check("② szekció nélküli űrlap (régi fül) → null, nem nulláz", freeTrialFromForm(f({ base_monthly: "3900" }), stored), null);
  check(
    "② kikapcsolva (a tiltott mező nem jön) → a TÁROLT szám marad",
    freeTrialFromForm(f({ trial_present: "1" }), stored),
    { enabled: false, days: 21 },
  );
  check(
    "② bekapcsolva, normalizálás (\" 30 \"); egy régi fül trial_coupon mezője nem számít",
    freeTrialFromForm(f({ trial_present: "1", trial_on: "on", trial_days: " 30 ", trial_coupon: "20 %" }), stored),
    { enabled: true, days: 30 },
  );
  const frac = freeTrialFromForm(f({ trial_present: "1", trial_on: "on", trial_days: "2,5" }), stored);
  check("② \"2,5\" nap → a szabály elutasítja", frac ? freeTrialConfigErrors(frac) : null, ["days"]);
  const empty = freeTrialFromForm(f({ trial_present: "1", trial_on: "on", trial_days: "" }), stored);
  check("② üres nap-mező → a szabály elutasítja (nem 0, nem alapérték)", empty ? freeTrialConfigErrors(empty) : null, ["days"]);
  const cStored: CouponConfig = { percent: 30, days: 60 };
  check("② kupon-szekció nélküli űrlap (régi fül) → null", couponFromForm(f({ trial_present: "1" }), cStored), null);
  check(
    "② kupon normalizálás (\"20 %\", \" 120 \")",
    couponFromForm(f({ coupon_present: "1", coupon_percent: "20 %", coupon_days: " 120 " }), cStored),
    { percent: 20, days: 120 },
  );
  const cbad = couponFromForm(f({ coupon_present: "1", coupon_percent: "-1", coupon_days: "abc" }), cStored);
  check("② kupon \"-1\" % / \"abc\" nap → a szabály elutasítja", cbad ? couponConfigErrors(cbad) : null, ["percent", "days"]);

  // ③ structural: in the POST /pricing handler the trial refusal precedes every write.
  const server = readFileSync(new URL("../src/console/server.ts", import.meta.url), "utf8");
  const post = server.slice(server.indexOf('if (method === "POST" && path === "/pricing")'));
  const at = (needle: string): number => post.indexOf(needle);
  const refuse = at("freeTrialConfigErrors(trial)");
  const refuseC = at("couponConfigErrors(coupon)");
  check("③ a POST /pricing ellenőrzi a próba- és a kupon-szekciót", refuse > 0 && refuseC > 0, true);
  check(
    "③ …MINDEN írás előtt (setEscalationConfig, setCouponConfig, setFreeTrialConfig, savePricing, setDisabledModules)",
    ["await setEscalationConfig(", "await setCouponConfig(", "await setFreeTrialConfig(", "await savePricing(", "await setDisabledModules("].map(
      (w) => at(w) > Math.max(refuse, refuseC),
    ),
    [true, true, true, true, true],
  );
  check("③ a kupon a próba ELŐTT íródik (a próba-mentés dobja a régi couponPercent-et)", at("await setCouponConfig(") < at("await setFreeTrialConfig("), true);

  // ④ the page
  await loadPricing(true);
  const page = (cfg: FreeTrialConfig, running: number, coupon: CouponConfig = { percent: 30, days: 60 }, live = 0): string =>
    pricingPage(pricingSnapshot("hu"), pricingRegions(), null, new Set(), new Map(), {
      cfg: ESCALATION_CONFIG_DEFAULT,
      live: { count: 0, percents: [] },
    }, { cfg, running }, { cfg: coupon, live });
  const html = page({ enabled: true, days: 21 }, 3, { percent: 30, days: 60 }, 7);
  check("④ a szekció megjelenik", html.includes('id="pr-trial"'), true);
  check("④ jelenlét-jelölő (trial_present)", html.includes('name="trial_present" value="1"'), true);
  check("④ a TÁROLT napszám a mezőben", /name="trial_days" inputmode="numeric" value="21">/.test(html), true);
  check("④ a próba-szekcióban NINCS külön kupon-mező (egy kupon, egy hely)", html.includes('name="trial_coupon"'), false);
  check("④ a „Kupon” szekció megjelenik, jelenlét-jelölővel", html.includes('id="pr-coupon"') && html.includes('name="coupon_present" value="1"'), true);
  check("④ a TÁROLT kupon-% és -nap a mezőkben", /name="coupon_percent" inputmode="numeric" value="30">/.test(html) && /name="coupon_days" inputmode="numeric" value="60">/.test(html), true);
  const cdata = JSON.parse(/<script type="application\/json" id="coupon_data">([\s\S]*?)<\/script>/.exec(html)?.[1] ?? "null") as { live: number; saved: CouponConfig } | null;
  check("④ a kint lévő kuponok száma + a tárolt érték a lap adatában", [cdata?.live, cdata?.saved], [7, { percent: 30, days: 60 }]);
  check("④ bekapcsolva: a kapcsoló bepipálva", /id="trial_on" name="trial_on" checked/.test(html), true);
  const data = JSON.parse(/<script type="application\/json" id="trial_data">([\s\S]*?)<\/script>/.exec(html)?.[1] ?? "null") as {
    running: number;
    saved: FreeTrialConfig;
  } | null;
  check("④ a futó próbák száma a lap adatában", data?.running ?? null, 3);
  check("④ a tárolt érték a lap adatában (a „változott-e” alapja)", data?.saved ?? null, { enabled: true, days: 21 });
  const off = page({ enabled: false, days: 21 }, 0);
  check("④ kikapcsolva: a kapcsoló NINCS bepipálva", /id="trial_on" name="trial_on" checked/.test(off), false);
  check("④ kikapcsolva: a nap-mező tiltott (a tárolt szám marad)", /name="trial_days" inputmode="numeric" value="21" disabled>/.test(off), true);
  check("④ kikapcsolt próbánál a kupon-mezők NEM tiltottak (a közvetlen vevőé is)", /name="coupon_percent" inputmode="numeric" value="30">/.test(off), true);

  // ⑤ switched off → no new trial. A prospect whose lead has no trial yet, so the getter
  // decides (an existing trial would answer first, by design). Refused before any write.
  const p = await db
    .selectFrom("prospect")
    .select(["token"])
    .where("mock_artifact_id", "is not", null)
    .where(({ not, exists, selectFrom }) =>
      not(exists(selectFrom("free_trial").select("free_trial.id").whereRef("free_trial.lead_id", "=", "prospect.lead_id"))),
    )
    .limit(1)
    .executeTakeFirst();
  check("⑤ van próba nélküli, mockos prospect a méréshez", !!p, true);
  if (p) {
    overrideFreeTrialConfigInProcess({ ...FREE_TRIAL_CONFIG_DEFAULT, enabled: false });
    const before = await db.selectFrom("free_trial").select((eb) => eb.fn.countAll<string>().as("n")).executeTakeFirstOrThrow();
    const r = await startTrial(p.token, {
      name: "Próba Őr",
      email: "trial-config-check@example.com",
      phone: "+36 30 123 4567",
      aszfAccepted: true,
      photoRightsAccepted: true,
    });
    const after = await db.selectFrom("free_trial").select((eb) => eb.fn.countAll<string>().as("n")).executeTakeFirstOrThrow();
    check("⑤ kikapcsolt próba → startTrial 'disabled'", r.ok ? "ok" : r.error, "disabled");
    check("⑤ …és nem írt free_trial sort", Number(after.n) - Number(before.n), 0);
  }

  // ⑥ the count
  const n = await runningFreeTrials();
  check("⑥ a futó próbák száma olvasható (nem negatív egész)", Number.isInteger(n) && n >= 0, true);
  const lc = await liveTenantCoupons();
  check("⑥ a kint lévő kuponok száma olvasható (nem negatív egész)", Number.isInteger(lc) && lc >= 0, true);

  // ⑦ ONE coupon rule (structural): both minting paths read the shared setting.
  const src = (rel: string): string => readFileSync(new URL(rel, import.meta.url), "utf8");
  const offers = src("../src/payment/offers.ts");
  const grant = offers.slice(offers.indexOf("export async function grantNewSubscriberCouponForOrder"));
  const grantBody = grant.slice(0, grant.indexOf("\n}\n"));
  check("⑦ a fizetéskori kupon a getCouponConfig()-ból ver (% és nap)", /getCouponConfig\(\)/.test(grantBody) && /percent: cfg\.percent/.test(grantBody) && /cfg\.days/.test(grantBody), true);
  const start = src("../src/trial/start.ts");
  check("⑦ a próba-kupon ugyanabból (getCouponConfig, cfg.percent, cfg.days)", /getCouponConfig\(\)/.test(start) && /percent: cfg\.percent/.test(start) && /cfg\.days \* 86_400_000/.test(start), true);
  check("⑦ nincs második, rögzített kupon-konstans", /NEW_SUBSCRIBER_COUPON_(PERCENT|DAYS)/.test(offers + start), false);
  check("⑦ migráció: a régi próba-% átjön", legacyTrialCouponPercent('{"enabled":true,"days":14,"couponPercent":20}'), 20);
  check("⑦ migráció: nincs régi sor / mező / hibás érték → null (alapérték)", [legacyTrialCouponPercent(null), legacyTrialCouponPercent('{"days":14}'), legacyTrialCouponPercent('{"couponPercent":95}')], [null, null, null]);
  check("⑦ a kupon-sor parsere: üres → alap, hibás → null", [parseCouponSetting("{}"), parseCouponSetting('{"percent":91}')], [{ percent: 25, days: 90 }, null]);
} finally {
  overrideFreeTrialConfigInProcess(null);
  await db.destroy();
}

if (failures) {
  console.error(`\n⛔ free-trial-config-check: ${failures} hiba`);
  process.exit(1);
}
console.log("\n✅ free-trial-config-check: minden zöld");
